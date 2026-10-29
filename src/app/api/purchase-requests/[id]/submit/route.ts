/**
 * POST /api/purchase-requests/[id]/submit
 *
 * HU-09: Enviar solicitud a aprobación (DRAFT → PENDING_MANAGER).
 *
 * Reglas:
 * - Solo el REQUESTER creador puede enviar su solicitud.
 * - La solicitud debe tener al menos un ítem (validado también por el trigger).
 * - El trigger guard_request_update valida la transición de estado en la BD.
 * - Se registra el evento en approval_history.
 */

import { NextRequest } from "next/server";
import { db } from "@/prisma/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { permissionGuard, companyGuard } from "@/lib/guards";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // 1. Solo REQUESTER puede enviar a aprobación (HU-03)
  const guard = await permissionGuard(undefined, "SUBMIT_REQUEST");
  if (!guard.ok) return guard.response;

  // 2. Cargar solicitud
  const pr = await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(id))
    .select("id", "status", "companyId", "requesterId", "totalAmount")
    .first();

  if (!pr) return apiError(404, "NOT_FOUND", "Solicitud no encontrada.");

  // 3. Aislamiento multiempresa (HU-02)
  const cg = await companyGuard(pr.companyId, guard.session);
  if (!cg.ok) return cg.response;

  // 4. Solo el creador puede enviar su solicitud
  if (pr.requesterId !== guard.session.userId) {
    return apiError(403, "FORBIDDEN", "Solo el solicitante puede enviar su solicitud.");
  }

  // 5. Solo se puede enviar desde DRAFT
  if (pr.status !== "DRAFT") {
    return apiError(
      409,
      "INVALID_STATE",
      `No se puede enviar una solicitud en estado ${pr.status}.`
    );
  }

  // 6. Verificar que tenga al menos un ítem (el trigger también lo valida, pero mejor anticipar)
  const itemCount = await db.orm.public.RequestItem
    .where((i) => i.requestId.eq(id))
    .all();

  if (itemCount.length === 0) {
    return apiError(
      422,
      "NO_ITEMS",
      "No se puede enviar una solicitud sin productos."
    );
  }

  // 7. Transición de estado: DRAFT → PENDING_MANAGER
  // El trigger guard_request_update valida la transición en la BD.
  await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(id))
    .update({ status: "PENDING_MANAGER" });

  // 8. Registrar en historial de aprobación
  await db.orm.public.ApprovalHistory.create({
    id: crypto.randomUUID(),
    requestId: id,
    companyId: pr.companyId,
    actorId: guard.session.userId,
    fromStatus: "DRAFT",
    toStatus: "PENDING_MANAGER",
    comment: null,
  });

  // 9. Retornar solicitud actualizada
  const updated = await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(id))
    .select(
      "id", "title", "description", "costCenter", "status",
      "totalAmount", "source", "requesterId", "companyId",
      "externalId", "createdAt", "updatedAt"
    )
    .first();

  return apiSuccess({ data: updated });
}

