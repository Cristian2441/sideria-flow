"use client";

/**
 * HU-08: Editar una solicitud en estado DRAFT.
 * Carga los datos actuales y permite modificar título, descripción,
 * centro de costo e ítems. Los errores se muestran junto a cada campo.
 */

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateRequestSchema } from "@/lib/schemas/request.schema";
import { setPendingToast } from "@/components/ToastProvider";

interface ItemRow {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

interface FieldErrors {
  title?: string;
  description?: string;
  costCenter?: string;
  items?: string;
  [key: string]: string | undefined;
}

function Field({ label, error, children, required }: { label: string; error?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label style={{ fontSize: "12px", fontWeight: "600", color: error ? "#ef4444" : "var(--neutral-300)", letterSpacing: "0.03em" }}>
        {label}{required && <span style={{ color: "#ef4444", marginLeft: "2px" }}>*</span>}
      </label>
      {children}
      {error && <span style={{ fontSize: "11px", color: "#ef4444" }}>{error}</span>}
    </div>
  );
}

const inp = (err?: string): React.CSSProperties => ({
  background: "var(--neutral-800)",
  border: `1px solid ${err ? "#ef4444" : "var(--border)"}`,
  borderRadius: "7px",
  color: "var(--text)",
  padding: "8px 12px",
  fontSize: "13px",
  outline: "none",
  width: "100%",
});

export default function EditRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [requestId, setRequestId] = useState("");
  const [loading, setLoading]     = useState(true);
  const [title, setTitle]         = useState("");
  const [description, setDesc]    = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [items, setItems]         = useState<ItemRow[]>([]);
  const [errors, setErrors]       = useState<FieldErrors>({});
  const [submitting, setSubmit]   = useState(false);
  const [serverError, setServerError] = useState("");

  // Resolver params y cargar datos
  useEffect(() => {
    params.then(({ id }) => {
      setRequestId(id);
      fetch(`/api/purchase-requests/${id}`)
        .then((r) => r.json())
        .then((data: { data?: { title: string; description: string; costCenter: string; status: string; items: { id: string; description: string; quantity: number; unitPrice: number }[] } }) => {
          if (!data.data) { router.push("/dashboard/requests"); return; }
          if (data.data.status !== "DRAFT") { router.push(`/dashboard/requests/${id}`); return; }
          setTitle(data.data.title);
          setDesc(data.data.description);
          setCostCenter(data.data.costCenter);
          setItems(data.data.items.map((i) => ({
            id: crypto.randomUUID(),
            description: i.description,
            quantity: String(i.quantity),
            unitPrice: String(i.unitPrice),
          })));
          setLoading(false);
        })
        .catch(() => router.push("/dashboard/requests"));
    });
  }, [params, router]);

  const addItem    = useCallback(() => setItems((p) => [...p, { id: crypto.randomUUID(), description: "", quantity: "", unitPrice: "" }]), []);
  const removeItem = useCallback((id: string) => setItems((p) => p.filter((i) => i.id !== id)), []);
  const updateItem = useCallback((id: string, field: keyof Omit<ItemRow, "id">, value: string) =>
    setItems((p) => p.map((i) => i.id === id ? { ...i, [field]: value } : i)), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setServerError("");

    const payload = {
      title: title.trim(),
      description: description.trim(),
      costCenter: costCenter.trim(),
      items: items.map((i) => ({
        description: i.description.trim(),
        quantity: parseInt(i.quantity, 10) || 0,
        unitPrice: parseInt(i.unitPrice, 10) || 0,
      })),
    };

    const parsed = updateRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const fe: FieldErrors = {};
      for (const iss of parsed.error.issues) {
        const p = iss.path.join(".");
        if (!fe[p]) fe[p] = iss.message;
      }
      setErrors(fe);
      return;
    }

    setSubmit(true);
    try {
      const res = await fetch(`/api/purchase-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { error?: { message: string } };
      if (!res.ok) { setServerError(data.error?.message ?? "Error al guardar."); return; }
      setPendingToast("Solicitud actualizada exitosamente.", "success");
      router.push(`/dashboard/requests/${requestId}`);
    } catch {
      setServerError("Error de conexión.");
    } finally {
      setSubmit(false);
    }
  }

  if (loading) return <div style={{ padding: "32px", color: "var(--muted)" }}>Cargando...</div>;

  const totalAmount = items.reduce((s, i) => {
    const q = parseInt(i.quantity, 10); const p = parseInt(i.unitPrice, 10);
    return s + (isNaN(q) || isNaN(p) ? 0 : q * p);
  }, 0);

  return (
    <div className="edit-page-container">
      <style>{`
        .edit-page-container {
          padding: 32px;
          max-width: 760px;
          width: 100%;
          box-sizing: border-box;
        }
        .edit-desktop-row {
          display: grid;
          grid-template-columns: 1fr 90px 130px 36px;
          gap: 8px;
          align-items: start;
        }
        .edit-mobile-card {
          display: none;
        }
        @media (max-width: 640px) {
          .edit-page-container {
            padding: 16px 12px;
          }
          .edit-desktop-row {
            display: none;
          }
          .edit-mobile-card {
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding: 14px;
            background: rgba(255,255,255,0.03);
            border: 1px solid var(--border);
            border-radius: 8px;
          }
          .edit-submit-btn {
            width: 100% !important;
            min-height: 44px;
          }
        }
      `}</style>
      <a href={`/dashboard/requests/${requestId}`} style={{ fontSize: "12px", color: "var(--muted)", textDecoration: "none", marginBottom: "12px", display: "block" }}>← Cancelar</a>
      <h1 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "8px" }}>Editar solicitud</h1>
      <p style={{ color: "var(--muted)", fontSize: "13px", marginBottom: "24px" }}>Solo se pueden editar solicitudes en estado <strong>Borrador</strong>.</p>

      {serverError && (
        <div style={{ padding: "12px 16px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: "13px", marginBottom: "20px" }}>
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "20px", marginBottom: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <Field label="Título" error={errors.title} required>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={inp(errors.title)} maxLength={200} />
          </Field>
          <Field label="Descripción" error={errors.description} required>
            <textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={3} style={{ ...inp(errors.description), resize: "vertical" }} maxLength={2000} />
          </Field>
          <Field label="Centro de costo" error={errors.costCenter} required>
            <input type="text" value={costCenter} onChange={(e) => setCostCenter(e.target.value)} style={inp(errors.costCenter)} maxLength={100} />
          </Field>
        </section>

        <section style={{ background: "var(--surface)", border: `1px solid ${errors.items ? "#ef4444" : "var(--border)"}`, borderRadius: "10px", padding: "20px", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Productos ({items.length})</span>
            <button type="button" onClick={addItem} style={{ padding: "7px 14px", borderRadius: "6px", background: "var(--neutral-700)", border: "1px solid var(--border)", color: "var(--text)", fontSize: "12px", fontWeight: "600", cursor: "pointer", minHeight: "36px" }}>+ Agregar</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {items.map((item, idx) => (
              <div key={item.id}>
                {/* Desktop */}
                <div className="edit-desktop-row">
                  <div>
                    <input type="text" value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} placeholder="Descripción" style={inp(errors[`items.${idx}.description`])} maxLength={500} />
                    {errors[`items.${idx}.description`] && <span style={{ fontSize: "10px", color: "#ef4444" }}>{errors[`items.${idx}.description`]}</span>}
                  </div>
                  <div>
                    <input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", e.target.value)} placeholder="Cant." min="1" style={inp(errors[`items.${idx}.quantity`])} />
                  </div>
                  <div>
                    <input type="number" value={item.unitPrice} onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)} placeholder="Precio" min="0" style={inp(errors[`items.${idx}.unitPrice`])} />
                  </div>
                  <button type="button" onClick={() => removeItem(item.id)} disabled={items.length === 1} style={{ minWidth: "32px", minHeight: "32px", borderRadius: "6px", background: "transparent", border: "none", color: items.length === 1 ? "var(--border)" : "var(--muted)", cursor: items.length === 1 ? "default" : "pointer", fontSize: "16px" }}>×</button>
                </div>

                {/* Mobile Card */}
                <div className="edit-mobile-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--brand-400)" }}>Producto #{idx + 1}</span>
                    <button type="button" onClick={() => removeItem(item.id)} disabled={items.length === 1} style={{ minWidth: "36px", minHeight: "36px", borderRadius: "6px", background: items.length === 1 ? "transparent" : "rgba(239,68,68,0.1)", border: items.length === 1 ? "none" : "1px solid rgba(239,68,68,0.3)", color: items.length === 1 ? "var(--border)" : "#ef4444", cursor: items.length === 1 ? "default" : "pointer", fontSize: "15px" }}>×</button>
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px", display: "block" }}>Descripción</label>
                    <input type="text" value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} placeholder="Descripción" style={{ ...inp(errors[`items.${idx}.description`]), minHeight: "42px" }} maxLength={500} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div>
                      <label style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px", display: "block" }}>Cantidad</label>
                      <input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", e.target.value)} placeholder="Cant." min="1" style={{ ...inp(errors[`items.${idx}.quantity`]), minHeight: "42px" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px", display: "block" }}>Precio unitario</label>
                      <input type="number" value={item.unitPrice} onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)} placeholder="Precio" min="0" style={{ ...inp(errors[`items.${idx}.unitPrice`]), minHeight: "42px" }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: "12px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>Total estimado:</span>
            <span style={{ fontSize: "18px", fontWeight: "700" }}>{new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(totalAmount)}</span>
          </div>
        </section>

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <a href={`/dashboard/requests/${requestId}`} className="edit-submit-btn" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 20px", borderRadius: "8px", background: "var(--neutral-800)", border: "1px solid var(--border)", color: "var(--text)", fontSize: "13px", fontWeight: "500", textDecoration: "none", minHeight: "42px" }}>Cancelar</a>
          <button type="submit" disabled={submitting} className="edit-submit-btn" style={{ padding: "10px 24px", borderRadius: "8px", background: submitting ? "var(--neutral-600)" : "var(--brand-500)", color: "#fff", fontSize: "13px", fontWeight: "600", border: "none", cursor: submitting ? "default" : "pointer", minHeight: "42px" }}>
            {submitting ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}

