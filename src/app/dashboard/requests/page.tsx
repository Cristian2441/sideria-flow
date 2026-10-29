/**
 * HU-10: Dashboard de solicitudes — Sideria Flow.
 * Rediseñado con Tailwind CSS + estética shadcn/ui exactamente como en la captura:
 * - Card blanca con esquinas redondeadas sobre fondo #f8fafc
 * - Título "Resultados" y contador "X SOLICITUDES"
 * - Tabla con título + descripción debajo
 * - Badges tipo píldora con punto indicador (En jefatura, En finanzas, Aprobada, Rechazada)
 * - Montos en formato $XXX.XXX
 * - Enlace azul "Ver ↗"
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Link from "next/link";
import type { PurchaseRequestStatus, UserRole } from "@/lib/types";

// ─── Helpers visuales ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  PurchaseRequestStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  PENDING_MANAGER: {
    label: "En jefatura",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200/90",
    dot: "bg-amber-500",
  },
  PENDING_FINANCE: {
    label: "En finanzas",
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200/90",
    dot: "bg-sky-500",
  },
  APPROVED: {
    label: "Aprobada",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200/90",
    dot: "bg-emerald-500",
  },
  REJECTED: {
    label: "Rechazada",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200/90",
    dot: "bg-rose-500",
  },
  DRAFT: {
    label: "Borrador",
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
};

function StatusBadge({ status }: { status: PurchaseRequestStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border} shadow-2xs whitespace-nowrap`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function formatCLP(amount: number) {
  return `$${amount.toLocaleString("es-CL")}`;
}

function formatSimpleDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("es-CL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
      .format(d)
      .replace(".", "");
  } catch {
    return dateStr;
  }
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Request {
  id: string;
  title: string;
  description?: string;
  costCenter: string;
  status: PurchaseRequestStatus;
  totalAmount: number;
  requesterId: string;
  createdAt: string;
  updatedAt: string;
}

export default async function DashboardRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const search = sp.search ?? "";
  const status = sp.status ?? "";
  const costCenter = sp.costCenter ?? "";
  const minAmt = sp.minAmount ?? "";
  const maxAmt = sp.maxAmount ?? "";

  // Query params para la API
  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  if (status) qs.set("status", status);
  if (costCenter) qs.set("costCenter", costCenter);
  if (minAmt) qs.set("minAmount", minAmt);
  if (maxAmt) qs.set("maxAmount", maxAmt);
  qs.set("pageSize", "50");

  let requests: Request[] = [];
  let error = "";

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const res = await fetch(`${baseUrl}/api/purchase-requests?${qs.toString()}`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });

    if (res.ok) {
      const data = (await res.json()) as { data: Request[] };
      requests = data.data ?? [];
    } else {
      error = "Error al cargar las solicitudes.";
    }
  } catch {
    error = "No se pudo conectar con el servidor.";
  }

  const role = session.role as UserRole;
  const hasActiveFilters = Boolean(search || status || costCenter || minAmt || maxAmt);

  return (
    <div className="w-full max-w-[1240px] mx-auto flex flex-col gap-6">
      {/* Barra de Filtros interactiva */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
        <form method="GET" className="flex flex-wrap items-center gap-3">
          {/* Input de Búsqueda */}
          <div className="relative flex-1 min-w-[220px]">
            <input
              name="search"
              type="text"
              placeholder="Buscar título o descripción..."
              defaultValue={search}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
            />
            <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
          </div>

          {/* Filtro de Estado */}
          <select
            name="status"
            defaultValue={status}
            className="py-2 px-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 focus:outline-none focus:bg-white focus:border-blue-500 min-w-[140px]"
          >
            <option value="">Todos los estados</option>
            <option value="DRAFT">Borrador</option>
            <option value="PENDING_MANAGER">En jefatura</option>
            <option value="PENDING_FINANCE">En finanzas</option>
            <option value="APPROVED">Aprobada</option>
            <option value="REJECTED">Rechazada</option>
          </select>

          {/* Filtro de Centro de Costo */}
          <input
            name="costCenter"
            type="text"
            placeholder="Centro de costo..."
            defaultValue={costCenter}
            className="py-2 px-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 w-[140px]"
          />

          <button
            type="submit"
            className="px-4 py-2 bg-[#0066ff] hover:bg-blue-600 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer"
          >
            Filtrar
          </button>

          {hasActiveFilters && (
            <Link
              href="/dashboard/requests"
              className="text-xs text-slate-500 hover:text-slate-800 underline px-2 py-1"
            >
              Limpiar filtros
            </Link>
          )}

          {role === "REQUESTER" && (
            <Link
              href="/dashboard/requests/new"
              className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
            >
              <span>+</span> Nueva solicitud
            </Link>
          )}
        </form>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
          {error}
        </div>
      )}

      {/* ── Tarjeta de Resultados (Calcada a la Maqueta) ── */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8">
        {/* Cabecera de la Tarjeta */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Resultados
          </h1>
          <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
            {requests.length} SOLICITUD{requests.length !== 1 ? "ES" : ""}
          </span>
        </div>

        {/* Estado Vacío */}
        {requests.length === 0 && !error ? (
          <div className="text-center py-16 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-xl text-slate-400">
              📋
            </div>
            <div className="text-sm font-semibold text-slate-700">No hay solicitudes encontradas</div>
            <div className="text-xs text-slate-400 max-w-sm">
              {hasActiveFilters
                ? "No se encontraron solicitudes que coincidan con los filtros aplicados."
                : "Aún no se han registrado solicitudes en el sistema."}
            </div>
          </div>
        ) : (
          <>
            {/* ── Vista Tabla para Escritorio (>= 768px) ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-4 px-3 text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                      Título
                    </th>
                    <th className="py-4 px-3 text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                      Centro de costo
                    </th>
                    <th className="py-4 px-3 text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                      Monto
                    </th>
                    <th className="py-4 px-3 text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                      Estado
                    </th>
                    <th className="py-4 px-3 text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                      Fecha
                    </th>
                    <th className="py-4 px-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map((req) => (
                    <tr
                      key={req.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Título + Descripción */}
                      <td className="py-4 px-3 max-w-[320px]">
                        <div className="font-bold text-slate-900 text-sm tracking-tight leading-snug">
                          {req.title}
                        </div>
                        {req.description && (
                          <div className="text-xs text-slate-500 mt-0.5 line-clamp-1 leading-normal font-normal">
                            {req.description}
                          </div>
                        )}
                      </td>

                      {/* Centro de Costo */}
                      <td className="py-4 px-3 text-sm text-slate-600 font-medium">
                        {req.costCenter}
                      </td>

                      {/* Monto */}
                      <td className="py-4 px-3 text-sm font-bold text-slate-900">
                        {formatCLP(req.totalAmount)}
                      </td>

                      {/* Estado */}
                      <td className="py-4 px-3">
                        <StatusBadge status={req.status} />
                      </td>

                      {/* Fecha */}
                      <td className="py-4 px-3 text-xs text-slate-500 whitespace-nowrap">
                        {formatSimpleDate(req.createdAt)}
                      </td>

                      {/* Acción Ver ↗ */}
                      <td className="py-4 px-3 text-right whitespace-nowrap">
                        <Link
                          href={`/dashboard/requests/${req.id}`}
                          className="text-[#0066ff] hover:text-blue-700 font-semibold text-xs inline-flex items-center gap-1 group-hover:underline"
                        >
                          Ver <span className="text-sm">↗</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Vista Tarjetas para Móvil (< 768px) ── */}
            <div className="md:hidden flex flex-col divide-y divide-slate-100">
              {requests.map((req) => (
                <div key={req.id} className="py-4 flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">
                        {req.title}
                      </h3>
                      {req.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {req.description}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={req.status} />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span>
                      Área: <strong className="text-slate-700">{req.costCenter}</strong>
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {formatCLP(req.totalAmount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                    <span className="text-[11px] text-slate-400">
                      {formatSimpleDate(req.createdAt)}
                    </span>
                    <Link
                      href={`/dashboard/requests/${req.id}`}
                      className="text-[#0066ff] hover:text-blue-700 font-semibold text-xs inline-flex items-center gap-1"
                    >
                      Ver detalle ↗
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
