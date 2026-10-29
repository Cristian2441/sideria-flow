import { NextRequest } from "next/server";
import { db } from "@/prisma/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { permissionGuard, getCompanyId } from "@/lib/guards";
import { updateRequestSchema } from "@/lib/schemas/request.schema";

type RouteParams = { params: Promise<{ id: string }> };

class ConflictError extends Error {}

const PR_FIELDS = [
  "id", "title", "description", "costCenter", "status",
  "totalAmount", "source", "requesterId", "companyId",
  "externalId", "createdAt", "updatedAt",
] as const;


// GET 
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;


  const guard = await permissionGuard(undefined, "VIEW_REQUEST");
  if (!guard.ok) return guard.response;
  const companyId = getCompanyId(guard.session);

  const pr = await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(id))
    .where((r) => r.companyId.eq(companyId))            // ← CAMBIO
    .select(...PR_FIELDS)
    .first();

  if (!pr) return apiError(404, "NOT_FOUND", "Solicitud no encontrada.");

  const [items, history, users] = await Promise.all([
    db.orm.public.RequestItem
      .where((i) => i.requestId.eq(id))
      .where((i) => i.companyId.eq(companyId))  
      .select("id", "description", "quantity", "unitPrice", "createdAt")
      .all(),
    db.orm.public.ApprovalHistory
      .where((h) => h.requestId.eq(id))
      .where((h) => h.companyId.eq(companyId)) 
      .select("id", "fromStatus", "toStatus", "comment", "actorId", "createdAt")
      .all(),
    db.orm.public.User
      .where((u) => u.companyId.eq(pr.companyId))
      .select("id", "name", "email", "role")
      .all(),
  ]);

  const userMap = new Map(users.map((u) => [u.id, u]));

  history.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));

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

//PATCH

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const guard = await permissionGuard(undefined, "EDIT_REQUEST");
  if (!guard.ok) return guard.response;
  const companyId = getCompanyId(guard.session);
  const userId = guard.session.userId;

  const pr = await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(id))
    .where((r) => r.companyId.eq(companyId)) 
    .select("id", "status", "requesterId")
    .first();

  if (!pr) return apiError(404, "NOT_FOUND", "Solicitud no encontrada.");

  if (pr.status !== "DRAFT") {
    return apiError(
      409,
      "INVALID_STATE",
      "Solo se pueden editar solicitudes en estado DRAFT."
    );
  }

  if (pr.requesterId !== userId) {
    return apiError(403, "FORBIDDEN", "Solo el solicitante puede editar su solicitud.");
  }

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

  try {
    await db.transaction(async (tx) => {
      // Siempre se ejecuta el update atómico comprobando status = DRAFT
      // Al incluir updatedAt garantizamos que el objeto de update nunca esté vacío
      const updated = await tx.orm.public.PurchaseRequest
        .where((r) => r.id.eq(id))
        .where((r) => r.companyId.eq(companyId))
        .where((r) => r.status.eq("DRAFT"))
        .where((r) => r.requesterId.eq(userId))
        .update({
          updatedAt: new Date().toISOString(),
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(costCenter !== undefined && { costCenter }),
        });

      if (!updated) throw new ConflictError();

      if (items && items.length > 0) {
        await tx.orm.public.RequestItem
          .where((i) => i.requestId.eq(id))
          .where((i) => i.companyId.eq(companyId))
          .deleteAll();

        await tx.orm.public.RequestItem.createAll(
          items.map((item) => ({
            id: crypto.randomUUID(),
            requestId: id,
            companyId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          }))
        );
      }
    });
  } catch (e) {
    if (e instanceof ConflictError) {
      return apiError(409, "INVALID_STATE", "La solicitud ya no está en borrador.");
    }
    throw e;
  }

  const updated = await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(id))
    .where((r) => r.companyId.eq(companyId))
    .select(...PR_FIELDS)
    .first();

  const updatedItems = await db.orm.public.RequestItem
    .where((i) => i.requestId.eq(id))
    .where((i) => i.companyId.eq(companyId))
    .select("id", "description", "quantity", "unitPrice", "createdAt")
    .all();

  return apiSuccess({ data: { ...updated, items: updatedItems } });
}

// DELETE
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const guard = await permissionGuard(undefined, "EDIT_REQUEST");
  if (!guard.ok) return guard.response;
  const companyId = getCompanyId(guard.session); 
  const userId = guard.session.userId;

  const pr = await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(id))
    .where((r) => r.companyId.eq(companyId)) 
    .select("id", "status", "companyId", "requesterId")
    .first();

  if (!pr) return apiError(404, "NOT_FOUND", "Solicitud no encontrada.");

  if (pr.status !== "DRAFT") {
    return apiError(409, "INVALID_STATE", "Solo se pueden eliminar solicitudes en estado DRAFT.");
  }

  if (pr.requesterId !== guard.session.userId) {
    return apiError(403, "FORBIDDEN", "Solo el solicitante puede eliminar su solicitud.");
  }

  const deleted = await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(id))
    .where((r) => r.companyId.eq(companyId))
    .where((r) => r.status.eq("DRAFT"))
    .where((r) => r.requesterId.eq(userId))
    .delete();

  if (!deleted) {
    return apiError(409, "INVALID_STATE", "La solicitud ya no está en borrador o fue modificada.");
  }

  return apiSuccess({ message: "Solicitud eliminada correctamente." });
}