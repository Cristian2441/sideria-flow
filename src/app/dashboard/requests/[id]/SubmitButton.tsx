"use client";

/**
 * HU-09: Botón para enviar una solicitud DRAFT a aprobación.
 * HU-26: Feedback visual con Toast y diálogo modal de confirmación.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

interface SubmitButtonProps {
  requestId: string;
}

export default function SubmitButton({ requestId }: SubmitButtonProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  async function handleConfirmSubmit() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/purchase-requests/${requestId}/submit`, {
        method: "POST",
      });

      const data = (await res.json()) as { error?: { message: string } };

      if (!res.ok) {
        const msg = data.error?.message ?? "Error al enviar la solicitud.";
        setError(msg);
        showToast(msg, "error");
        setShowConfirmModal(false);
        return;
      }

      setShowConfirmModal(false);
      showToast("Solicitud enviada a aprobación exitosamente.", "success");

      // Recarga la página para reflejar el nuevo estado (PENDING_MANAGER)
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
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <button
          onClick={() => setShowConfirmModal(true)}
          disabled={loading}
          style={{
            padding: "11px 20px",
            minHeight: "42px",
            borderRadius: "7px",
            background: loading ? "var(--neutral-600)" : "var(--brand-500)",
            color: "#fff",
            fontSize: "13px",
            fontWeight: "600",
            border: "none",
            cursor: loading ? "default" : "pointer",
            transition: "background 0.15s",
          }}
        >
          🚀 Enviar a aprobación
        </button>
        {error && (
          <span style={{ fontSize: "11px", color: "#ef4444" }}>{error}</span>
        )}
      </div>

      {/* Diálogo modal de confirmación antes de enviar */}
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
              border: "1px solid rgba(59,92,245,0.4)",
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
                  background: "rgba(59,92,245,0.15)",
                  color: "var(--brand-400)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  flexShrink: 0,
                }}
              >
                🚀
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
                  ¿Enviar solicitud a aprobación?
                </h3>
                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--muted)",
                    margin: "4px 0 0 0",
                  }}
                >
                  Una vez enviada, la solicitud pasará a revisión de jefatura y no podrá volver a modificarse.
                </p>
              </div>
            </div>

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
                onClick={handleConfirmSubmit}
                style={{
                  padding: "10px 20px",
                  borderRadius: "7px",
                  border: "none",
                  background: loading ? "var(--neutral-600)" : "var(--brand-500)",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: loading ? "default" : "pointer",
                }}
              >
                {loading ? "Enviando..." : "Sí, enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
