/**
 * HU-18: Bandeja de pendientes de aprobación.
 *
 * Como aprobador (MANAGER o FINANCE):
 * - Muestra la lista de aprobaciones pendientes directamente.
 * - Excluye las solicitudes propias del usuario en sesión (prohibición de autoaprobación).
 * - MANAGER: solicitudes en PENDING_MANAGER (donde requesterId !== userId).
 * - FINANCE: solicitudes en PENDING_FINANCE (donde requesterId !== userId).
 * - Enlace directo a revisar cada solicitud.
 * - Tabla en escritorio y tarjetas en móvil.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/prisma/db";
import Link from "next/link";
import type { PurchaseRequestStatus, UserRole } from "@/lib/types";
import { APPROVAL_THRESHOLD } from "@/lib/types";

// ─── Helpers visuales ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  PurchaseRequestStatus,
  { label: string; color: string; bg: string }
> = {
  DRAFT:           { label: "Borrador",         color: "#a1a1aa", bg: "rgba(161,161,170,0.12)" },
  PENDING_MANAGER: { label: "En jefatura",      color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  PENDING_FINANCE: { label: "En finanzas",      color: "#06b6d4", bg: "rgba(6,182,212,0.12)"   },
  APPROVED:        { label: "Aprobada",         color: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
  REJECTED:        { label: "Rechazada",        color: "#ef4444", bg: "rgba(239,68,68,0.12)"   },
};

function StatusBadge({ status }: { status: PurchaseRequestStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 10px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: "600",
        letterSpacing: "0.02em",
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.color}33`,
        whiteSpace: "nowrap",
      }}
    >
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

// ─── Página ──────────────────────────────────────────────────────────────────

export default async function PendingInboxPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const role = session.role as UserRole;

  // Solo aprobadores (MANAGER y FINANCE) tienen bandeja de pendientes
  if (role !== "MANAGER" && role !== "FINANCE") {
    redirect("/dashboard/requests");
  }

  const targetStatus = role === "MANAGER" ? "PENDING_MANAGER" : "PENDING_FINANCE";

  // Cargar solicitudes en el estado correspondiente a este rol
  const allInStatus = await db.orm.public.PurchaseRequest
    .where((r) => r.companyId.eq(session.companyId))
    .where((r) => r.status.eq(targetStatus))
    .select(
      "id", "title", "description", "costCenter", "status",
      "totalAmount", "source", "requesterId", "companyId",
      "createdAt", "updatedAt"
    )
    .all();

  // HU-18: Excluir estrictamente las solicitudes propias
  const pendingRequests = allInStatus.filter((r) => r.requesterId !== session.userId);

  // Ordenar por fecha de creación descendente (más recientes primero)
  pendingRequests.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // Cargar usuarios de la empresa para resolver el nombre del solicitante
  const users = await db.orm.public.User
    .where((u) => u.companyId.eq(session.companyId))
    .select("id", "name", "email", "role")
    .all();

  const userMap = new Map(users.map((u) => [u.id, u]));

  return (
    <div className="pending-container">
      <style>{`
        .pending-container {
          padding: 24px;
          max-width: 1100px;
          width: 100%;
          box-sizing: border-box;
        }
        .inbox-table { display: table; width: 100%; }
        .inbox-cards { display: none; }
        @media (max-width: 640px) {
          .pending-container {
            padding: 16px 12px;
          }
          .inbox-table { display: none; }
          .inbox-cards { display: flex; flex-direction: column; gap: 12px; }
        }
      `}</style>

      {/* Breadcrumb */}
      <Link
        href="/dashboard/requests"
        style={{ fontSize: "12px", color: "var(--muted)", textDecoration: "none" }}
      >
        ← Volver a todas las solicitudes
      </Link>

      {/* Header */}
      <div style={{ marginTop: "16px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "22px", fontWeight: "700", margin: 0 }}>
            📥 Bandeja de pendientes de aprobación
          </h1>
          <span
            style={{
              padding: "2px 10px",
              borderRadius: "999px",
              background: pendingRequests.length > 0 ? "rgba(245,158,11,0.15)" : "rgba(34,197,94,0.15)",
              color: pendingRequests.length > 0 ? "#f59e0b" : "#22c55e",
              border: `1px solid ${pendingRequests.length > 0 ? "rgba(245,158,11,0.4)" : "rgba(34,197,94,0.4)"}`,
              fontSize: "12px",
              fontWeight: "700",
            }}
          >
            {pendingRequests.length} pendiente{pendingRequests.length !== 1 ? "s" : ""}
          </span>
        </div>
        <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "6px", marginBottom: 0 }}>
          {role === "MANAGER"
            ? "Solicitudes en primera etapa enviadas por tu equipo. Solicitudes ≤ $500.000 se aprueban definitivamente; mayores a $500.000 se derivan a Finanzas."
            : "Solicitudes de monto alto (> $500.000 CLP) previamente aprobadas por jefatura en espera de aprobación financiera."}
        </p>
      </div>

      {/* Contenido de la bandeja */}
      {pendingRequests.length === 0 ? (
        <div
          style={{
            background: "var(--surface)",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            padding: "60px 20px",
            textAlign: "center",
            color: "var(--muted)",
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>🎉</div>
          <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text)" }}>
            ¡Bandeja al día!
          </div>
          <div style={{ fontSize: "13px", marginTop: "6px" }}>
            No tienes solicitudes pendientes de tu aprobación en este momento.
          </div>
          <Link
            href="/dashboard/requests"
            style={{
              display: "inline-block",
              marginTop: "16px",
              fontSize: "12px",
              color: "var(--brand-400)",
              textDecoration: "none",
            }}
          >
            Ver historial de solicitudes →
          </Link>
        </div>
      ) : (
        <>
          {/* ── Vista Tabla (Escritorio) ── */}
          <div
            className="inbox-table"
            style={{
              background: "var(--surface)",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  {["Título y Solicitante", "Centro de costo", "Monto", "Estado", "Fecha", "Acción"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: "11px 16px",
                          textAlign: "left",
                          fontSize: "11px",
                          fontWeight: "600",
                          color: "var(--muted)",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((req, i) => {
                  const requester = userMap.get(req.requesterId);
                  const isHigh = req.totalAmount > APPROVAL_THRESHOLD;
                  return (
                    <tr
                      key={req.id}
                      style={{
                        borderBottom:
                          i < pendingRequests.length - 1 ? "1px solid var(--border)" : "none",
                        background: "rgba(245,158,11,0.03)",
                        borderLeft: "3px solid #f59e0b",
                      }}
                    >
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: "600", fontSize: "13px", color: "var(--text)" }}>
                          {req.title}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                          Solicitado por:{" "}
                          <strong style={{ color: "var(--neutral-300)" }}>
                            {requester?.name ?? "Usuario"}
                          </strong>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", color: "var(--muted)", fontSize: "13px" }}>
                        {req.costCenter}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: "14px", fontWeight: "700" }}>
                          {formatCLP(req.totalAmount)}
                        </div>
                        {isHigh && (
                          <div style={{ fontSize: "10px", color: "var(--brand-400)", marginTop: "2px" }}>
                            {role === "MANAGER" ? "↑ Pasará a finanzas" : "Requiere finanzas"}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <StatusBadge status={req.status as PurchaseRequestStatus} />
                      </td>
                      <td style={{ padding: "14px 16px", color: "var(--muted)", fontSize: "12px" }}>
                        {formatDate(req.createdAt)}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <Link
                          href={`/dashboard/requests/${req.id}`}
                          style={{
                            display: "inline-block",
                            padding: "6px 14px",
                            borderRadius: "6px",
                            background: "var(--brand-500)",
                            color: "#fff",
                            fontSize: "12px",
                            fontWeight: "600",
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                          }}
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

          {/* ── Vista Tarjetas (Móvil) ── */}
          <div className="inbox-cards">
            {pendingRequests.map((req) => {
              const requester = userMap.get(req.requesterId);
              const isHigh = req.totalAmount > APPROVAL_THRESHOLD;
              return (
                <div
                  key={req.id}
                  style={{
                    background: "var(--surface)",
                    borderRadius: "10px",
                    border: "1px solid rgba(245,158,11,0.3)",
                    borderLeft: "4px solid #f59e0b",
                    padding: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "8px",
                      marginBottom: "6px",
                    }}
                  >
                    <span style={{ fontWeight: "600", fontSize: "14px", color: "var(--text)" }}>
                      {req.title}
                    </span>
                    <StatusBadge status={req.status as PurchaseRequestStatus} />
                  </div>

                  <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "10px" }}>
                    Por: <strong style={{ color: "var(--neutral-300)" }}>{requester?.name ?? "Usuario"}</strong> • {req.costCenter}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingTop: "10px",
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: "700" }}>
                        {formatCLP(req.totalAmount)}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                        {formatDate(req.createdAt)}
                      </div>
                    </div>

                    <Link
                      href={`/dashboard/requests/${req.id}`}
                      style={{
                        padding: "7px 16px",
                        borderRadius: "7px",
                        background: "var(--brand-500)",
                        color: "#fff",
                        fontSize: "12px",
                        fontWeight: "600",
                        textDecoration: "none",
                      }}
                    >
                      Revisar →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
