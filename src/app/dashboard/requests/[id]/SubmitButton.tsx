"use client";

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
      <div className="flex flex-col gap-1.5">
        <button
          onClick={() => setShowConfirmModal(true)}
          disabled={loading}
          className="px-4 py-2.5 bg-[#0066ff] hover:bg-blue-600 disabled:bg-blue-300 text-white text-xs font-semibold rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
        >
          <span></span> Enviar a aprobación
        </button>
        {error && <span className="text-[11px] text-red-500 font-medium">{error}</span>}
      </div>

      {showConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          onClick={() => !loading && setShowConfirmModal(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg bg-blue-100 text-blue-700 shrink-0">
                
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  ¿Enviar a aprobación?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Una vez enviada, la solicitud pasará a revisión de tu jefatura y no podrá ser editada.
                </p>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={loading}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={loading}
                className="px-4 py-2 bg-[#0066ff] hover:bg-blue-600 text-white text-xs font-semibold rounded-xl transition-all"
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
