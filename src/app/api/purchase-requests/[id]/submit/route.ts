import { NextRequest } from "next/server";
import { db } from "@/prisma/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { permissionGuard, companyGuard } from "@/lib/guards";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const guard = await permissionGuard(undefined, "SUBMIT_REQUEST");
  if (!guard.ok) return guard.response;

  const pr = await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(id))
    .select("id", "status", "companyId", "requesterId", "totalAmount")
    .first();

  if (!pr) return apiError(404, "NOT_FOUND", "Solicitud no encontrada.");

  const cg = await companyGuard(pr.companyId, guard.session);
  if (!cg.ok) return cg.response;

  if (pr.requesterId !== guard.session.userId) {
    return apiError(403, "FORBIDDEN", "Solo el solicitante puede enviar su solicitud.");
  }

  if (pr.status !== "DRAFT") {
    return apiError(
      409,
      "INVALID_STATE",
      `No se puede enviar una solicitud en estado ${pr.status}.`
    );
  }

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

  await db.orm.public.PurchaseRequest
    .where((r) => r.id.eq(id))
    .where((r) => r.companyId.eq(pr.companyId))
    .where((r) => r.status.eq("DRAFT"))
    .update({ status: "PENDING_MANAGER" });

  await db.orm.public.ApprovalHistory.create({
    id: crypto.randomUUID(),
    requestId: id,
    companyId: pr.companyId,
    actorId: guard.session.userId,
    fromStatus: "DRAFT",
    toStatus: "PENDING_MANAGER",
    comment: null,
  });

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

