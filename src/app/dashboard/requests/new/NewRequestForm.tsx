"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createRequestSchema } from "@/lib/schemas/request.schema";
import type { CreateRequestInput } from "@/lib/schemas/request.schema";
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

interface NewRequestFormProps {
  costCenters?: string[];
}

export default function NewRequestForm({
  costCenters = ["CC-TI", "CC-VENTAS", "CC-OPERACIONES", "CC-FINANZAS", "CC-RRHH", "CC-ADMIN"],
}: NewRequestFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDesc] = useState("");
  const [costCenter, setCostCenter] = useState("");

  const [items, setItems] = useState<ItemRow[]>([
    { id: crypto.randomUUID(), description: "", quantity: "", unitPrice: "" },
  ]);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmit] = useState(false);
  const [serverError, setServerError] = useState("");

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

  function subtotal(item: ItemRow): string {
    const q = parseInt(item.quantity, 10);
    const p = parseInt(item.unitPrice, 10);
    if (!isNaN(q) && !isNaN(p) && q > 0 && p > 0) {
      return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
      }).format(q * p);
    }
    return "—";
  }

  const totalAmount = items.reduce((sum, item) => {
    const q = parseInt(item.quantity, 10);
    const p = parseInt(item.unitPrice, 10);
    return sum + (isNaN(q) || isNaN(p) || q <= 0 || p <= 0 ? 0 : q * p);
  }, 0);

  function formatCLP(amount: number) {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(amount);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setServerError("");

    const fieldErrors: FieldErrors = {};

    // Validación previa explícita de precio y cantidad
    items.forEach((item, idx) => {
      const q = parseInt(item.quantity, 10);
      const p = parseInt(item.unitPrice, 10);

      if (!item.quantity || isNaN(q) || q < 1) {
        fieldErrors[`items.${idx}.quantity`] = "La cantidad debe ser al menos 1";
      }
      if (!item.unitPrice || isNaN(p) || p < 1) {
        fieldErrors[`items.${idx}.unitPrice`] = "El precio debe ser mayor a 0 (mínimo $1 CLP)";
      }
    });

    if (totalAmount <= 0) {
      fieldErrors["items"] = "El monto total de la solicitud debe ser mayor a $0 CLP";
    }

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

    const parsed = createRequestSchema.safeParse(payload);
    if (!parsed.success || Object.keys(fieldErrors).length > 0) {
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const path = issue.path.join(".");
          if (!fieldErrors[path]) fieldErrors[path] = issue.message;
        }
        for (const issue of parsed.error.issues) {
          if (issue.path[0] === "items" && typeof issue.path[1] === "number") {
            const idx = issue.path[1];
            const field = issue.path[2] as string;
            fieldErrors[`items.${idx}.${field}`] = issue.message;
          }
        }
        if (!fieldErrors["items"] && parsed.error.issues.some((i) => i.path[0] === "items" && i.path.length === 1)) {
          fieldErrors["items"] = "Debe incluir al menos un producto con precio válido";
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmit(true);
    try {
      const res = await fetch("/api/purchase-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as {
        data?: { id: string };
        error?: { message: string; details?: { field?: string; message: string }[] };
      };

      if (!res.ok) {
        if (data.error?.details) {
          const srvFieldErrors: FieldErrors = {};
          for (const d of data.error.details) {
            if (d.field) srvFieldErrors[d.field] = d.message;
          }
          setErrors(srvFieldErrors);
        }
        setServerError(data.error?.message ?? "Error al crear la solicitud.");
        return;
      }

      setPendingToast("Solicitud creada exitosamente como borrador.", "success");
      router.push(`/dashboard/requests/${data.data!.id}`);
    } catch {
      setServerError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSubmit(false);
    }
  }

  return (
    <div className="w-full max-w-[1240px] mx-auto flex flex-col gap-6">

      <div className="flex flex-col gap-2">
        <Link
          href="/dashboard/requests"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors w-fit font-medium"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver a solicitudes
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Nueva solicitud de compra
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              La solicitud se guardará inicialmente como <strong>Borrador</strong>. Podrás editarla o enviarla a aprobación cuando esté completa.
            </p>
          </div>
        </div>
      </div>

      {serverError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium flex items-center gap-2">
          <span className="text-base">⚠️</span>
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
       
        <div className="lg:col-span-2 flex flex-col gap-6">
     
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Datos generales
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">* Campos obligatorios</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Título <span className="text-red-500">*</span></span>
                <span className="text-[11px] font-normal text-slate-400">{title.length}/200</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Licencias anuales de software de desarrollo"
                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-xs md:text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
                  errors.title ? "border-red-400 bg-red-50/20" : "border-slate-200/80"
                }`}
                maxLength={200}
              />
              {errors.title && <p className="text-[11px] text-red-500 font-medium">{errors.title}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Centro de costo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                list="cost-centers-list"
                value={costCenter}
                onChange={(e) => setCostCenter(e.target.value)}
                placeholder="Ej: CC-TI, CC-VENTAS, CC-OPERACIONES..."
                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-xs md:text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
                  errors.costCenter ? "border-red-400 bg-red-50/20" : "border-slate-200/80"
                }`}
                maxLength={100}
              />
              <datalist id="cost-centers-list">
                {costCenters.map((cc) => (
                  <option key={cc} value={cc} />
                ))}
              </datalist>
              {errors.costCenter && <p className="text-[11px] text-red-500 font-medium">{errors.costCenter}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Descripción <span className="text-red-500">*</span></span>
                <span className="text-[11px] font-normal text-slate-400">{description.length}/2000</span>
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Describe el propósito y detalles de la solicitud de compra..."
                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-xs md:text-sm text-slate-800 placeholder-slate-400 outline-none transition-all resize-y focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
                  errors.description ? "border-red-400 bg-red-50/20" : "border-slate-200/80"
                }`}
                maxLength={2000}
              />
              {errors.description && <p className="text-[11px] text-red-500 font-medium">{errors.description}</p>}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Productos ({items.length})
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Ingresa los productos o servicios que componen esta compra.</p>
              </div>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                <span className="text-sm font-bold leading-none">+</span> Agregar producto
              </button>
            </div>

            {errors.items && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium">
                {errors.items}
              </div>
            )}

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 pr-3">Descripción</th>
                    <th className="pb-3 px-3 w-28">Cantidad</th>
                    <th className="pb-3 px-3 w-36">Precio Unit. ($)</th>
                    <th className="pb-3 px-3 w-32 text-right">Subtotal</th>
                    <th className="pb-3 pl-3 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="group">
                      <td className="py-3 pr-3 align-top">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(item.id, "description", e.target.value)}
                          placeholder="Nombre del producto o servicio"
                          className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
                            errors[`items.${idx}.description`] ? "border-red-400 bg-red-50/20" : "border-slate-200/80"
                          }`}
                          maxLength={500}
                        />
                        {errors[`items.${idx}.description`] && (
                          <span className="text-[10px] text-red-500 block mt-1 font-medium">
                            {errors[`items.${idx}.description`]}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top">
                        <input
                          type="number"
                          min="1"
                          max="1000000"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                          placeholder="1"
                          className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
                            errors[`items.${idx}.quantity`] ? "border-red-400 bg-red-50/20" : "border-slate-200/80"
                          }`}
                        />
                        {errors[`items.${idx}.quantity`] && (
                          <span className="text-[10px] text-red-500 block mt-1 font-medium">
                            {errors[`items.${idx}.quantity`]}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top">
                        <input
                          type="number"
                          min="1"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                          placeholder="Ej: 1000"
                          className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none transition-all focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
                            errors[`items.${idx}.unitPrice`] ? "border-red-400 bg-red-50/20" : "border-slate-200/80"
                          }`}
                        />
                        {errors[`items.${idx}.unitPrice`] && (
                          <span className="text-[10px] text-red-500 block mt-1 font-medium">
                            {errors[`items.${idx}.unitPrice`]}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top text-right text-xs font-semibold text-slate-700 whitespace-nowrap pt-4">
                        {subtotal(item)}
                      </td>
                      <td className="py-3 pl-3 align-top text-center pt-2">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={items.length === 1}
                          title={items.length === 1 ? "Debe haber al menos un producto" : "Eliminar producto"}
                          className={`p-2 rounded-xl text-xs transition-colors ${
                            items.length === 1
                              ? "text-slate-300 cursor-not-allowed"
                              : "text-slate-400 hover:text-red-500 hover:bg-red-50 cursor-pointer"
                          }`}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex md:hidden flex-col gap-4">
              {items.map((item, idx) => (
                <div key={item.id} className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                    <span className="text-xs font-bold text-slate-700">Producto #{idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-xs text-red-500 hover:underline font-medium"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-slate-600">Descripción</label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      placeholder="Nombre del producto"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                    {errors[`items.${idx}.description`] && (
                      <span className="text-[10px] text-red-500 font-medium">
                        {errors[`items.${idx}.description`]}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-slate-600">Cantidad</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                        placeholder="1"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                      />
                      {errors[`items.${idx}.quantity`] && (
                        <span className="text-[10px] text-red-500 font-medium">
                          {errors[`items.${idx}.quantity`]}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-slate-600">Precio unit. ($)</label>
                      <input
                        type="number"
                        min="1"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                        placeholder="Ej: 1000"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                      />
                      {errors[`items.${idx}.unitPrice`] && (
                        <span className="text-[10px] text-red-500 font-medium">
                          {errors[`items.${idx}.unitPrice`]}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <span className="text-xs text-slate-500 font-medium">Subtotal</span>
                    <span className="text-xs font-bold text-slate-800">{subtotal(item)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="lg:col-span-1 lg:sticky lg:top-6 flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 pb-3 border-b border-slate-100">
              Resumen de la solicitud
            </h2>

            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total estimado</span>
              <div className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-1">
                {formatCLP(totalAmount)}
              </div>
              {totalAmount > 500000 ? (
                <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] font-medium text-amber-800 text-left">
                  ⚠️ <strong>Supera los $500.000:</strong> Requerirá aprobación de Jefatura y Finanzas.
                </div>
              ) : (
                <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200/80 rounded-xl text-[11px] font-medium text-blue-800 text-left">
                  ℹ️ <strong>Hasta $500.000:</strong> Se aprueba directamente con Jefatura.
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 text-xs text-slate-600">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400">Total de productos</span>
                <span className="font-semibold text-slate-800">{items.length}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400">Estado inicial</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                  BORRADOR
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Moneda</span>
                <span className="font-semibold text-slate-800">CLP ($)</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-[#0066ff] hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>Guardar borrador</span>
                )}
              </button>

              <Link
                href="/dashboard/requests"
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl text-center transition-all"
              >
                Cancelar
              </Link>
            </div>
          </div>

          <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-2xl text-[11px] text-blue-900 leading-relaxed">
            <p className="font-semibold mb-1">💡 Flujo de solicitud:</p>
            Al guardar, la solicitud queda como borrador. En la vista de detalle podrás revisarla minuciosamente antes de enviarla a revisión.
          </div>
        </aside>
      </form>
    </div>
  );
}
