import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/auth";
import { apiSuccess } from "@/lib/api-response";
import { redirect } from "next/navigation";

export async function POST() {
  const cookieStore = await cookies();
  // Eliminar la cookie seteando maxAge=0 y expirando en el pasado
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return apiSuccess({ message: "Sesión cerrada correctamente." });
}

export async function GET() {
  const cookieStore = await cookies();
  // Eliminar la cookie seteando maxAge=0 y expirando en el pasado
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  redirect("/login");
}
