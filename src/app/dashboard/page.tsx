/**
 * Panel principal del dashboard — redirige a la lista de solicitudes.
 */
import { redirect } from "next/navigation";

export default function DashboardPage() {
  redirect("/dashboard/requests");
}
