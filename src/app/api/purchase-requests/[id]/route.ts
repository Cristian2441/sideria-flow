/**
 * GET   /api/purchase-requests/[id]         → HU-07: ver detalle de solicitud
 * PATCH /api/purchase-requests/[id]         → HU-08: editar solicitud en DRAFT
 * DELETE /api/purchase-requests/[id]        → eliminar borrador (solo REQUESTER)
 */

import { NextRequest } from "next/server";
import { db } from "@/prisma/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { permissionGuard, companyGuard, getCompanyId } from "@/lib/guards";
import { updateRequestSchema } from "@/lib/schemas/request.schema";

type RouteParams = { params: Promise<{ id: string }> };

// ─── GET /api/purchase-requests/[id] ─────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // 1. Autenticación (todos los roles pueden ver)
  const guard = await permissionGuard(undefined, "VIEW_REQUEST");
  if (!guard.ok) return guard.response;

  // 2. Cargar solicitud
  const pr = await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(id))
    .select(
      "id", "title", "description", "costCenter", "status",
      "totalAmount", "source", "requesterId", "companyId",
      "externalId", "createdAt", "updatedAt"
    )
    .first();

  if (!pr) return apiError(404, "NOT_FOUND", "Solicitud no encontrada.");

  // 3. Aislamiento multiempresa (HU-02)
  const cg = await companyGuard(pr.companyId, guard.session);
  if (!cg.ok) return cg.response;

  // 4. Cargar ítems, historial y usuarios de la empresa
  const [items, history, users] = await Promise.all([
    db.orm.public.RequestItem
      .where((i) => i.requestId.eq(id))
      .select("id", "description", "quantity", "unitPrice", "createdAt")
      .all(),
    db.orm.public.ApprovalHistory
      .where((h) => h.requestId.eq(id))
      .select("id", "fromStatus", "toStatus", "comment", "actorId", "createdAt")
      .all(),
    db.orm.public.User
      .where((u) => u.companyId.eq(pr.companyId))
      .select("id", "name", "email", "role")
      .all(),
  ]);

  const userMap = new Map(users.map((u) => [u.id, u]));

  // Ordenar historial por fecha asc (Prisma 8 RC no tiene .orderBy())
  history.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));

  // HU-12: Enriquecer historial con información del usuario (actor)
  const historyWithActor = history.map((h) => {
    const actorUser = userMap.get(h.actorId);
    return {
      ...h,
      actor: actorUser
        ? { id: actorUser.id, name: actorUser.name, email: actorUser.email, role: actorUser.role }
        : null,
    };
  });

  const requester = userMap.get(pr.requesterId) ?? null;

  return apiSuccess({
    data: {
      ...pr,
      requester,
      items,
      history: historyWithActor,
    },
  });
}

// ─── PATCH /api/purchase-requests/[id] ───────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // 1. Solo REQUESTER puede editar (HU-03)
  const guard = await permissionGuard(undefined, "EDIT_REQUEST");
  if (!guard.ok) return guard.response;
  const companyId = getCompanyId(guard.session);

  // 2. Cargar solicitud
  const pr = await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(id))
    .select("id", "status", "companyId", "requesterId")
    .first();

  if (!pr) return apiError(404, "NOT_FOUND", "Solicitud no encontrada.");

  // 3. Aislamiento multiempresa (HU-02)
  const cg = await companyGuard(pr.companyId, guard.session);
  if (!cg.ok) return cg.response;

  // 4. Solo se puede editar en DRAFT
  if (pr.status !== "DRAFT") {
    return apiError(
      409,
      "INVALID_STATE",
      "Solo se pueden editar solicitudes en estado DRAFT."
    );
  }

  // 5. Solo el creador puede editar su propia solicitud
  if (pr.requesterId !== guard.session.userId) {
    return apiError(403, "FORBIDDEN", "Solo el solicitante puede editar su solicitud.");
  }

  // 6. Parsear y validar body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "El cuerpo de la petición no es JSON válido.");
  }

  const parsed = updateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Datos inválidos.", [
      ...parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    ]);
  }

  const { title, description, costCenter, items } = parsed.data;

  // 7. Actualizar campos de la solicitud (el trigger guard_request_update valida)
  if (title || description || costCenter) {
    await db.orm.public.PurchaseRequest
      .where((r) => r.id.eq(id))
      .update({
        ...(title       && { title }),
        ...(description && { description }),
        ...(costCenter  && { costCenter }),
      });
  }

  // 8. Si se envían ítems, reemplazar todos (eliminar + reinsertar)
  if (items && items.length > 0) {
    // El trigger guard_items_draft_only garantiza que solo se toca en DRAFT
    await db.orm.public.RequestItem
      .where((i) => i.requestId.eq(id))
      .deleteAll();

    for (const item of items) {
      await db.orm.public.RequestItem.create({
        id: crypto.randomUUID(),
        requestId: id,
        companyId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      });
    }
  }

  // 9. Retornar solicitud actualizada con total recalculado por trigger
  const updated = await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(id))
    .select(
      "id", "title", "description", "costCenter", "status",
      "totalAmount", "source", "requesterId", "companyId",
      "externalId", "createdAt", "updatedAt"
    )
    .first();

  const updatedItems = await db.orm.public.RequestItem
    .where((i) => i.requestId.eq(id))
    .select("id", "description", "quantity", "unitPrice", "createdAt")
    .all();

  return apiSuccess({ data: { ...updated, items: updatedItems } });
}

// ─── DELETE /api/purchase-requests/[id] ──────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // 1. Solo REQUESTER puede eliminar
  const guard = await permissionGuard(undefined, "EDIT_REQUEST");
  if (!guard.ok) return guard.response;

  // 2. Cargar solicitud
  const pr = await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(id))
    .select("id", "status", "companyId", "requesterId")
    .first();

  if (!pr) return apiError(404, "NOT_FOUND", "Solicitud no encontrada.");

  // 3. Aislamiento multiempresa
  const cg = await companyGuard(pr.companyId, guard.session);
  if (!cg.ok) return cg.response;

  // 4. Solo se puede eliminar en DRAFT
  if (pr.status !== "DRAFT") {
    return apiError(409, "INVALID_STATE", "Solo se pueden eliminar solicitudes en estado DRAFT.");
  }

  // 5. Solo el creador puede eliminar
  if (pr.requesterId !== guard.session.userId) {
    return apiError(403, "FORBIDDEN", "Solo el solicitante puede eliminar su solicitud.");
  }

  // Los ítems se eliminan en cascada (ON DELETE CASCADE)
  await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).deleteAll();

  return apiSuccess({ message: "Solicitud eliminada correctamente." });
}
