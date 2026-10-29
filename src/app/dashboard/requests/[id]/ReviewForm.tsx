"use client";

/**
 * Formulario de aprobación/rechazo embebido en el detalle de solicitud.
 * HU-13 a HU-17: Aprobar o rechazar con comentario obligatorio al rechazar.
 * HU-26: Feedback y manejo de errores con Toasts y Diálogo de confirmación interactivo.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

interface ReviewFormProps {
  requestId: string;
}

export default function ReviewForm({ requestId }: ReviewFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [action, setAction] = useState<"APPROVE" | "REJECT" | "">("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  function handleOpenConfirmModal(e: React.FormEvent) {
    e.preventDefault();
    if (!action) return;

    if (action === "REJECT" && !comment.trim()) {
      setError("El comentario es obligatorio al rechazar.");
      return;
    }

    setError("");
    setShowConfirmModal(true);
  }

  async function handleConfirmReview() {
    if (!action) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/purchase-requests/${requestId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: comment.trim() || undefined }),
      });

      const data = (await res.json()) as {
        message?: string;
        error?: { message: string };
      };

      if (!res.ok) {
        const msg = data.error?.message ?? "Error al procesar la acción.";
        setError(msg);
        showToast(msg, "error");
        setShowConfirmModal(false);
        return;
      }

      setShowConfirmModal(false);
      showToast(
        action === "APPROVE"
          ? "Solicitud aprobada exitosamente."
          : "Solicitud rechazada con éxito.",
        "success"
      );

      // Refrescar la página para mostrar el nuevo estado y el timeline actualizado
      router.refresh();
    } catch {
      const connErr = "Error de conexión. Intenta de nuevo.";
      setError(connErr);
      showToast(connErr, "error");
      setShowConfirmModal(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          padding: "20px",
        }}
      >
        <h2
          style={{
            fontSize: "11px",
            fontWeight: "700",
            color: "var(--muted)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: "16px",
          }}
        >
          Revisión
        </h2>

        <form
          onSubmit={handleOpenConfirmModal}
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
          {/* Botones de acción */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => {
                setAction("APPROVE");
                setError("");
              }}
              style={{
                flex: 1,
                padding: "11px 16px",
                minHeight: "44px",
                borderRadius: "7px",
                border: `2px solid ${action === "APPROVE" ? "#22c55e" : "var(--border)"}`,
                background:
                  action === "APPROVE" ? "rgba(34,197,94,0.1)" : "var(--neutral-800)",
                color: action === "APPROVE" ? "#22c55e" : "var(--muted)",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              ✓ Aprobar
            </button>
            <button
              type="button"
              onClick={() => {
                setAction("REJECT");
                setError("");
              }}
              style={{
                flex: 1,
                padding: "11px 16px",
                minHeight: "44px",
                borderRadius: "7px",
                border: `2px solid ${action === "REJECT" ? "#ef4444" : "var(--border)"}`,
                background:
                  action === "REJECT" ? "rgba(239,68,68,0.1)" : "var(--neutral-800)",
                color: action === "REJECT" ? "#ef4444" : "var(--muted)",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              ✗ Rechazar
            </button>
          </div>

          {/* Comentario */}
          {action && (
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "var(--neutral-300)",
                }}
              >
                Comentario
                {action === "REJECT" && (
                  <span style={{ color: "#ef4444", marginLeft: "2px" }}>*</span>
                )}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  action === "REJECT"
                    ? "Explica el motivo del rechazo (obligatorio)"
                    : "Comentario opcional..."
                }
                rows={3}
                maxLength={1000}
                style={{
                  background: "var(--neutral-800)",
                  border: `1px solid ${error ? "#ef4444" : "var(--border)"}`,
                  borderRadius: "7px",
                  color: "var(--text)",
                  padding: "10px 12px",
                  fontSize: "14px",
                  resize: "vertical",
                  outline: "none",
                  minHeight: "80px",
                }}
              />
              {error && (
                <span style={{ fontSize: "11px", color: "#ef4444" }}>{error}</span>
              )}
            </div>
          )}

          {/* Botón para abrir modal de confirmación */}
          {action && (
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "11px 16px",
                minHeight: "44px",
                borderRadius: "7px",
                background:
                  action === "APPROVE"
                    ? loading
                      ? "var(--neutral-600)"
                      : "#22c55e"
                    : loading
                    ? "var(--neutral-600)"
                    : "#ef4444",
                color: "#fff",
                fontSize: "13px",
                fontWeight: "600",
                border: "none",
                cursor: loading ? "default" : "pointer",
                transition: "opacity 0.15s",
              }}
            >
              {action === "APPROVE" ? "Aprobar solicitud..." : "Rechazar solicitud..."}
            </button>
          )}
        </form>
      </section>

      {/* HU-26: Diálogo modal de confirmación al aprobar o rechazar */}
      {showConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={() => !loading && setShowConfirmModal(false)}
        >
          <div
            style={{
              background: "var(--surface)",
              border: `1px solid ${action === "APPROVE" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
              borderRadius: "12px",
              maxWidth: "460px",
              width: "100%",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background:
                    action === "APPROVE"
                      ? "rgba(34,197,94,0.15)"
                      : "rgba(239,68,68,0.15)",
                  color: action === "APPROVE" ? "#22c55e" : "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  fontWeight: "bold",
                  flexShrink: 0,
                }}
              >
                {action === "APPROVE" ? "✓" : "!"}
              </div>
              <div>
                <h3
                  style={{
                    fontSize: "17px",
                    fontWeight: "700",
                    color: "var(--text)",
                    margin: 0,
                  }}
                >
                  {action === "APPROVE"
                    ? "¿Confirmar aprobación?"
                    : "¿Confirmar rechazo de solicitud?"}
                </h3>
                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--muted)",
                    margin: "4px 0 0 0",
                  }}
                >
                  {action === "APPROVE"
                    ? "Esta acción avanzará la solicitud de acuerdo a la matriz de aprobación configurada."
                    : "La solicitud quedará rechazada de forma permanente."}
                </p>
              </div>
            </div>

            {action === "REJECT" && comment && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  borderLeft: "3px solid #ef4444",
                  padding: "10px 14px",
                  borderRadius: "4px",
                  fontSize: "13px",
                  color: "var(--neutral-200)",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#ef4444",
                    marginBottom: "4px",
                  }}
                >
                  Motivo ingresado:
                </div>
                &ldquo;{comment}&rdquo;
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "8px",
              }}
            >
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: "10px 18px",
                  borderRadius: "7px",
                  border: "1px solid var(--border)",
                  background: "var(--neutral-800)",
                  color: "var(--text)",
                  fontSize: "13px",
                  fontWeight: "500",
                  cursor: loading ? "default" : "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmReview}
                style={{
                  padding: "10px 20px",
                  borderRadius: "7px",
                  border: "none",
                  background:
                    action === "APPROVE"
                      ? loading
                        ? "var(--neutral-600)"
                        : "#22c55e"
                      : loading
                      ? "var(--neutral-600)"
                      : "#ef4444",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: loading ? "default" : "pointer",
                }}
              >
                {loading
                  ? "Procesando..."
                  : action === "APPROVE"
                  ? "Sí, aprobar"
                  : "Sí, rechazar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
