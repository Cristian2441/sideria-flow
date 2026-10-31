import { NextRequest } from "next/server";
import { db } from "@/prisma/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { authGuard, permissionGuard, getCompanyId } from "@/lib/guards";
import {
  createRequestSchema,
  listRequestsQuerySchema,
} from "@/lib/schemas/request.schema";


export async function GET(request: NextRequest) {
  const guard = await permissionGuard(undefined, "LIST_REQUESTS");
  if (!guard.ok) return guard.response;
  const { session } = guard;
  const companyId = getCompanyId(session);

  const { searchParams } = request.nextUrl;
  const parsed = listRequestsQuerySchema.safeParse({
    search:     searchParams.get("search")     ?? undefined,
    status:     searchParams.get("status")     ?? undefined,
    costCenter: searchParams.get("costCenter") ?? undefined,
    amount:     searchParams.get("amount")     ?? undefined,
    minAmount:  searchParams.get("minAmount")  ?? undefined,
    maxAmount:  searchParams.get("maxAmount")  ?? undefined,
    date:       searchParams.get("date")       ?? undefined,
    dateFrom:   searchParams.get("dateFrom")   ?? undefined,
    dateTo:     searchParams.get("dateTo")     ?? undefined,
    page:       searchParams.get("page")       ?? undefined,
    pageSize:   searchParams.get("pageSize")   ?? undefined,
  });

  if (!parsed.success) {
    return apiError(400, "INVALID_QUERY", "Parámetros de búsqueda inválidos.", [
      ...parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    ]);
  }

  const { search, status, costCenter, amount, minAmount, maxAmount, date, dateFrom, dateTo, page, pageSize } = parsed.data;

  let query = db.orm.public.PurchaseRequest
    .where((r) => r.companyId.eq(companyId));

  if (session.role === "REQUESTER") {
    query = query.where((r) => r.requesterId.eq(session.userId));
  }

  if (status) query = query.where((r) => r.status.eq(status));

  const effectiveMax = maxAmount !== undefined ? maxAmount : amount;
  if (minAmount !== undefined) query = query.where((r) => r.totalAmount.gte(minAmount));
  if (effectiveMax !== undefined) query = query.where((r) => r.totalAmount.lte(effectiveMax));

  let allItems = await query
    .select(
      "id", "title", "description", "costCenter", "status",
      "totalAmount", "source", "requesterId", "companyId",
      "externalId", "createdAt", "updatedAt"
    )
    .all();

  if (search) {
    const q = search.toLowerCase();
    allItems = allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
    );
  }

  if (costCenter) {
    const cc = costCenter.trim().toLowerCase();
    allItems = allItems.filter((item) => item.costCenter.trim().toLowerCase() === cc);
  }

  if (date) {
    allItems = allItems.filter((item) => {
      const d = new Date(item.createdAt);
      const isoDay = d.toISOString().slice(0, 10);
      const localDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return isoDay === date || localDay === date;
    });
  }

  if (dateFrom) {
    const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
    allItems = allItems.filter((item) => new Date(item.createdAt).getTime() >= fromTime);
  }

  if (dateTo) {
    const toTime = new Date(`${dateTo}T23:59:59.999`).getTime();
    allItems = allItems.filter((item) => new Date(item.createdAt).getTime() <= toTime);
  }

  allItems.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

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

export async function POST(request: NextRequest) {
  const guard = await permissionGuard(undefined, "CREATE_REQUEST");
  if (!guard.ok) return guard.response;
  const { session } = guard;
  const companyId = getCompanyId(session);   

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

  const requestId = crypto.randomUUID();

  await db.orm.public.PurchaseRequest.create({
    id: requestId,
    companyId,                     
    requesterId: session.userId,   
    title,
    description,
    costCenter,
    source: "WEB",
    externalId: null,
    payloadHash: null,
  });

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
