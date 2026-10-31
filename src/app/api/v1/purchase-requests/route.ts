import crypto from "crypto";
import { NextRequest } from "next/server";
import { db } from "@/prisma/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { apiKeyGuard } from "@/lib/api-key-guard";
import { checkRateLimit } from "@/lib/rate-limiter";
import { apiCreateRequestSchema, listRequestsQuerySchema } from "@/lib/schemas/request.schema";


export async function GET(request: NextRequest) {
  try {

    const guard = await apiKeyGuard(request);
    if (!guard.ok) return guard.response;
    const { companyId, apiKeyId } = guard.context;


    const rateCheck = checkRateLimit(apiKeyId);
    if (!rateCheck.allowed) {
      const res = apiError(
        429,
        "RATE_LIMIT_EXCEEDED",
        "Límite de peticiones excedido. Intente nuevamente en unos momentos.",
        [{ field: "rate_limit", message: `Máximo ${rateCheck.limit} peticiones por minuto permitidas.` }]
      );
      res.headers.set("X-RateLimit-Limit", String(rateCheck.limit));
      res.headers.set("X-RateLimit-Remaining", "0");
      res.headers.set("X-RateLimit-Reset", String(rateCheck.reset));
      return res;
    }

    const { searchParams } = request.nextUrl;
    const parsed = listRequestsQuerySchema.safeParse({
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      costCenter: searchParams.get("costCenter") ?? undefined,
      minAmount: searchParams.get("minAmount") ?? undefined,
      maxAmount: searchParams.get("maxAmount") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });

    if (!parsed.success) {
      return apiError(
        422,
        "INVALID_QUERY",
        "Parámetros de búsqueda inválidos.",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
      );
    }

    const { search, status, costCenter, minAmount, maxAmount, page, pageSize } = parsed.data;

    let query = db.orm.public.PurchaseRequest.where((r) => r.companyId.eq(companyId));
    if (status) query = query.where((r) => r.status.eq(status));
    if (costCenter) query = query.where((r) => r.costCenter.eq(costCenter));
    if (minAmount !== undefined) query = query.where((r) => r.totalAmount.gte(minAmount));
    if (maxAmount !== undefined) query = query.where((r) => r.totalAmount.lte(maxAmount));

    let allItems = await query
      .select("id", "title", "description", "costCenter", "status", "totalAmount", "source", "externalId", "requesterId", "createdAt", "updatedAt")
      .all();

    if (search) {
      const q = search.toLowerCase();
      allItems = allItems.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
      );
    }

    allItems.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    const total = allItems.length;
    const offset = (page - 1) * pageSize;
    const items = allItems.slice(offset, offset + pageSize);

    const response = apiSuccess({
      data: items,
      pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    });
    response.headers.set("X-RateLimit-Limit", String(rateCheck.limit));
    response.headers.set("X-RateLimit-Remaining", String(rateCheck.remaining));
    response.headers.set("X-RateLimit-Reset", String(rateCheck.reset));
    return response;
  } catch (err: unknown) {
    console.error("Error inesperado en GET /api/v1/purchase-requests:", err);
    return apiError(500, "INTERNAL_SERVER_ERROR", "Ocurrió un error interno en el servidor.");
  }
}


export async function POST(request: NextRequest) {
  try {

    const guard = await apiKeyGuard(request);
    if (!guard.ok) return guard.response;
    const { companyId, apiKeyId } = guard.context;

    const rateCheck = checkRateLimit(apiKeyId);
    if (!rateCheck.allowed) {
      const res = apiError(
        429,
        "RATE_LIMIT_EXCEEDED",
        "Límite de peticiones excedido. Intente nuevamente en unos momentos.",
        [{ field: "rate_limit", message: `Máximo ${rateCheck.limit} peticiones por minuto permitidas.` }]
      );
      res.headers.set("X-RateLimit-Limit", String(rateCheck.limit));
      res.headers.set("X-RateLimit-Remaining", "0");
      res.headers.set("X-RateLimit-Reset", String(rateCheck.reset));
      return res;
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "INVALID_JSON", "El cuerpo de la petición no es JSON válido.");
    }

    const extBody = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const headerIdempotencyKey =
      request.headers.get("Idempotency-Key") || request.headers.get("X-External-Id");
    const rawExternalId =
      typeof extBody.external_id === "string" && extBody.external_id.trim().length > 0
        ? extBody.external_id.trim()
        : typeof extBody.externalId === "string" && extBody.externalId.trim().length > 0
          ? extBody.externalId.trim()
          : (headerIdempotencyKey ? headerIdempotencyKey.trim() : null);

    const externalId = rawExternalId && rawExternalId.length > 0 ? rawExternalId : null;

    const parsed = apiCreateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        422,
        "VALIDATION_ERROR",
        "Error de validación en los campos de la solicitud.",
        parsed.error.issues.map((i) => ({
          field: i.path.join(".") || "body",
          message: i.message,
        }))
      );
    }

    const { title, description, costCenter, items } = parsed.data;

    const normalizedPayload = {
      title: title.trim(),
      description: (description ?? "").trim(),
      costCenter: costCenter.trim(),
      items: items.map((it) => ({
        description: it.description.trim(),
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
    };
    const payloadHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(normalizedPayload))
      .digest("hex");

    if (externalId) {
      const existingByExternalId = await db.orm.public.PurchaseRequest
        .where((r) => r.companyId.eq(companyId))
        .where((r) => r.externalId.eq(externalId))
        .select("id", "title", "status", "totalAmount", "externalId", "payloadHash", "createdAt")
        .first();

      if (existingByExternalId) {
        if (existingByExternalId.payloadHash === payloadHash) {
          const resp = apiSuccess({ data: existingByExternalId, idempotent: true }, 200);
          resp.headers.set("X-RateLimit-Limit", String(rateCheck.limit));
          resp.headers.set("X-RateLimit-Remaining", String(rateCheck.remaining));
          resp.headers.set("X-RateLimit-Reset", String(rateCheck.reset));
          return resp;
        } else {
          return apiError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Ya existe una solicitud registrada con este external_id pero con datos diferentes.",
            [{ field: "external_id", message: `El external_id '${externalId}' ya está en uso con otro contenido.` }]
          );
        }
      }
    }

    if (!externalId) {
      const existingByPayload = await db.orm.public.PurchaseRequest
        .where((r) => r.companyId.eq(companyId))
        .where((r) => r.payloadHash.eq(payloadHash))
        .select("id", "title", "status", "totalAmount", "externalId", "createdAt")
        .first();

      if (existingByPayload) {
        return apiError(
          409,
          "DUPLICATE_PAYLOAD",
          "Ya existe una solicitud idéntica registrada para esta empresa.",
          [{ field: "payload", message: `Solicitud duplicada. Coincide con la solicitud ID: ${existingByPayload.id}.` }]
        );
      }
    }

    const requester = await db.orm.public.User
      .where((u) => u.companyId.eq(companyId))
      .where((u) => u.role.eq("REQUESTER"))
      .select("id")
      .first();

    if (!requester) {
      return apiError(
        422,
        "NO_REQUESTER",
        "La empresa no tiene usuarios con rol REQUESTER para asociar la solicitud.",
        [{ field: "requesterId", message: "Se requiere al menos un usuario con rol REQUESTER." }]
      );
    }

    const requestId = crypto.randomUUID();

    await db.orm.public.PurchaseRequest.create({
      id: requestId,
      companyId,
      requesterId: requester.id,
      title: title.trim(),
      description: description.trim(),
      costCenter: costCenter.trim(),
      source: "API",
      externalId,
      payloadHash,
    });

    for (const item of items) {
      await db.orm.public.RequestItem.create({
        id: crypto.randomUUID(),
        requestId,
        companyId,
        description: item.description.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      });
    }

    await db.orm.public.PurchaseRequest
      .where((r) => r.id.eq(requestId))
      .update({ status: "PENDING_MANAGER" });

    await db.orm.public.ApprovalHistory.create({
      id: crypto.randomUUID(),
      requestId,
      companyId,
      actorId: requester.id,
      fromStatus: "DRAFT",
      toStatus: "PENDING_MANAGER",
      comment: "Solicitud creada automáticamente vía API.",
    });

    const created = await db.orm.public.PurchaseRequest
      .where((r) => r.id.eq(requestId))
      .select(
        "id", "title", "description", "costCenter", "status",
        "totalAmount", "source", "externalId", "requesterId", "companyId", "createdAt", "updatedAt"
      )
      .first();

    const response = apiSuccess({ data: created }, 201);
    response.headers.set("X-RateLimit-Limit", String(rateCheck.limit));
    response.headers.set("X-RateLimit-Remaining", String(rateCheck.remaining));
    response.headers.set("X-RateLimit-Reset", String(rateCheck.reset));
    return response;
  } catch (err: unknown) {
    console.error("Error inesperado en POST /api/v1/purchase-requests:", err);
    return apiError(
      500,
      "INTERNAL_SERVER_ERROR",
      "Ocurrió un error interno en el servidor al procesar la solicitud."
    );
  }
}
