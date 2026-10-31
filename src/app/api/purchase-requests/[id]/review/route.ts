import { NextRequest } from "next/server";
import { db } from "@/prisma/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { authGuard, companyGuard } from "@/lib/guards";
import { reviewRequestSchema } from "@/lib/schemas/request.schema";
import {
  determineApprovedStatus,
  isSelfApproval,
  canReviewInStatus,
} from "@/lib/business-rules";
import { APPROVAL_THRESHOLD } from "@/lib/types";
import type { PurchaseRequestStatus, UserRole } from "@/lib/types";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const guard = await authGuard();
  if (!guard.ok) return guard.response;
  const { session } = guard;
  const role = session.role as UserRole;

  if (role !== "MANAGER" && role !== "FINANCE") {
    return apiError(
      403,
      "FORBIDDEN",
      "Solo MANAGER o FINANCE pueden aprobar o rechazar solicitudes."
    );
  }

  const pr = await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(id))
    .select(
      "id", "status", "companyId", "requesterId",
      "totalAmount", "title"
    )
    .first();

  if (!pr) return apiError(404, "NOT_FOUND", "Solicitud no encontrada.");

  const cg = await companyGuard(pr.companyId, guard.session);
  if (!cg.ok) return cg.response;

  if (isSelfApproval(pr.requesterId, session.userId)) {
    return apiError(
      403,
      "SELF_APPROVAL_NOT_ALLOWED",
      "No puedes aprobar o rechazar tu propia solicitud."
    );
  }

  if (!canReviewInStatus(role, pr.status)) {
    return apiError(
      409,
      "INVALID_STATE",
      `${role} no puede actuar sobre solicitudes en estado ${pr.status}.`
    );
  }

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

  let newStatus: PurchaseRequestStatus;

  if (action === "REJECT") {
    newStatus = "REJECTED";
  } else {
    newStatus = determineApprovedStatus(role, pr.totalAmount);
  }

  const result = await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(id))
    .where((r) => r.companyId.eq(pr.companyId))
    .where((r) => r.status.eq(pr.status))
    .update({ status: newStatus });

  if (!result) {
    return apiError(409, "CONCURRENT_MODIFICATION", "La solicitud ya fue procesada por otro usuario.");
  }

  await db.orm.public.ApprovalHistory.create({
    id: crypto.randomUUID(),
    requestId: id,
    companyId: pr.companyId,
    actorId: session.userId,
    fromStatus: pr.status,
    toStatus: newStatus,
    comment: comment ?? null,
  });

  const finalRequest = await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(id))
    .where((r) => r.companyId.eq(pr.companyId))
    .select(
      "id", "title", "description", "costCenter", "status",
      "totalAmount", "source", "requesterId", "companyId",
      "externalId", "createdAt", "updatedAt"
    )
    .first();

  return apiSuccess({
    data: finalRequest,
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

