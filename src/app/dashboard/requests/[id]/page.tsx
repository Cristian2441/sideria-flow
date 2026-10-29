/**
 * HU-11: Detalle de solicitud de compra.
 * HU-12: Acciones según rol y estado (editar, enviar, aprobar, rechazar).
 * HU-07: Timeline del historial de aprobación.
 */

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import type { PurchaseRequestStatus, UserRole } from "@/lib/types";
import { APPROVAL_THRESHOLD } from "@/lib/types";
import ReviewForm from "./ReviewForm";
import SubmitButton from "./SubmitButton";

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

// ─── Helpers visuales ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PurchaseRequestStatus, { label: string; color: string; bg: string }> = {
  DRAFT:           { label: "Borrador",     color: "#a1a1aa", bg: "rgba(161,161,170,0.12)" },
  PENDING_MANAGER: { label: "En jefatura",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  PENDING_FINANCE: { label: "En finanzas",  color: "#06b6d4", bg: "rgba(6,182,212,0.12)"  },
  APPROVED:        { label: "Aprobada",     color: "#22c55e", bg: "rgba(34,197,94,0.12)"  },
  REJECTED:        { label: "Rechazada",    color: "#ef4444", bg: "rgba(239,68,68,0.12)"  },
};

const HISTORY_LABEL: Record<PurchaseRequestStatus, string> = {
  DRAFT:           "Creada como borrador",
  PENDING_MANAGER: "Enviada a jefatura",
  PENDING_FINANCE: "Derivada a finanzas",
  APPROVED:        "Aprobada",
  REJECTED:        "Rechazada",
};

function StatusBadge({ status }: { status: PurchaseRequestStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 12px", borderRadius: "999px",
      fontSize: "12px", fontWeight: "600",
      color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}33`,
    }}>
      {cfg.label}
    </span>
  );
}

function formatCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const role = session.role as UserRole;

  // Fetch del detalle
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

  const res = await fetch(`${baseUrl}/api/purchase-requests/${id}`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });

  if (res.status === 404) notFound();
  if (!res.ok) redirect("/dashboard/requests");

  const { data: pr } = (await res.json()) as { data: RequestDetail };

  // Determinar acciones disponibles según rol y estado
  const canEdit   = role === "REQUESTER" && pr.status === "DRAFT" && pr.requesterId === session.userId;
  const canSubmit = role === "REQUESTER" && pr.status === "DRAFT" && pr.requesterId === session.userId;
  const canReviewManager = role === "MANAGER" && pr.status === "PENDING_MANAGER" && pr.requesterId !== session.userId;
  const canReviewFinance = role === "FINANCE" && pr.status === "PENDING_FINANCE" && pr.requesterId !== session.userId;
  const canReview = canReviewManager || canReviewFinance;

  return (
    <div className="detail-page-container">
      {/* Breadcrumb */}
      <Link href="/dashboard/requests" style={{ fontSize: "12px", color: "var(--muted)", textDecoration: "none" }}>
        ← Volver a solicitudes
      </Link>

      <style>{`
        .detail-page-container {
          padding: 32px;
          max-width: 860px;
          width: 100%;
          box-sizing: border-box;
        }
        .detail-grid {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 768px) {
          .detail-page-container {
            padding: 16px 12px;
          }
          .detail-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: "16px", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: "700", margin: 0, marginBottom: "8px" }}>
            {pr.title}
          </h1>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <StatusBadge status={pr.status} />
            {pr.requester && (
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                Solicitante: <strong style={{ color: "var(--neutral-300)" }}>{pr.requester.name}</strong>
              </span>
            )}
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Centro de costo: <strong style={{ color: "var(--neutral-300)" }}>{pr.costCenter}</strong>
            </span>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Vía: <strong style={{ color: "var(--neutral-300)" }}>{pr.source}</strong>
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "24px", fontWeight: "800" }}>{formatCLP(pr.totalAmount)}</div>
          {pr.totalAmount > APPROVAL_THRESHOLD && (
            <div style={{ fontSize: "11px", color: "var(--brand-400)", marginTop: "2px" }}>
              ↑ Requiere aprobación de Finanzas
            </div>
          )}
        </div>
      </div>

      <div className="detail-grid">
        {/* ── Columna principal ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Descripción */}
          <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "20px" }}>
            <h2 style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "10px" }}>
              Descripción
            </h2>
            <p style={{ fontSize: "13px", lineHeight: "1.6", color: "var(--neutral-200)", margin: 0 }}>
              {pr.description}
            </p>
          </section>

          {/* Productos */}
          <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "20px" }}>
            <h2 style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "12px" }}>
              Productos ({pr.items.length})
            </h2>
            <div style={{ overflowX: "auto", width: "100%", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", minWidth: "300px", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Descripción", "Cant.", "Precio unit.", "Subtotal"].map((h) => (
                      <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontSize: "10px", fontWeight: "600", color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pr.items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 8px", fontSize: "13px" }}>{item.description}</td>
                      <td style={{ padding: "10px 8px", fontSize: "13px", color: "var(--muted)" }}>{item.quantity}</td>
                      <td style={{ padding: "10px 8px", fontSize: "13px", color: "var(--muted)" }}>{formatCLP(item.unitPrice)}</td>
                      <td style={{ padding: "10px 8px", fontSize: "13px", fontWeight: "600" }}>{formatCLP(item.quantity * item.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ padding: "12px 8px", textAlign: "right", fontSize: "12px", color: "var(--muted)", fontWeight: "600" }}>Total</td>
                    <td style={{ padding: "12px 8px", fontSize: "16px", fontWeight: "800" }}>{formatCLP(pr.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* Acciones de aprobación (MANAGER / FINANCE) */}
          {canReview && (
            <ReviewForm requestId={pr.id} />
          )}

          {/* Acciones del solicitante */}
          {canSubmit && (
            <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "20px" }}>
              <h2 style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "12px" }}>
                Acciones
              </h2>
              <div style={{ display: "flex", gap: "10px" }}>
                {canEdit && (
                  <Link
                    href={`/dashboard/requests/${pr.id}/edit`}
                    style={{ padding: "8px 16px", borderRadius: "7px", background: "var(--neutral-700)", border: "1px solid var(--border)", color: "var(--text)", fontSize: "13px", fontWeight: "500", textDecoration: "none" }}
                  >
                    ✏️ Editar
                  </Link>
                )}
                <SubmitButton requestId={pr.id} />
              </div>
            </section>
          )}
        </div>

        {/* ── Columna lateral: Timeline ── */}
        <div>
          <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "20px" }}>
            <h2 style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "16px" }}>
              Historial
            </h2>

            {pr.history.length === 0 ? (
              <p style={{ fontSize: "12px", color: "var(--muted)" }}>Sin historial aún.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                {pr.history.map((entry, idx) => {
                  const isLast = idx === pr.history.length - 1;
                  const cfg = STATUS_CONFIG[entry.toStatus];
                  return (
                    <div key={entry.id} style={{ display: "flex", gap: "12px" }}>
                      {/* Línea vertical */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{
                          width: "10px", height: "10px", borderRadius: "50%",
                          background: cfg.color, flexShrink: 0, marginTop: "3px",
                        }} />
                        {!isLast && <div style={{ width: "1px", flex: 1, background: "var(--border)", minHeight: "24px" }} />}
                      </div>
                      {/* Contenido */}
                      <div style={{ paddingBottom: isLast ? 0 : "16px", flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "6px" }}>
                          <span style={{ fontSize: "12px", fontWeight: "600", color: cfg.color }}>
                            {HISTORY_LABEL[entry.toStatus]}
                          </span>
                          {entry.actor && (
                            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                              por <strong style={{ color: "var(--neutral-300)" }}>{entry.actor.name}</strong>
                              {entry.actor.role && (
                                <span style={{ fontSize: "10px", marginLeft: "4px", color: "var(--muted)" }}>
                                  ({entry.actor.role === "REQUESTER" ? "Solicitante" : entry.actor.role === "MANAGER" ? "Jefatura" : "Finanzas"})
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        {entry.comment && (
                          <div style={{
                            marginTop: "6px", fontSize: "11px", color: "var(--neutral-300)",
                            background: "var(--neutral-800)", borderRadius: "6px",
                            padding: "6px 8px", lineHeight: "1.5",
                            borderLeft: entry.toStatus === "REJECTED" ? "3px solid #ef4444" : "3px solid var(--border)",
                          }}>
                            &ldquo;{entry.comment}&rdquo;
                          </div>
                        )}
                        <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "4px" }}>
                          {formatDate(entry.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Metadatos */}
            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "6px" }}>
              {pr.requester && <MetaRow label="Solicitante" value={pr.requester.name} />}
              <MetaRow label="Creada" value={formatDate(pr.createdAt)} />
              <MetaRow label="Actualizada" value={formatDate(pr.updatedAt)} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span style={{ color: "var(--neutral-300)" }}>{value}</span>
    </div>
  );
}

// ─── Botón de envío a aprobación (client component) ───────────────────────────
// Se importa desde un archivo separado para poder usar hooks (useRouter).
// Ver: ./SubmitButton.tsx

