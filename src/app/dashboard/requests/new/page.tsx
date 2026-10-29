"use client";

/**
 * HU-05: Formulario para crear una nueva solicitud de compra.
 *
 * Criterios de aceptación:
 * - Cada producto tiene descripción, cantidad (entero > 0) y precio unitario (≥ 0).
 * - Se exige al menos un producto.
 * - La solicitud se guarda como BORRADOR (DRAFT).
 * - Los errores de validación se muestran junto a cada campo.
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createRequestSchema } from "@/lib/schemas/request.schema";
import type { CreateRequestInput } from "@/lib/schemas/request.schema";
import { setPendingToast } from "@/components/ToastProvider";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ItemRow {
  id: string; // clave local para React
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

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
  required,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label
        style={{
          fontSize: "12px",
          fontWeight: "600",
          color: error ? "#ef4444" : "var(--neutral-300)",
          letterSpacing: "0.03em",
        }}
      >
        {label}
        {required && <span style={{ color: "#ef4444", marginLeft: "2px" }}>*</span>}
      </label>
      {children}
      {error && (
        <span style={{ fontSize: "11px", color: "#ef4444" }}>{error}</span>
      )}
    </div>
  );
}

const inputStyle = (error?: string): React.CSSProperties => ({
  background: "var(--neutral-800)",
  border: `1px solid ${error ? "#ef4444" : "var(--border)"}`,
  borderRadius: "7px",
  color: "var(--text)",
  padding: "8px 12px",
  fontSize: "13px",
  outline: "none",
  width: "100%",
  transition: "border-color 0.15s",
});

// ─── Componente principal ─────────────────────────────────────────────────────

export default function NewRequestForm() {
  const router = useRouter();

  // Campos del formulario
  const [title, setTitle]           = useState("");
  const [description, setDesc]      = useState("");
  const [costCenter, setCostCenter] = useState("");

  // Ítems (al menos 1)
  const [items, setItems] = useState<ItemRow[]>([
    { id: crypto.randomUUID(), description: "", quantity: "", unitPrice: "" },
  ]);

  // Estado de UI
  const [errors, setErrors]     = useState<FieldErrors>({});
  const [submitting, setSubmit] = useState(false);
  const [serverError, setServerError] = useState("");

  // ── Gestión de ítems ──────────────────────────────────────────────────────

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", quantity: "", unitPrice: "" },
    ]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateItem = useCallback(
    (id: string, field: keyof Omit<ItemRow, "id">, value: string) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
      );
    },
    []
  );

  // ── Subtotal visual por ítem ───────────────────────────────────────────────

  function subtotal(item: ItemRow): string {
    const q = parseInt(item.quantity, 10);
    const p = parseInt(item.unitPrice, 10);
    if (!isNaN(q) && !isNaN(p) && q > 0 && p >= 0) {
      return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
      }).format(q * p);
    }
    return "—";
  }

  // ── Total visual ──────────────────────────────────────────────────────────

  const totalAmount = items.reduce((sum, item) => {
    const q = parseInt(item.quantity, 10);
    const p = parseInt(item.unitPrice, 10);
    return sum + (isNaN(q) || isNaN(p) ? 0 : q * p);
  }, 0);

  // ── Validación y envío ────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setServerError("");

    // Construir payload
    const payload: CreateRequestInput = {
      title: title.trim(),
      description: description.trim(),
      costCenter: costCenter.trim(),
      items: items.map((i) => ({
        description: i.description.trim(),
        quantity: parseInt(i.quantity, 10) || 0,
        unitPrice: parseInt(i.unitPrice, 10) || 0,
      })),
    };

    // Validación client-side con el mismo schema del servidor
    const parsed = createRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (!fieldErrors[path]) fieldErrors[path] = issue.message;
      }
      // Errores de ítems individuales
      const itemErrors: string[] = [];
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === "items" && typeof issue.path[1] === "number") {
          const idx = issue.path[1];
          const field = issue.path[2] as string;
          itemErrors[idx] = itemErrors[idx] || "";
          fieldErrors[`items.${idx}.${field}`] = issue.message;
        }
      }
      if (!fieldErrors["items"] && parsed.error.issues.some((i) => i.path[0] === "items" && i.path.length === 1)) {
        fieldErrors["items"] = "Debe incluir al menos un producto";
      }
      setErrors(fieldErrors);
      return;
    }

    // Enviar al servidor
    setSubmit(true);
    try {
      const res = await fetch("/api/purchase-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json() as { data?: { id: string }; error?: { message: string; details?: { field?: string; message: string }[] } };

      if (!res.ok) {
        if (data.error?.details) {
          const fieldErrors: FieldErrors = {};
          for (const d of data.error.details) {
            if (d.field) fieldErrors[d.field] = d.message;
          }
          setErrors(fieldErrors);
        }
        setServerError(data.error?.message ?? "Error al crear la solicitud.");
        return;
      }

      // Éxito → ir al detalle con toast de confirmación (HU-26)
      setPendingToast("Solicitud creada exitosamente como borrador.", "success");
      router.push(`/dashboard/requests/${data.data!.id}`);
    } catch {
      setServerError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSubmit(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="form-page-container">
      {/* CSS Responsive para HU-25 (desde 360px sin overflow, inputs táctiles cómodos) */}
      <style>{`
        .form-page-container {
          padding: 32px;
          max-width: 760px;
          width: 100%;
          box-sizing: border-box;
        }
        .items-desktop-header {
          display: grid;
          grid-template-columns: 1fr 90px 130px 100px 36px;
          gap: 8px;
          margin-bottom: 6px;
          padding: 0 4px;
        }
        .item-desktop-row {
          display: grid;
          grid-template-columns: 1fr 90px 130px 100px 36px;
          gap: 8px;
          align-items: start;
        }
        .item-mobile-card {
          display: none;
        }
        .touch-input {
          min-height: 42px;
          box-sizing: border-box;
          font-size: 14px;
        }
        @media (max-width: 640px) {
          .form-page-container {
            padding: 16px 12px;
          }
          .items-desktop-header {
            display: none;
          }
          .item-desktop-row {
            display: none;
          }
          .item-mobile-card {
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding: 14px;
            background: rgba(255,255,255,0.03);
            border: 1px solid var(--border);
            border-radius: 8px;
          }
          .btn-responsive-add {
            width: 100%;
            min-height: 44px;
            margin-top: 8px;
          }
          .btn-responsive-submit {
            width: 100% !important;
            min-height: 46px;
          }
        }
      `}</style>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <a
          href="/dashboard/requests"
          style={{
            fontSize: "12px",
            color: "var(--muted)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            marginBottom: "12px",
          }}
        >
          ← Volver
        </a>
        <h1 style={{ fontSize: "22px", fontWeight: "700", margin: 0 }}>
          Nueva solicitud de compra
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "4px" }}>
          La solicitud se guardará como <strong>borrador</strong> hasta que la envíes a aprobación.
        </p>
      </div>

      {/* Error de servidor */}
      {serverError && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#ef4444",
            fontSize: "13px",
            marginBottom: "20px",
          }}
        >
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* ── Datos generales ── */}
        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "20px",
            marginBottom: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <h2
            style={{
              fontSize: "13px",
              fontWeight: "700",
              color: "var(--muted)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Datos generales
          </h2>

          <Field label="Título" error={errors.title} required>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Compra equipos para sala de reuniones"
              style={inputStyle(errors.title)}
              maxLength={200}
            />
          </Field>

          <Field label="Descripción" error={errors.description} required>
            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Describe el propósito de la solicitud..."
              rows={3}
              style={{ ...inputStyle(errors.description), resize: "vertical" }}
              maxLength={2000}
            />
          </Field>

          <Field label="Centro de costo" error={errors.costCenter} required>
            <input
              type="text"
              value={costCenter}
              onChange={(e) => setCostCenter(e.target.value)}
              placeholder="Ej: CC-TI, CC-ADM, CC-MKT"
              style={inputStyle(errors.costCenter)}
              maxLength={100}
            />
          </Field>
        </section>

        {/* ── Productos ── */}
        <section
          style={{
            background: "var(--surface)",
            border: `1px solid ${errors.items ? "#ef4444" : "var(--border)"}`,
            borderRadius: "10px",
            padding: "20px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h2
              style={{
                fontSize: "13px",
                fontWeight: "700",
                color: errors.items ? "#ef4444" : "var(--muted)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              Productos{" "}
              <span style={{ fontWeight: "400", fontSize: "11px" }}>
                ({items.length})
              </span>
            </h2>
            <button
              type="button"
              onClick={addItem}
              className="btn-responsive-add"
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                background: "var(--neutral-700)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              + Agregar producto
            </button>
          </div>

          {errors.items && (
            <div style={{ fontSize: "11px", color: "#ef4444", marginBottom: "12px" }}>
              {errors.items}
            </div>
          )}

          {/* Cabecera de la tabla (solo en escritorio) */}
          <div className="items-desktop-header">
            {["Descripción", "Cantidad", "Precio unit.", "Subtotal", ""].map((h) => (
              <div
                key={h}
                style={{
                  fontSize: "10px",
                  fontWeight: "600",
                  color: "var(--muted)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {h}
              </div>
            ))}
          </div>

          {/* Filas de ítems */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {items.map((item, idx) => (
              <div key={item.id}>
                {/* Versión Escritorio */}
                <div className="item-desktop-row">
                  {/* Descripción */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      placeholder="Nombre del producto"
                      style={inputStyle(errors[`items.${idx}.description`])}
                      maxLength={500}
                    />
                    {errors[`items.${idx}.description`] && (
                      <span style={{ fontSize: "10px", color: "#ef4444" }}>
                        {errors[`items.${idx}.description`]}
                      </span>
                    )}
                  </div>

                  {/* Cantidad */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                      placeholder="1"
                      min="1"
                      max="1000000"
                      style={inputStyle(errors[`items.${idx}.quantity`])}
                    />
                    {errors[`items.${idx}.quantity`] && (
                      <span style={{ fontSize: "10px", color: "#ef4444" }}>
                        {errors[`items.${idx}.quantity`]}
                      </span>
                    )}
                  </div>

                  {/* Precio unitario */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                      placeholder="0"
                      min="0"
                      style={inputStyle(errors[`items.${idx}.unitPrice`])}
                    />
                    {errors[`items.${idx}.unitPrice`] && (
                      <span style={{ fontSize: "10px", color: "#ef4444" }}>
                        {errors[`items.${idx}.unitPrice`]}
                      </span>
                    )}
                  </div>

                  {/* Subtotal (calculado) */}
                  <div
                    style={{
                      padding: "8px 4px",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "var(--neutral-300)",
                      textAlign: "right",
                    }}
                  >
                    {subtotal(item)}
                  </div>

                  {/* Eliminar */}
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                    style={{
                      minWidth: "32px",
                      minHeight: "32px",
                      borderRadius: "6px",
                      background: "transparent",
                      border: "1px solid transparent",
                      color: items.length === 1 ? "var(--border)" : "var(--muted)",
                      cursor: items.length === 1 ? "default" : "pointer",
                      fontSize: "16px",
                      lineHeight: 1,
                    }}
                    title="Eliminar producto"
                  >
                    ×
                  </button>
                </div>

                {/* Versión Móvil: Tarjeta táctil (HU-25) */}
                <div className="item-mobile-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--brand-400)" }}>
                      Producto #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                      style={{
                        minWidth: "36px",
                        minHeight: "36px",
                        borderRadius: "6px",
                        background: items.length === 1 ? "transparent" : "rgba(239,68,68,0.1)",
                        border: items.length === 1 ? "none" : "1px solid rgba(239,68,68,0.3)",
                        color: items.length === 1 ? "var(--border)" : "#ef4444",
                        cursor: items.length === 1 ? "default" : "pointer",
                        fontSize: "15px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title="Eliminar producto"
                    >
                      ×
                    </button>
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px", display: "block" }}>
                      Descripción
                    </label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      placeholder="Nombre del producto"
                      className="touch-input"
                      style={inputStyle(errors[`items.${idx}.description`])}
                      maxLength={500}
                    />
                    {errors[`items.${idx}.description`] && (
                      <span style={{ fontSize: "10px", color: "#ef4444" }}>
                        {errors[`items.${idx}.description`]}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div>
                      <label style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px", display: "block" }}>
                        Cantidad
                      </label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                        placeholder="1"
                        min="1"
                        className="touch-input"
                        style={inputStyle(errors[`items.${idx}.quantity`])}
                      />
                      {errors[`items.${idx}.quantity`] && (
                        <span style={{ fontSize: "10px", color: "#ef4444" }}>
                          {errors[`items.${idx}.quantity`]}
                        </span>
                      )}
                    </div>

                    <div>
                      <label style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px", display: "block" }}>
                        Precio unitario (CLP)
                      </label>
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                        placeholder="0"
                        min="0"
                        className="touch-input"
                        style={inputStyle(errors[`items.${idx}.unitPrice`])}
                      />
                      {errors[`items.${idx}.unitPrice`] && (
                        <span style={{ fontSize: "10px", color: "#ef4444" }}>
                          {errors[`items.${idx}.unitPrice`]}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px dashed var(--border)" }}>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>Subtotal</span>
                    <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text)" }}>{subtotal(item)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div
            style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Total estimado:
            </span>
            <span style={{ fontSize: "18px", fontWeight: "700" }}>
              {new Intl.NumberFormat("es-CL", {
                style: "currency",
                currency: "CLP",
              }).format(totalAmount)}
            </span>
          </div>
        </section>

        {/* Acciones */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <a
            href="/dashboard/requests"
            className="btn-responsive-submit"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 20px",
              borderRadius: "8px",
              background: "var(--neutral-800)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              fontSize: "13px",
              fontWeight: "500",
              textDecoration: "none",
              minHeight: "42px",
            }}
          >
            Cancelar
          </a>
          <button
            type="submit"
            disabled={submitting}
            className="btn-responsive-submit"
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              background: submitting ? "var(--neutral-600)" : "var(--brand-500)",
              color: "#fff",
              fontSize: "13px",
              fontWeight: "600",
              border: "none",
              cursor: submitting ? "default" : "pointer",
              minHeight: "42px",
            }}
          >
            {submitting ? "Guardando..." : "Guardar borrador"}
          </button>
        </div>
      </form>
    </div>
  );
}

