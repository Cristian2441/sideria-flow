import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import type { PurchaseRequestStatus, UserRole } from "@/lib/types";
import { APPROVAL_THRESHOLD } from "@/lib/types";
import ReviewForm from "./ReviewForm";
import SubmitButton from "./SubmitButton";

interface RequestItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface HistoryActor {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface HistoryEntry {
  id: string;
  fromStatus: PurchaseRequestStatus | null;
  toStatus: PurchaseRequestStatus;
  comment: string | null;
  actorId: string;
  actor?: HistoryActor | null;
  createdAt: string;
}

interface RequestDetail {
  id: string;
  title: string;
  description: string;
  costCenter: string;
  status: PurchaseRequestStatus;
  totalAmount: number;
  source: string;
  requesterId: string;
  requester?: HistoryActor | null;
  companyId: string;
  createdAt: string;
  updatedAt: string;
  items: RequestItem[];
  history: HistoryEntry[];
}

const STATUS_CONFIG: Record<PurchaseRequestStatus, { label: string; badgeClass: string; dotClass: string }> = {
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

const HISTORY_LABEL: Record<PurchaseRequestStatus, string> = {
  DRAFT: "Creada como borrador",
  PENDING_MANAGER: "Enviada a jefatura",
  PENDING_FINANCE: "Derivada a finanzas",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
};

function StatusBadge({ status }: { status: PurchaseRequestStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cfg.badgeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}

function formatCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const res = await fetch(`${baseUrl}/api/purchase-requests/${id}`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });

  if (res.status === 404) notFound();
  if (!res.ok) redirect("/dashboard/requests");

  const { data: pr } = (await res.json()) as { data: RequestDetail };

  const role = session.role as UserRole;
  const canEdit = role === "REQUESTER" && pr.status === "DRAFT" && pr.requesterId === session.userId;
  const canSubmit = role === "REQUESTER" && pr.status === "DRAFT" && pr.requesterId === session.userId;
  const canReviewManager = role === "MANAGER" && pr.status === "PENDING_MANAGER" && pr.requesterId !== session.userId;
  const canReviewFinance = role === "FINANCE" && pr.status === "PENDING_FINANCE" && pr.requesterId !== session.userId;
  const canReview = canReviewManager || canReviewFinance;

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
          Volver a solicitudes
        </Link>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {pr.title}
              </h1>
              <StatusBadge status={pr.status} />
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
              {pr.requester && (
                <span>
                  Solicitante: <strong className="text-slate-700">{pr.requester.name}</strong>
                </span>
              )}
              <span>•</span>
              <span>
                Centro de costo: <strong className="text-slate-700">{pr.costCenter}</strong>
              </span>
              <span>•</span>
              <span>
                Origen: <strong className="text-slate-700">{pr.source}</strong>
              </span>
            </div>
          </div>

          <div className="md:text-right flex flex-col items-start md:items-end">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Monto Total
            </span>
            <div className="text-3xl font-extrabold text-slate-900 mt-0.5">
              {formatCLP(pr.totalAmount)}
            </div>
            {pr.totalAmount > APPROVAL_THRESHOLD && (
              <span className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                Requiere aprobación de Finanzas (&gt; $500.000)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        <div className="lg:col-span-2 flex flex-col gap-6">
        
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
              Descripción
            </h2>
            <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
              {pr.description}
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Productos ({pr.items.length})
              </h2>
              <span className="text-xs font-semibold text-slate-500">
                Total: {formatCLP(pr.totalAmount)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 pr-4">Descripción</th>
                    <th className="pb-3 px-4 w-24 text-center">Cant.</th>
                    <th className="pb-3 px-4 w-32 text-right">Precio unit.</th>
                    <th className="pb-3 pl-4 w-36 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pr.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 pr-4 text-xs font-medium text-slate-800">
                        {item.description}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 text-center">
                        {item.quantity}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 text-right">
                        {formatCLP(item.unitPrice)}
                      </td>
                      <td className="py-3.5 pl-4 text-xs font-bold text-slate-900 text-right">
                        {formatCLP(item.quantity * item.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-100">
                    <td colSpan={3} className="pt-4 pr-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Total estimado
                    </td>
                    <td className="pt-4 pl-4 text-right text-base font-extrabold text-slate-900">
                      {formatCLP(pr.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {canReview && <ReviewForm requestId={pr.id} />}

          {canSubmit && (
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Acciones disponibles
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Tu solicitud está en borrador. Puedes editarla o enviarla para su revisión por parte de tu jefatura.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-slate-100">
                {canEdit && (
                  <Link
                    href={`/dashboard/requests/${pr.id}/edit`}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all inline-flex items-center gap-1.5"
                  >
                    ✏️ Editar solicitud
                  </Link>
                )}
                <SubmitButton requestId={pr.id} />
              </div>
            </section>
          )}
        </div>

        <aside className="lg:col-span-1 lg:sticky lg:top-6 flex flex-col gap-6">
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 pb-3 border-b border-slate-100">
              Historial de la solicitud
            </h2>

            {pr.history.length === 0 ? (
              <p className="text-xs text-slate-400">Sin historial registrado.</p>
            ) : (
              <div className="flex flex-col">
                {pr.history.map((entry, idx) => {
                  const isLast = idx === pr.history.length - 1;
                  const cfg = STATUS_CONFIG[entry.toStatus];
                  return (
                    <div key={entry.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-2.5 h-2.5 rounded-full ${cfg.dotClass} shrink-0 mt-1`} />
                        {!isLast && <div className="w-px flex-1 bg-slate-200 min-h-6 my-1" />}
                      </div>
                      <div className={`flex-1 ${isLast ? "pb-0" : "pb-5"}`}>
                        <div className="flex items-baseline justify-between gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-800">
                            {HISTORY_LABEL[entry.toStatus]}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatDate(entry.createdAt)}
                          </span>
                        </div>

                        {entry.actor && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            por <strong className="text-slate-700">{entry.actor.name}</strong>{" "}
                            {entry.actor.role && (
                              <span className="text-slate-400">
                                ({entry.actor.role === "REQUESTER" ? "Solicitante" : entry.actor.role === "MANAGER" ? "Jefatura" : "Finanzas"})
                              </span>
                            )}
                          </p>
                        )}

                        {entry.comment && (
                          <div
                            className={`mt-2 p-2.5 rounded-xl text-xs leading-relaxed ${
                              entry.toStatus === "REJECTED"
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-slate-50 text-slate-700 border border-slate-200/80"
                            }`}
                          >
                            &ldquo;{entry.comment}&rdquo;
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex flex-col gap-2 text-xs">
              {pr.requester && <MetaRow label="Solicitante" value={pr.requester.name} />}
              <MetaRow label="Creada" value={formatDate(pr.createdAt)} />
              <MetaRow label="Actualizada" value={formatDate(pr.updatedAt)} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-slate-50 last:border-b-0">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-slate-700">{value}</span>
    </div>
  );
}
