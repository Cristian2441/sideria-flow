"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

export default function EditRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [requestId, setRequestId] = useState("");
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDesc] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmit] = useState(false);
  const [serverError, setServerError] = useState("");

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

  const addItem = useCallback(() => setItems((p) => [...p, { id: crypto.randomUUID(), description: "", quantity: "", unitPrice: "" }]), []);
  const removeItem = useCallback((id: string) => setItems((p) => p.filter((i) => i.id !== id)), []);
  const updateItem = useCallback((id: string, field: keyof Omit<ItemRow, "id">, value: string) =>
    setItems((p) => p.map((i) => i.id === id ? { ...i, [field]: value } : i)), []);

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

  const totalAmount = items.reduce((s, i) => {
    const q = parseInt(i.quantity, 10);
    const p = parseInt(i.unitPrice, 10);
    return s + (isNaN(q) || isNaN(p) || q <= 0 || p <= 0 ? 0 : q * p);
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

    const fe: FieldErrors = {};

    items.forEach((item, idx) => {
      const q = parseInt(item.quantity, 10);
      const p = parseInt(item.unitPrice, 10);

      if (!item.quantity || isNaN(q) || q < 1) {
        fe[`items.${idx}.quantity`] = "La cantidad debe ser al menos 1";
      }
      if (!item.unitPrice || isNaN(p) || p < 1) {
        fe[`items.${idx}.unitPrice`] = "El precio debe ser mayor a 0 (mínimo $1 CLP)";
      }
    });

    if (totalAmount <= 0) {
      fe["items"] = "El monto total de la solicitud debe ser mayor a $0 CLP";
    }

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
    if (!parsed.success || Object.keys(fe).length > 0) {
      if (!parsed.success) {
        for (const iss of parsed.error.issues) {
          const p = iss.path.join(".");
          if (!fe[p]) fe[p] = iss.message;
        }
        for (const iss of parsed.error.issues) {
          if (iss.path[0] === "items" && typeof iss.path[1] === "number") {
            const idx = iss.path[1];
            const field = iss.path[2] as string;
            fe[`items.${idx}.${field}`] = iss.message;
          }
        }
        if (!fe["items"] && parsed.error.issues.some((i) => i.path[0] === "items" && i.path.length === 1)) {
          fe["items"] = "Debe incluir al menos un producto con precio válido";
        }
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
      const data = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        setServerError(data.error?.message ?? "Error al guardar los cambios.");
        return;
      }
      setPendingToast("Solicitud actualizada exitosamente.", "success");
      router.push(`/dashboard/requests/${requestId}`);
    } catch {
      setServerError("Error de conexión al guardar.");
    } finally {
      setSubmit(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full max-w-[1240px] mx-auto p-8 text-center text-slate-400">
        Cargando solicitud...
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1240px] mx-auto flex flex-col gap-6">

      <div className="flex flex-col gap-2">
        <Link
          href={`/dashboard/requests/${requestId}`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors w-fit font-medium"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver al detalle
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Editar solicitud de compra
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Solo puedes modificar solicitudes que se encuentren en estado <strong>Borrador</strong>.
          </p>
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
                value={costCenter}
                onChange={(e) => setCostCenter(e.target.value)}
                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-xs md:text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
                  errors.costCenter ? "border-red-400 bg-red-50/20" : "border-slate-200/80"
                }`}
                maxLength={100}
              />
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
                <p className="text-[11px] text-slate-400 mt-0.5">Modifica o agrega los ítems de esta compra.</p>
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
                          className={`p-2 rounded-xl text-xs transition-colors ${
                            items.length === 1 ? "text-slate-300 cursor-not-allowed" : "text-slate-400 hover:text-red-500 hover:bg-red-50 cursor-pointer"
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
              Resumen de la edición
            </h2>

            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total estimado</span>
              <div className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-1">
                {formatCLP(totalAmount)}
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-[#0066ff] hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? "Guardando..." : "Guardar cambios"}
              </button>

              <Link
                href={`/dashboard/requests/${requestId}`}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl text-center transition-all"
              >
                Cancelar
              </Link>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
