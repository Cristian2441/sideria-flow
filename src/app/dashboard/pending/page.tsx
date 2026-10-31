import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/prisma/db";
import Link from "next/link";
import type { PurchaseRequestStatus, UserRole } from "@/lib/types";
import { APPROVAL_THRESHOLD } from "@/lib/types";


const STATUS_CONFIG: Record<
  PurchaseRequestStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  DRAFT: {
    label: "Borrador",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    dotClass: "bg-slate-400",
  },
  PENDING_MANAGER: {
    label: "En jefatura",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    dotClass: "bg-amber-500",
  },
  PENDING_FINANCE: {
    label: "En finanzas",
    badgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200",
    dotClass: "bg-cyan-500",
  },
  APPROVED: {
    label: "Aprobada",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500",
  },
  REJECTED: {
    label: "Rechazada",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
    dotClass: "bg-red-500",
  },
};

function StatusBadge({ status }: { status: PurchaseRequestStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.badgeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}

function formatCLP(amount: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}


export default async function PendingInboxPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const role = session.role as UserRole;

  if (role !== "MANAGER" && role !== "FINANCE") {
    redirect("/dashboard/requests");
  }

  const targetStatus = role === "MANAGER" ? "PENDING_MANAGER" : "PENDING_FINANCE";

  const allInStatus = await db.orm.public.PurchaseRequest
    .where((r) => r.companyId.eq(session.companyId))
    .where((r) => r.status.eq(targetStatus))
    .select(
      "id", "title", "description", "costCenter", "status",
      "totalAmount", "source", "requesterId", "companyId",
      "createdAt", "updatedAt"
    )
    .all();

  const pendingRequests = allInStatus.filter((r) => r.requesterId !== session.userId);

  pendingRequests.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const users = await db.orm.public.User
    .where((u) => u.companyId.eq(session.companyId))
    .select("id", "name", "email", "role")
    .all();

  const userMap = new Map(users.map((u) => [u.id, u]));

  return (
    <div className="w-full max-w-[1240px] mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard/requests"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors w-fit font-medium"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver a todas las solicitudes
        </Link>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Bandeja de pendientes de aprobación
              </h1>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                  pendingRequests.length > 0
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                {pendingRequests.length} pendiente{pendingRequests.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              {role === "MANAGER"
                ? "Solicitudes de tu equipo pendientes de revisión inicial. Montos ≤ $500.000 se aprueban directamente; superiores se derivan a Finanzas."
                : "Solicitudes de monto alto (> $500.000 CLP) previamente aprobadas por jefatura en espera de tu aprobación financiera."}
            </p>
          </div>
        </div>
      </div>

      {pendingRequests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="text-4xl">🎉</div>
          <h2 className="text-base font-bold text-slate-800">
            ¡Bandeja al día!
          </h2>
          <p className="text-xs text-slate-500 max-w-md">
            No tienes solicitudes pendientes de tu aprobación en este momento.
          </p>
          <Link
            href="/dashboard/requests"
            className="mt-2 text-xs font-semibold text-[#0066ff] hover:underline"
          >
            Ver historial de solicitudes →
          </Link>
        </div>
      ) : (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8 flex flex-col gap-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Solicitudes por revisar
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              Total pendientes: {pendingRequests.length}
            </span>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 pr-4">Título y Solicitante</th>
                  <th className="pb-3 px-4 w-32">Centro de costo</th>
                  <th className="pb-3 px-4 w-40">Monto</th>
                  <th className="pb-3 px-4 w-32">Estado</th>
                  <th className="pb-3 px-4 w-28">Fecha</th>
                  <th className="pb-3 pl-4 w-28 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingRequests.map((req) => {
                  const requester = userMap.get(req.requesterId);
                  const isHigh = req.totalAmount > APPROVAL_THRESHOLD;
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 pr-4">
                        <div className="text-xs font-bold text-slate-900">
                          {req.title}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Solicitado por:{" "}
                          <strong className="text-slate-700">
                            {requester?.name ?? "Usuario"}
                          </strong>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-xs font-medium text-slate-600">
                        {req.costCenter}
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-xs font-bold text-slate-900">
                          {formatCLP(req.totalAmount)}
                        </div>
                        {isHigh && (
                          <div className="text-[10px] font-medium text-amber-600 mt-0.5">
                            {role === "MANAGER" ? "↑ Pasará a finanzas" : "Requiere finanzas"}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <StatusBadge status={req.status as PurchaseRequestStatus} />
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(req.createdAt)}
                      </td>
                      <td className="py-4 pl-4 text-right">
                        <Link
                          href={`/dashboard/requests/${req.id}`}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-[#0066ff] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-xs transition-all whitespace-nowrap"
                        >
                          Revisar →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex md:hidden flex-col gap-3">
            {pendingRequests.map((req) => {
              const requester = userMap.get(req.requesterId);
              const isHigh = req.totalAmount > APPROVAL_THRESHOLD;
              return (
                <div
                  key={req.id}
                  className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {req.title}
                    </span>
                    <StatusBadge status={req.status as PurchaseRequestStatus} />
                  </div>

                  <div className="text-[11px] text-slate-500">
                    Por: <strong className="text-slate-700">{requester?.name ?? "Usuario"}</strong> • {req.costCenter}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {formatCLP(req.totalAmount)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {formatDate(req.createdAt)}
                      </div>
                    </div>

                    <Link
                      href={`/dashboard/requests/${req.id}`}
                      className="px-3 py-1.5 bg-[#0066ff] text-white rounded-lg text-xs font-semibold"
                    >
                      Revisar →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
