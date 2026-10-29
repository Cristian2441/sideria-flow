/**
 * POST /api/purchase-requests/[id]/review
 *
 * HU-13 a HU-17: Aprobación y rechazo de solicitudes.
 *
 * Flujo de aprobación:
 * - MANAGER actúa sobre PENDING_MANAGER:
 *     · APPROVE + total ≤ 500.000 → APPROVED (fin del flujo)
 *     · APPROVE + total > 500.000  → PENDING_FINANCE
 *     · REJECT                     → REJECTED (requiere comentario)
 * - FINANCE actúa sobre PENDING_FINANCE:
 *     · APPROVE → APPROVED
 *     · REJECT  → REJECTED (requiere comentario)
 *
 * Reglas de negocio (HU-14 a HU-17):
 * - No se puede aprobar la propia solicitud (no self-approval).
 * - MANAGER no actúa sobre PENDING_FINANCE y viceversa.
 * - Rechazo siempre requiere comentario (validado en BD y aquí).
 * - Los triggers de BD (guard_history_insert, guard_request_update) validan en la BD.
 */

import { NextRequest } from "next/server";
import { db } from "@/prisma/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { authGuard, companyGuard } from "@/lib/guards";
import { reviewRequestSchema } from "@/lib/schemas/request.schema";
import { APPROVAL_THRESHOLD } from "@/lib/types";
import type { UserRole } from "@/lib/types";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // 1. Autenticación
  const guard = await authGuard();
  if (!guard.ok) return guard.response;
  const { session } = guard;
  const role = session.role as UserRole;

  // 2. Solo MANAGER o FINANCE pueden revisar (HU-03)
  if (role !== "MANAGER" && role !== "FINANCE") {
    return apiError(
      403,
      "FORBIDDEN",
      "Solo MANAGER o FINANCE pueden aprobar o rechazar solicitudes."
    );
  }

  // 3. Cargar solicitud
  const pr = await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(id))
    .select(
      "id", "status", "companyId", "requesterId",
      "totalAmount", "title"
    )
    .first();

  if (!pr) return apiError(404, "NOT_FOUND", "Solicitud no encontrada.");

  // 4. Aislamiento multiempresa (HU-02)
  const cg = await companyGuard(pr.companyId, guard.session);
  if (!cg.ok) return cg.response;

  // 5. No self-approval (HU-16): el revisor no puede ser el creador
  if (pr.requesterId === session.userId) {
    return apiError(
      403,
      "SELF_APPROVAL_NOT_ALLOWED",
      "No puedes aprobar o rechazar tu propia solicitud."
    );
  }

  // 6. Verificar que el rol puede actuar en el estado actual
  if (role === "MANAGER" && pr.status !== "PENDING_MANAGER") {
    return apiError(
      409,
      "INVALID_STATE",
      `MANAGER solo puede actuar sobre solicitudes en PENDING_MANAGER. Estado actual: ${pr.status}.`
    );
  }
  if (role === "FINANCE" && pr.status !== "PENDING_FINANCE") {
    return apiError(
      409,
      "INVALID_STATE",
      `FINANCE solo puede actuar sobre solicitudes en PENDING_FINANCE. Estado actual: ${pr.status}.`
    );
  }

  // 7. Parsear y validar body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "El cuerpo de la petición no es JSON válido.");
  }

  const parsed = reviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Datos inválidos.", [
      ...parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    ]);
  }

  const { action, comment } = parsed.data;

  // 8. Calcular nuevo estado según rol, acción y monto
  let newStatus: string;

  if (action === "REJECT") {
    newStatus = "REJECTED";
  } else {
    // APPROVE
    if (role === "MANAGER") {
      // Si supera el umbral → va a PENDING_FINANCE; si no → APPROVED directamente
      newStatus = pr.totalAmount > APPROVAL_THRESHOLD ? "PENDING_FINANCE" : "APPROVED";
    } else {
      // FINANCE siempre aprueba directamente
      newStatus = "APPROVED";
    }
  }

  // 9. Actualizar estado (el trigger guard_request_update valida la transición)
  await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(id))
    .update({ status: newStatus });

  // 10. Registrar en historial de aprobación
  await db.orm.public.ApprovalHistory.create({
    id: crypto.randomUUID(),
    requestId: id,
    companyId: pr.companyId,
    actorId: session.userId,
    fromStatus: pr.status,
    toStatus: newStatus,
    comment: comment ?? null,
  });

  // 11. Retornar solicitud actualizada
  const updated = await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(id))
    .select(
      "id", "title", "description", "costCenter", "status",
      "totalAmount", "source", "requesterId", "companyId",
      "externalId", "createdAt", "updatedAt"
    )
    .first();

  return apiSuccess({
    data: updated,
    meta: {
      action,
      previousStatus: pr.status,
      newStatus,
      ...(newStatus === "PENDING_FINANCE" && {
        message: `Monto ${pr.totalAmount.toLocaleString("es-CL")} CLP supera el umbral de aprobación. Derivado a Finanzas.`,
      }),
    },
  });
}

