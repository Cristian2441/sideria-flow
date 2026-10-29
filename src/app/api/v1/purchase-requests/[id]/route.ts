/**
 * GET /api/v1/purchase-requests/[id]
 *
 * HU-20: Consultar detalle de una solicitud de compra por ID interno o external_id.
 *
 * Autenticación: X-API-Key header (companyId viene de la API Key).
 * Aislamiento: solo retorna solicitudes de la empresa de la API Key (404 si es de otra).
 *
 * El parámetro [id] puede ser:
 *   - Un UUID (id interno de la BD)
 *   - Un external_id (string arbitrario enviado al crear la solicitud)
 *
 * La detección es automática: si el [id] no es un UUID válido, se busca por external_id.
 */

import { NextRequest } from "next/server";
import { db } from "@/prisma/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { apiKeyGuard } from "@/lib/api-key-guard";

type RouteParams = { params: Promise<{ id: string }> };

// Regex simple para detectar UUID v4
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // 1. Autenticar con API Key
  const guard = await apiKeyGuard(request);
  if (!guard.ok) return guard.response;
  const { companyId } = guard.context;

  // 2. Buscar solicitud por id interno o external_id
  // Tipo inferido por Prisma (createdAt/updatedAt son string en RC 21)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pr: any = null;

  if (UUID_REGEX.test(id)) {
    // Buscar por id interno
    pr = await db.orm.public.PurchaseRequest
      .where((r) => r.id.eq(id))
      .select(
        "id", "title", "description", "costCenter", "status",
        "totalAmount", "source", "externalId", "requesterId",
        "companyId", "payloadHash", "createdAt", "updatedAt"
      )
      .first();
  }

  // Si no se encontró por UUID (o el parámetro no es UUID), buscar por external_id
  if (!pr) {
    pr = await db.orm.public.PurchaseRequest
      .where((r) => r.companyId.eq(companyId))
      .where((r) => r.externalId.eq(id))
      .select(
        "id", "title", "description", "costCenter", "status",
        "totalAmount", "source", "externalId", "requesterId",
        "companyId", "payloadHash", "createdAt", "updatedAt"
      )
      .first();
  }

  if (!pr) return apiError(404, "NOT_FOUND", "Solicitud no encontrada.");

  // 3. Aislamiento multiempresa: la solicitud debe pertenecer a la empresa de la API Key
  if (pr.companyId !== companyId) {
    return apiError(404, "NOT_FOUND", "Solicitud no encontrada.");
  }

  // 4. Cargar ítems, historial y usuarios de la empresa
  const [items, history, users] = await Promise.all([
    db.orm.public.RequestItem
      .where((i) => i.requestId.eq(pr!.id))
      .select("id", "description", "quantity", "unitPrice", "createdAt")
      .all(),
    db.orm.public.ApprovalHistory
      .where((h) => h.requestId.eq(pr!.id))
      .select("id", "fromStatus", "toStatus", "comment", "actorId", "createdAt")
      .all(),
    db.orm.public.User
      .where((u) => u.companyId.eq(pr!.companyId))
      .select("id", "name", "email", "role")
      .all(),
  ]);

  const userMap = new Map(users.map((u) => [u.id, u]));
  history.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));

  const historyWithActor = history.map((h) => ({
    ...h,
    actor: userMap.get(h.actorId) ?? null,
  }));

  const requester = userMap.get(pr!.requesterId) ?? null;

  return apiSuccess({ data: { ...pr, requester, items, history: historyWithActor } });
}
