import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/prisma/db";
import Link from "next/link";
import type { PurchaseRequestStatus, UserRole } from "@/lib/types";

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

interface RequestItem {
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
  const amount = sp.amount ?? "";
  const date = sp.date ?? "";

  let costCenterOptions: string[] = ["CC-TI", "CC-VENTAS", "CC-OPERACIONES", "CC-FINANZAS", "CC-RRHH", "CC-ADMIN"];
  let requests: RequestItem[] = [];
  let error = "";

  try {
    // 1. Opciones de centro de costo de la empresa
    const fromDb = await db.orm.public.PurchaseRequest
      .where((r) => r.companyId.eq(session.companyId))
      .select("costCenter")
      .all();
    const unique = Array.from(new Set(fromDb.map((r) => r.costCenter).filter(Boolean)));
    if (unique.length > 0) {
      costCenterOptions = Array.from(new Set([...unique, ...costCenterOptions]));
    }

    // 2. Consulta directa a la Base de Datos (aislamiento multi-tenant estricto)
    let query = db.orm.public.PurchaseRequest
      .where((r) => r.companyId.eq(session.companyId));

    if (session.role === "REQUESTER") {
      query = query.where((r) => r.requesterId.eq(session.userId));
    }

    if (status) {
      query = query.where((r) => r.status.eq(status));
    }

    if (amount) {
      const maxAmt = Number(amount);
      if (!isNaN(maxAmt)) {
        query = query.where((r) => r.totalAmount.lte(maxAmt));
      }
    }

    let allItems = await query
      .select(
        "id", "title", "description", "costCenter", "status",
        "totalAmount", "source", "requesterId", "companyId",
        "externalId", "createdAt", "updatedAt"
      )
      .all();

    // Filtros en memoria para texto, centros y fechas
    if (search) {
      const q = search.toLowerCase();
      allItems = allItems.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
      );
    }

    if (costCenter) {
      const cc = costCenter.trim().toLowerCase();
      allItems = allItems.filter((item) => item.costCenter.trim().toLowerCase() === cc);
    }

    if (date) {
      allItems = allItems.filter((item) => {
        const d = new Date(item.createdAt);
        const isoDay = d.toISOString().slice(0, 10);
        const localDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return isoDay === date || localDay === date;
      });
    }

    allItems.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    requests = allItems.map((r) => ({
      ...r,
      status: r.status as PurchaseRequestStatus,
      totalAmount: Number(r.totalAmount),
    }));
  } catch (err) {
    console.error("Error al obtener solicitudes:", err);
    error = "Error al conectar con la base de datos.";
  }

  const role = session.role as UserRole;
  const hasActiveFilters = Boolean(search || status || costCenter || amount || date);

  return (
    <div className="w-full max-w-[1240px] mx-auto flex flex-col gap-6">
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
        <form method="GET" className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <input
              name="search"
              type="text"
              placeholder="Buscar título o descripción..."
              defaultValue={search}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
            />
            <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
          </div>

          <select
            name="status"
            defaultValue={status}
            className="py-2 px-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 focus:outline-none focus:bg-white focus:border-blue-500 min-w-[130px]"
          >
            <option value="">Todos los estados</option>
            <option value="DRAFT">Borrador</option>
            <option value="PENDING_MANAGER">En jefatura</option>
            <option value="PENDING_FINANCE">En finanzas</option>
            <option value="APPROVED">Aprobada</option>
            <option value="REJECTED">Rechazada</option>
          </select>

          <select
            name="costCenter"
            defaultValue={costCenter}
            className="py-2 px-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 focus:outline-none focus:bg-white focus:border-blue-500 min-w-[140px]"
          >
            <option value="">Todos los centros</option>
            {costCenterOptions.map((cc) => (
              <option key={cc} value={cc}>{cc}</option>
            ))}
          </select>

          <input
            name="amount"
            type="number"
            min="0"
            step="1000"
            placeholder="Monto máx ($)..."
            defaultValue={amount}
            className="py-2 px-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 w-[125px]"
          />

          <input
            name="date"
            type="date"
            defaultValue={date}
            title="Filtrar por fecha exacta"
            className="py-2 px-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 focus:outline-none focus:bg-white focus:border-blue-500"
          />

          <button
            type="submit"
            className="px-4 py-2 bg-[#0066ff] hover:bg-blue-600 text-white font-medium text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Filtrar
          </button>

          {hasActiveFilters && (
            <Link
              href="/dashboard/requests"
              className="text-xs text-slate-500 hover:text-slate-800 underline px-2 py-1 font-medium"
            >
              Limpiar filtros
            </Link>
          )}

          {role === "REQUESTER" && (
            <Link
              href="/dashboard/requests/new"
              className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all"
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

      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8">
        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Resultados
          </h1>
          <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
            {requests.length} SOLICITUD{requests.length !== 1 ? "ES" : ""}
          </span>
        </div>

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

                      <td className="py-4 px-3 text-sm text-slate-600 font-medium">
                        {req.costCenter}
                      </td>

                      <td className="py-4 px-3 text-sm font-bold text-slate-900">
                        {formatCLP(req.totalAmount)}
                      </td>

                      <td className="py-4 px-3">
                        <StatusBadge status={req.status} />
                      </td>

                      <td className="py-4 px-3 text-xs text-slate-500 whitespace-nowrap">
                        {formatSimpleDate(req.createdAt)}
                      </td>

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
