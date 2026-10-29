import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

const ISSUER = "sf-app";
const AUDIENCE = "sf-web";

const sessionSchema = z.object({
  userId: z.string().min(1),
  companyId: z.string().min(1),
  role: z.enum(["REQUESTER", "MANAGER", "FINANCE"]),
  email: z.string(),
  name: z.string(),
});


export type JWTPayload = z.infer<typeof sessionSchema>;


const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 ) {
    throw new Error("JWT_SECRET no está definido o tiene menos de 32 caracteres");
  }
  return new TextEncoder().encode(secret);
};

const parsedExpires = parseInt(process.env.JWT_EXPIRES_IN ?? "", 10);
const EXPIRES_IN = Number.isFinite(parsedExpires) && parsedExpires > 0 ? parsedExpires : 28800;

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${EXPIRES_IN}s`)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    algorithms: ["HS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  return sessionSchema.parse(payload);
}

export const COOKIE_NAME = "sf_token";
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: EXPIRES_IN,
};
