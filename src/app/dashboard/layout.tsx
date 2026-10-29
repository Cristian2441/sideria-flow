/**
 * Layout compartido para todas las páginas del dashboard — Sideria Flow.
 * Combina el sidebar azul oscuro (#071426) con la cabecera blanca superior
 * y el área de trabajo en gris suave (#f8fafc) con Tailwind CSS.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/prisma/db";
import DashboardNavigation from "./DashboardNavigation";
import DashboardHeader from "./DashboardHeader";
import { ToastProvider } from "@/components/ToastProvider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Contador de pendientes para aprobadores (excluye las propias)
  let pendingCount = 0;
  if (session.role === "MANAGER" || session.role === "FINANCE") {
    try {
      const targetStatus =
        session.role === "MANAGER" ? "PENDING_MANAGER" : "PENDING_FINANCE";
      const pendingReqs = await db.orm.public.PurchaseRequest
        .where((r) => r.companyId.eq(session.companyId))
        .where((r) => r.status.eq(targetStatus))
        .select("id", "requesterId")
        .all();

      pendingCount = pendingReqs.filter((r) => r.requesterId !== session.userId).length;
    } catch {
      pendingCount = 0;
    }
  }

  return (
    <ToastProvider>
      <div className="flex flex-col md:flex-row min-h-screen bg-[#f8fafc] text-slate-900 font-sans antialiased">
        {/* Sidebar fija a la izquierda */}
        <DashboardNavigation session={session} pendingCount={pendingCount} />

        {/* Contenido derecho: Topbar + Main */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">
          {/* Topbar blanca con breadcrumb, notificaciones y perfil */}
          <DashboardHeader session={session} pendingCount={pendingCount} />

          {/* Área principal */}
          <main className="flex-1 overflow-auto p-4 md:p-8">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
