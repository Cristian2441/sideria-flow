import { z } from "zod";

const MAX_QUANTITY = 100_000;
const MAX_UNIT_PRICE = 100_000_000;
const MAX_TOTAL_CLP = 1_000_000_000_000; 
 
export const REQUEST_STATUSES = [
  "DRAFT",
  "PENDING_MANAGER",
  "PENDING_FINANCE",
  "APPROVED",
  "REJECTED",
] as const;

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
    .max(MAX_QUANTITY, `La cantidad máxima es ${MAX_QUANTITY}`),
  unitPrice: z
    .number()
    .int("El precio unitario debe ser un número entero (CLP sin decimales)")
    .min(0, "El precio no puede ser negativo")
    .max(MAX_UNIT_PRICE, `El precio unitario máximo es ${MAX_UNIT_PRICE}`),
});

export type RequestItemInput = z.infer<typeof requestItemSchema>;

const itemsArray = z
  .array(requestItemSchema)
  .min(1, "Debe incluir al menos un producto")
  .max(100, "Máximo 100 productos por solicitud")
  .refine(
    (items) =>
      items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0) <= MAX_TOTAL_CLP,
    { message: "El monto total supera el máximo permitido" }
  );

const requestBase = z.object({
  title: z.string().trim().min(1, "El título es requerido").max(200, "Máximo 200 caracteres"),
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
  items: itemsArray,
});

export const createRequestSchema = requestBase.strict(); 
export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export const updateRequestSchema = requestBase
  .partial()
  .strict()
  .refine((d) => Object.keys(d).length > 0, {
    message: "Debes enviar al menos un campo para actualizar",
  });
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;
export const listRequestsQuerySchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    status: z.enum(REQUEST_STATUSES).optional(),
    costCenter: z.string().trim().max(100).optional(),
    minAmount: z.coerce.number().int().min(0).max(MAX_TOTAL_CLP).optional(),
    maxAmount: z.coerce.number().int().min(0).max(MAX_TOTAL_CLP).optional(),
    // Paginación por cursor (recomendada). `page` queda solo por compatibilidad.
    cursor: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .refine(
    (d) => d.minAmount === undefined || d.maxAmount === undefined || d.minAmount <= d.maxAmount,
    { message: "minAmount no puede ser mayor que maxAmount", path: ["minAmount"] }
  );
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;
 
/* ---------- Revisión ---------- */
export const reviewRequestSchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT"]),
    comment: z.string().trim().max(1000, "El comentario no puede superar 1000 caracteres").optional(),
  })
  .strict()
  .refine((d) => d.action !== "REJECT" || (d.comment && d.comment.length > 0), {
    message: "El comentario es obligatorio al rechazar",
    path: ["comment"],
  });
export type ReviewRequestInput = z.infer<typeof reviewRequestSchema>;
 
/* ---------- Ingesta por API (externalId / payloadHash con límites) ---------- */
export const apiCreateRequestSchema = requestBase
  .extend({
    companyId: z.string().optional(),
    external_id: z.string().trim().max(100).optional(),
    externalId: z.string().trim().max(100).optional(),
  })
  .strip();
export type ApiCreateRequestInput = z.infer<typeof apiCreateRequestSchema>;