/**
 * Schemas Zod para solicitudes de compra (purchase requests).
 * HU-05 a HU-09, HU-13 a HU-17.
 */

import { z } from "zod";

// ─── Ítem de solicitud ────────────────────────────────────────────────────────

export const requestItemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "La descripción del producto es requerida")
    .max(500, "Máximo 500 caracteres"),
  quantity: z
    .number()
    .int("La cantidad debe ser un número entero")
    .min(1, "La cantidad mínima es 1")
    .max(1_000_000, "La cantidad máxima es 1.000.000"),
  unitPrice: z
    .number()
    .int("El precio unitario debe ser un número entero (CLP sin decimales)")
    .min(0, "El precio no puede ser negativo")
    .max(1_000_000_000, "El precio unitario máximo es 1.000.000.000"),
});

export type RequestItemInput = z.infer<typeof requestItemSchema>;

// ─── Crear solicitud (HU-05) ──────────────────────────────────────────────────

export const createRequestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "El título es requerido")
    .max(200, "Máximo 200 caracteres"),
  description: z
    .string()
    .trim()
    .min(1, "La descripción es requerida")
    .max(2000, "Máximo 2000 caracteres"),
  costCenter: z
    .string()
    .trim()
    .min(1, "El centro de costo es requerido")
    .max(100, "Máximo 100 caracteres"),
  items: z
    .array(requestItemSchema)
    .min(1, "Debe incluir al menos un producto")
    .max(100, "Máximo 100 productos por solicitud"),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

// ─── Editar solicitud en borrador (HU-08) ────────────────────────────────────

export const updateRequestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "El título es requerido")
    .max(200)
    .optional(),
  description: z
    .string()
    .trim()
    .min(1, "La descripción es requerida")
    .max(2000)
    .optional(),
  costCenter: z
    .string()
    .trim()
    .min(1, "El centro de costo es requerido")
    .max(100)
    .optional(),
  /** Si se envía items, reemplaza todos los ítems actuales */
  items: z
    .array(requestItemSchema)
    .min(1, "Debe incluir al menos un producto")
    .max(100)
    .optional(),
});

export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;

// ─── Filtros de listado (HU-06, HU-10) ───────────────────────────────────────

export const listRequestsQuerySchema = z.object({
  /** Texto libre: busca en título y descripción (insensible a mayúsculas) */
  search: z.string().trim().max(200).optional(),
  status: z
    .enum(["DRAFT", "PENDING_MANAGER", "PENDING_FINANCE", "APPROVED", "REJECTED"])
    .optional(),
  costCenter: z.string().trim().optional(),
  minAmount: z.coerce.number().int().min(0).optional(),
  maxAmount: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;

// ─── Aprobar / Rechazar (HU-13 a HU-17) ──────────────────────────────────────

export const reviewRequestSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  comment: z
    .string()
    .trim()
    .max(1000, "El comentario no puede superar 1000 caracteres")
    .optional(),
}).refine(
  (data) => data.action !== "REJECT" || (data.comment && data.comment.length > 0),
  { message: "El comentario es obligatorio al rechazar", path: ["comment"] }
);

export type ReviewRequestInput = z.infer<typeof reviewRequestSchema>;

