import { cookies } from "next/headers";
import { compare, hashSync } from "bcryptjs";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { loginSchema } from "@/lib/schemas/auth.schema";
import { signToken, COOKIE_NAME, COOKIE_OPTIONS } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limiter";
import { db } from "@/prisma/db";
import type { UserRole } from "@/lib/types";

const DUMMY_HASH = hashSync("dummy_password", 12);

const hasUpstash = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);
const redis = hasUpstash ? Redis.fromEnv() : null;

const loginLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      prefix: "rl:login",
    })
  : null;

const ipLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "15 m"),
      prefix: "rl:login-ip",
    })
  : null;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "El cuerpo de la petición no es JSON válido.");
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(401, "INVALID_CREDENTIALS", "Credenciales inválidas.");
  }

  const { email, password } = parsed.data;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (loginLimiter && ipLimiter) {
    try {
      const [byAccount, byIp] = await Promise.all([
        loginLimiter.limit(`${ip}:${email}`),
        ipLimiter.limit(ip),
      ]);
      if (!byAccount.success || !byIp.success) {
        return apiError(429, "TOO_MANY_ATTEMPTS", "Demasiados intentos. Intenta más tarde.");
      }
    } catch (err) {
      console.error("Rate limiter unavailable:", err);
    }
  } else {
    // Modo local / desarrollo: limitador en memoria (15 minutos)
    const WINDOW_15M = 15 * 60 * 1000;
    const accountCheck = checkRateLimit(`login:${ip}:${email}`, 5, WINDOW_15M);
    const ipCheck = checkRateLimit(`login-ip:${ip}`, 20, WINDOW_15M);

    if (!accountCheck.allowed || !ipCheck.allowed) {
      return apiError(429, "TOO_MANY_ATTEMPTS", "Demasiados intentos. Intenta más tarde.");
    }
  }

  let user;
  try {
    user = await db.orm.public.User
      .where((u) => u.email.eq(email))
      .select("id", "email", "name", "passwordHash", "role", "companyId", "active")
      .first();
  } catch (err) {
    console.error("login error:", err);
    return apiError(500, "DB_ERROR", "Error interno del servidor.");
  }

  const hash = user?.passwordHash ?? DUMMY_HASH;
  const valid = await compare(password, hash);
  if (!user || !user.active || !valid) {
    return apiError(401, "INVALID_CREDENTIALS", "Credenciales inválidas.");
  }

  const token = await signToken({
    userId: user.id,
    companyId: user.companyId,
    role: user.role as UserRole,
    email: user.email,
    name: user.name,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTIONS);

  return apiSuccess(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
      },
    },
    200
  );
}
