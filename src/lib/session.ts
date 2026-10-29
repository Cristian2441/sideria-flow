import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME, type JWTPayload } from "@/lib/auth";
import { db } from "@/prisma/db";
import type { UserRole } from "@/lib/types";

export async function getSession(): Promise<JWTPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  const user = await db.orm.public.User
    .where((u) => u.id.eq(session.userId))
    .select( "active", "role", "companyId")
    .first();
  if (!user?.active) throw new Error("UNAUTHORIZED");
  return { ...session, role: user.role as UserRole, companyId: user.companyId };
}
