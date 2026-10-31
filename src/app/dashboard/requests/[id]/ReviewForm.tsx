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
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8 flex flex-col gap-4">
        <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Revisión de Solicitud
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">Acción de revisor</span>
        </div>

        <form onSubmit={handleOpenConfirmModal} className="flex flex-col gap-4">
  
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setAction("APPROVE");
                setError("");
              }}
              className={`p-3.5 rounded-xl font-semibold text-xs border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                action === "APPROVE"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-400 shadow-xs ring-2 ring-emerald-200"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <span className="text-base">✓</span>
              <span>Aprobar solicitud</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAction("REJECT");
                setError("");
              }}
              className={`p-3.5 rounded-xl font-semibold text-xs border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                action === "REJECT"
                  ? "bg-red-50 text-red-700 border-red-400 shadow-xs ring-2 ring-red-200"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <span className="text-base">✕</span>
              <span>Rechazar solicitud</span>
            </button>
          </div>

          {action && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>
                  Comentario {action === "REJECT" ? <span className="text-red-500">* (Obligatorio)</span> : <span className="text-slate-400 font-normal">(Opcional)</span>}
                </span>
                <span className="text-[11px] font-normal text-slate-400">{comment.length}/1000</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  action === "REJECT"
                    ? "Explica el motivo del rechazo para que el solicitante pueda corregirlo..."
                    : "Puedes ingresar una observación o nota de aprobación (opcional)..."
                }
                rows={3}
                maxLength={1000}
                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-xs md:text-sm text-slate-800 placeholder-slate-400 outline-none transition-all resize-y focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
                  error ? "border-red-400 bg-red-50/20" : "border-slate-200/80"
                }`}
              />
              {error && <span className="text-[11px] text-red-500 font-medium">{error}</span>}
            </div>
          )}

          {action && (
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer shadow-xs ${
                action === "APPROVE"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {action === "APPROVE" ? "Continuar con aprobación..." : "Continuar con rechazo..."}
            </button>
          )}
        </form>
      </section>

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
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${
                  action === "APPROVE" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                }`}
              >
                {action === "APPROVE" ? "✓" : "!"}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {action === "APPROVE" ? "¿Confirmar aprobación?" : "¿Confirmar rechazo de solicitud?"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Esta acción quedará registrada permanentemente en el historial.
                </p>
              </div>
            </div>

            {action === "REJECT" && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                <strong>Motivo:</strong> &ldquo;{comment}&rdquo;
              </div>
            )}

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
                onClick={handleConfirmReview}
                disabled={loading}
                className={`px-4 py-2 text-white text-xs font-semibold rounded-xl transition-all ${
                  action === "APPROVE"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {loading ? "Procesando..." : action === "APPROVE" ? "Sí, aprobar" : "Sí, rechazar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
