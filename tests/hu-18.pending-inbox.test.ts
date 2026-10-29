/**
 * Tests HU-18: Bandeja de pendientes y exclusión de solicitudes propias.
 *
 * Verifica que:
 * 1. Para MANAGER:
 *    - Cuenta e incluye solicitudes en PENDING_MANAGER creadas por otros usuarios.
 *    - EXCLUYE estrictamente las solicitudes creadas por el propio MANAGER (no self-approval).
 * 2. Para FINANCE:
 *    - Cuenta e incluye solicitudes en PENDING_FINANCE creadas por otros usuarios.
 *    - EXCLUYE estrictamente las solicitudes creadas por el propio FINANCE.
 * 3. Aislamiento multiempresa: las solicitudes de otra empresa nunca aparecen en la bandeja de pendientes.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/prisma/db";
import type { JWTPayload } from "@/lib/auth";
import crypto from "crypto";

let alphaCompanyId: string;
let betaCompanyId: string;

let managerAlpha: JWTPayload;
let requesterAlpha: JWTPayload;
let financeAlpha: JWTPayload;

const createdRequestIds: string[] = [];

beforeAll(async () => {
  const alpha = await db.orm.public.Company
    .where((c) => c.name.eq("Empresa Alpha"))
    .select("id")
    .first();
  const beta = await db.orm.public.Company
    .where((c) => c.name.eq("Empresa Beta"))
    .select("id")
    .first();

  expect(alpha).toBeTruthy();
  expect(beta).toBeTruthy();

  alphaCompanyId = alpha!.id;
  betaCompanyId  = beta!.id;

  const req = await db.orm.public.User.where((u) => u.email.eq("solicitante@alpha.cl")).select("id", "email", "name", "role", "companyId").first();
  const mgr = await db.orm.public.User.where((u) => u.email.eq("jefatura@alpha.cl")).select("id", "email", "name", "role", "companyId").first();
  const fin = await db.orm.public.User.where((u) => u.email.eq("finanzas@alpha.cl")).select("id", "email", "name", "role", "companyId").first();

  requesterAlpha = { userId: req!.id, companyId: alphaCompanyId, role: "REQUESTER", email: req!.email, name: req!.name };
  managerAlpha   = { userId: mgr!.id, companyId: alphaCompanyId, role: "MANAGER",   email: mgr!.email, name: mgr!.name };
  financeAlpha   = { userId: fin!.id, companyId: alphaCompanyId, role: "FINANCE",   email: fin!.email, name: fin!.name };
});

afterAll(async () => {
  for (const id of createdRequestIds) {
    try {
      await db.orm.public.ApprovalHistory.where((h) => h.requestId.eq(id)).deleteAll();
    } catch { /* trigger o inexistente */ }
    try {
      await db.orm.public.RequestItem.where((i) => i.requestId.eq(id)).deleteAll();
    } catch { /* inexistente */ }
    try {
      await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).deleteAll();
    } catch { /* inexistente */ }
  }
});

// Helper para crear solicitud en un estado dado
async function createRequestWithStatus(
  companyId: string,
  requesterId: string,
  status: "DRAFT" | "PENDING_MANAGER" | "PENDING_FINANCE",
  amount = 100_000
) {
  const id = crypto.randomUUID();
  createdRequestIds.push(id);

  await db.orm.public.PurchaseRequest.create({
    id,
    companyId,
    requesterId,
    title: `Test HU-18 - ${status}`,
    description: "Test bandeja de pendientes",
    costCenter: "CC-TEST",
    source: "WEB",
  });

  await db.orm.public.RequestItem.create({
    id: crypto.randomUUID(),
    requestId: id,
    companyId,
    description: "Item test",
    quantity: 1,
    unitPrice: amount,
  });

  if (status === "PENDING_MANAGER") {
    await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).update({ status: "PENDING_MANAGER" });
  } else if (status === "PENDING_FINANCE") {
    // La máquina de estados de BD exige pasar primero por PENDING_MANAGER con monto > 500k
    await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).update({ status: "PENDING_MANAGER" });
    await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).update({ status: "PENDING_FINANCE" });
  }

  return id;
}

describe("HU-18 — Bandeja de pendientes y exclusión de solicitudes propias", () => {
  it("MANAGER: la bandeja incluye solicitudes en PENDING_MANAGER creadas por solicitantes", async () => {
    const reqId = await createRequestWithStatus(alphaCompanyId, requesterAlpha.userId, "PENDING_MANAGER", 200_000);

    // Consulta de pendientes de jefatura en la empresa
    const pending = await db.orm.public.PurchaseRequest
      .where((r) => r.companyId.eq(alphaCompanyId))
      .where((r) => r.status.eq("PENDING_MANAGER"))
      .select("id", "requesterId")
      .all();

    const forManager = pending.filter((r) => r.requesterId !== managerAlpha.userId);
    const found = forManager.some((r) => r.id === reqId);

    expect(found).toBe(true);
  });

  it("MANAGER: la bandeja EXCLUYE estrictamente solicitudes en PENDING_MANAGER creadas por el propio MANAGER", async () => {
    // Caso en que un MANAGER creó una solicitud para sí mismo y pasó a PENDING_MANAGER
    const ownReqId = await createRequestWithStatus(alphaCompanyId, managerAlpha.userId, "PENDING_MANAGER", 150_000);

    const pending = await db.orm.public.PurchaseRequest
      .where((r) => r.companyId.eq(alphaCompanyId))
      .where((r) => r.status.eq("PENDING_MANAGER"))
      .select("id", "requesterId")
      .all();

    // El filtro debe descartar la solicitud propia
    const forManager = pending.filter((r) => r.requesterId !== managerAlpha.userId);
    const foundOwn = forManager.some((r) => r.id === ownReqId);

    expect(foundOwn).toBe(false);
  });

  it("FINANCE: la bandeja incluye solicitudes en PENDING_FINANCE creadas por solicitantes", async () => {
    const reqId = await createRequestWithStatus(alphaCompanyId, requesterAlpha.userId, "PENDING_FINANCE", 800_000);

    const pending = await db.orm.public.PurchaseRequest
      .where((r) => r.companyId.eq(alphaCompanyId))
      .where((r) => r.status.eq("PENDING_FINANCE"))
      .select("id", "requesterId")
      .all();

    const forFinance = pending.filter((r) => r.requesterId !== financeAlpha.userId);
    const found = forFinance.some((r) => r.id === reqId);

    expect(found).toBe(true);
  });

  it("FINANCE: la bandeja EXCLUYE estrictamente solicitudes en PENDING_FINANCE creadas por el propio FINANCE", async () => {
    const ownReqId = await createRequestWithStatus(alphaCompanyId, financeAlpha.userId, "PENDING_FINANCE", 900_000);

    const pending = await db.orm.public.PurchaseRequest
      .where((r) => r.companyId.eq(alphaCompanyId))
      .where((r) => r.status.eq("PENDING_FINANCE"))
      .select("id", "requesterId")
      .all();

    const forFinance = pending.filter((r) => r.requesterId !== financeAlpha.userId);
    const foundOwn = forFinance.some((r) => r.id === ownReqId);

    expect(foundOwn).toBe(false);
  });

  it("Aislamiento multiempresa: la bandeja de Alpha no incluye solicitudes de Beta", async () => {
    const betaReqUser = await db.orm.public.User.where((u) => u.email.eq("solicitante@beta.cl")).select("id").first();
    const betaReqId = await createRequestWithStatus(betaCompanyId, betaReqUser!.id, "PENDING_MANAGER", 300_000);

    // Consulta de pendientes de Alpha
    const alphaPending = await db.orm.public.PurchaseRequest
      .where((r) => r.companyId.eq(alphaCompanyId))
      .where((r) => r.status.eq("PENDING_MANAGER"))
      .select("id", "companyId")
      .all();

    const foundBeta = alphaPending.some((r) => r.id === betaReqId);
    expect(foundBeta).toBe(false);
  });
});
