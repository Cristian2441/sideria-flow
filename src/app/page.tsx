import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/**
 * Página raíz — redirige según estado de sesión:
 * - Con sesión válida → /dashboard
 * - Sin sesión → /login
 */
export default async function RootPage() {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
