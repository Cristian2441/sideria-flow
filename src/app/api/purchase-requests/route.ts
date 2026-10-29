/**
 * GET  /api/purchase-requests        → HU-06: listar solicitudes de la empresa
 * POST /api/purchase-requests        → HU-05: crear solicitud de compra
 *
 * Reglas de negocio:
 * - Solo REQUESTER puede crear (permissionGuard CREATE_REQUEST).
 * - Todos los roles pueden listar (permissionGuard LIST_REQUESTS).
 * - El companyId viene SIEMPRE del JWT (nunca del body).
 * - total_amount lo calcula el trigger de BD.
 * - La solicitud siempre nace en DRAFT (trigger force_draft_on_insert).
 */

import { NextRequest } from "next/server";
import { db } from "@/prisma/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { authGuard, permissionGuard, getCompanyId } from "@/lib/guards";
import {
  createRequestSchema,
  listRequestsQuerySchema,
} from "@/lib/schemas/request.schema";

// ─── GET /api/purchase-requests ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // 1. Autenticación (todos los roles pueden listar)
  const guard = await permissionGuard(undefined, "LIST_REQUESTS");
  if (!guard.ok) return guard.response;
  const { session } = guard;
  const companyId = getCompanyId(session);

  // 2. Parsear query params (filtros)
  const { searchParams } = request.nextUrl;
  const parsed = listRequestsQuerySchema.safeParse({
    search:     searchParams.get("search")     ?? undefined,
    status:     searchParams.get("status")     ?? undefined,
    costCenter: searchParams.get("costCenter") ?? undefined,
    minAmount:  searchParams.get("minAmount")  ?? undefined,
    maxAmount:  searchParams.get("maxAmount")  ?? undefined,
    page:       searchParams.get("page")       ?? undefined,
    pageSize:   searchParams.get("pageSize")   ?? undefined,
  });

  if (!parsed.success) {
    return apiError(400, "INVALID_QUERY", "Parámetros de búsqueda inválidos.", [
      ...parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    ]);
  }

  const { search, status, costCenter, minAmount, maxAmount, page, pageSize } = parsed.data;

  // 3. Construir y ejecutar query filtrada por companyId del JWT
  let query = db.orm.public.PurchaseRequest
    .where((r) => r.companyId.eq(companyId));

  // HU-10: REQUESTER solo ve sus propias solicitudes; MANAGER y FINANCE ven todas las de la empresa
  if (session.role === "REQUESTER") {
    query = query.where((r) => r.requesterId.eq(session.userId));
  }

  if (status)     query = query.where((r) => r.status.eq(status));
  if (costCenter) query = query.where((r) => r.costCenter.eq(costCenter));
  if (minAmount !== undefined) query = query.where((r) => r.totalAmount.gte(minAmount));
  if (maxAmount !== undefined) query = query.where((r) => r.totalAmount.lte(maxAmount));

  let allItems = await query
    .select(
      "id", "title", "description", "costCenter", "status",
      "totalAmount", "source", "requesterId", "companyId",
      "externalId", "createdAt", "updatedAt"
    )
    .all();

  // HU-11: Búsqueda por texto libre en título y descripción
  if (search) {
    const q = search.toLowerCase();
    allItems = allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
    );
  }

  // Ordenar por createdAt desc (Prisma 8 RC no tiene .orderBy())
  allItems.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // 4. Paginación manual
  const total = allItems.length;
  const offset = (page - 1) * pageSize;
  const items = allItems.slice(offset, offset + pageSize);

  return apiSuccess({
    data: items,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

// ─── POST /api/purchase-requests ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Solo REQUESTER puede crear solicitudes (HU-03)
  const guard = await permissionGuard(undefined, "CREATE_REQUEST");
  if (!guard.ok) return guard.response;
  const { session } = guard;
  const companyId = getCompanyId(session);   // HU-02: companyId del JWT

  // 2. Parsear y validar body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "El cuerpo de la petición no es JSON válido.");
  }

  const parsed = createRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Datos inválidos.", [
      ...parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    ]);
  }

  const { title, description, costCenter, items } = parsed.data;

  // 3. Crear solicitud en DRAFT (el trigger force_draft_on_insert lo garantiza)
  const requestId = crypto.randomUUID();

  await db.orm.public.PurchaseRequest.create({
    id: requestId,
    companyId,                     // del JWT, no del cliente
    requesterId: session.userId,   // del JWT
    title,
    description,
    costCenter,
    source: "WEB",
    externalId: null,
    payloadHash: null,
    // status = DRAFT por defecto (trigger)
    // totalAmount calculado por trigger tras insertar ítems
  });

  // 4. Insertar ítems (el trigger sync_request_total_amount recalcula el total)
  for (const item of items) {
    await db.orm.public.RequestItem.create({
      id: crypto.randomUUID(),
      requestId,
      companyId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    });
  }

  // 5. Leer la solicitud ya con el total calculado por el trigger
  const created = await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(requestId))
    .select(
      "id", "title", "description", "costCenter", "status",
      "totalAmount", "source", "requesterId", "companyId",
      "externalId", "createdAt", "updatedAt"
    )
    .first();

  const createdItems = await db.orm.public.RequestItem
    .where((i) => i.requestId.eq(requestId))
    .select("id", "description", "quantity", "unitPrice", "createdAt")
    .all();

  return apiSuccess({ data: { ...created, items: createdItems } }, 201);
}
