import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/prisma/db";
import { countByStatus, sumApprovedAmount, avgApprovalTimeHours } from "@/lib/metrics";
import type { PurchaseRequestStatus } from "@/lib/types";

export const metadata = { title: "Indicadores | Sideria Flow" };

function formatCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const STATUS_CONFIG: Record<
  PurchaseRequestStatus,
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  DRAFT:           { label: "Borrador",      dot: "bg-slate-400",   text: "text-slate-700",   bg: "bg-slate-50",   border: "border-slate-200" },
  PENDING_MANAGER: { label: "En jefatura",   dot: "bg-amber-500",   text: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200" },
  PENDING_FINANCE: { label: "En finanzas",   dot: "bg-cyan-500",    text: "text-cyan-700",    bg: "bg-cyan-50",    border: "border-cyan-200" },
  APPROVED:        { label: "Aprobadas",     dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  REJECTED:        { label: "Rechazadas",    dot: "bg-red-500",     text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200" },
};

export default async function IndicatorsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "REQUESTER") redirect("/dashboard/requests");

  const companyId = session.companyId;

  // Consulta directa a DB
  const [allRequests, allHistory] = await Promise.all([
    db.orm.public.PurchaseRequest
      .where((r) => r.companyId.eq(companyId))
      .select("id", "title", "status", "totalAmount", "costCenter", "createdAt", "updatedAt")
      .all(),
    db.orm.public.ApprovalHistory
      .where((h) => h.companyId.eq(companyId))
      .select("requestId", "toStatus", "createdAt")
      .all(),
  ]);

  const statusCounts = countByStatus(allRequests);
  const totalApproved = sumApprovedAmount(allRequests);
  const avgHours = avgApprovalTimeHours(
    allHistory.map((h) => ({ requestId: h.requestId, toStatus: h.toStatus, createdAt: h.createdAt })),
    allRequests.map((r) => ({ id: r.id, createdAt: r.createdAt }))
  );

  // Últimas 10 solicitudes aprobadas para la tabla
  const approvedRequests = allRequests
    .filter((r) => r.status === "APPROVED")
    .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
    .slice(0, 10);

  const STATUSES: PurchaseRequestStatus[] = [
    "DRAFT", "PENDING_MANAGER", "PENDING_FINANCE", "APPROVED", "REJECTED",
  ];

  return (
    <div className="w-full max-w-[1240px] mx-auto flex flex-col gap-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Indicadores</h1>
        <p className="text-sm text-slate-500 mt-1">Panel de gestión de solicitudes de compra</p>
      </div>

      {/* Solicitudes por estado */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
          Solicitudes por estado
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {STATUSES.map((status) => {
            const cfg = STATUS_CONFIG[status];
            const count = statusCounts[status];
            return (
              <div
                key={status}
                className={`bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-3 ${cfg.border}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                  <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
                </div>
                <span className="text-4xl font-extrabold text-slate-900">{count}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Métricas clave */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
          Métricas clave
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Monto total aprobado */}
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-emerald-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-bold uppercase tracking-wider">Monto aprobado</span>
            </div>
            <span className="text-2xl font-extrabold text-slate-900">{formatCLP(totalApproved)}</span>
            <span className="text-xs text-slate-400">Total acumulado en solicitudes aprobadas</span>
          </div>

          {/* Tiempo medio de aprobación */}
          <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-blue-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-bold uppercase tracking-wider">Tiempo medio</span>
            </div>
            <span className="text-2xl font-extrabold text-slate-900">
              {avgHours !== null ? `${avgHours}h` : "N/A"}
            </span>
            <span className="text-xs text-slate-400">Tiempo promedio hasta aprobación</span>
          </div>

          {/* Total de solicitudes */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs font-bold uppercase tracking-wider">Total solicitudes</span>
            </div>
            <span className="text-2xl font-extrabold text-slate-900">{allRequests.length}</span>
            <span className="text-xs text-slate-400">Solicitudes en tu empresa</span>
          </div>
        </div>
      </section>

      {/* Últimas solicitudes aprobadas */}
      {approvedRequests.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
            Últimas solicitudes aprobadas
          </h2>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-3">Título</th>
                  <th className="px-6 py-3 hidden sm:table-cell">Centro de costo</th>
                  <th className="px-6 py-3 text-right">Monto</th>
                  <th className="px-6 py-3 text-right hidden md:table-cell">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {approvedRequests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">{r.title}</td>
                    <td className="px-6 py-4 text-xs text-slate-500 hidden sm:table-cell">{r.costCenter}</td>
                    <td className="px-6 py-4 text-sm font-bold text-emerald-700 text-right">
                      {formatCLP(Number(r.totalAmount))}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 text-right hidden md:table-cell">
                      {formatDate(r.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

