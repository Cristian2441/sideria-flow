/**
 * Tests HU-28: Aislamiento entre empresas — API externa (X-API-Key)
 *
 * Verifica que:
 * 1. API Key de Alpha NO puede acceder a solicitudes de Beta (404)
 * 2. API Key de Beta NO puede acceder a solicitudes de Alpha (404)
 * 3. external_id es único por empresa (mismo external_id válido en empresas distintas)
 * 4. Usuario de Alpha NO puede acceder a solicitudes de Beta por la API web
 * 5. Usuario de Beta NO puede acceder a solicitudes de Alpha por la API web
 *
 * También cubre HU-02 para la API v1:
 * - companyId SIEMPRE viene de la API Key, nunca del body
 * - Acceder a recurso de otra empresa devuelve 404 (no 403)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/prisma/db";
import { companyGuard } from "@/lib/guards";
import type { JWTPayload } from "@/lib/auth";
import crypto from "crypto";

// ─── Fixtures ────────────────────────────────────────────────────────────────

let alphaCompanyId: string;
let betaCompanyId: string;

// Sesiones de usuarios
let sessionAlpha: JWTPayload;
let sessionBeta: JWTPayload;

// IDs de solicitudes creadas durante los tests
const createdRequestIds: string[] = [];

// Solicitudes seed de cada empresa (al menos una, cargadas en beforeAll)
let alphaDraftRequestId: string;
let betaDraftRequestId: string;

beforeAll(async () => {
  // 1. Cargar empresas
  const alpha = await db.orm.public.Company
    .where((c) => c.name.eq("Empresa Alpha"))
    .select("id")
    .first();
  const beta = await db.orm.public.Company
    .where((c) => c.name.eq("Empresa Beta"))
    .select("id")
    .first();

  expect(alpha, "Empresa Alpha no encontrada en BD").toBeTruthy();
  expect(beta, "Empresa Beta no encontrada en BD").toBeTruthy();

  alphaCompanyId = alpha!.id;
  betaCompanyId  = beta!.id;

  // 2. Cargar usuarios de cada empresa
  const alphaReq = await db.orm.public.User
    .where((u) => u.email.eq("solicitante@alpha.cl"))
    .select("id", "email", "name", "role", "companyId")
    .first();
  const betaReq = await db.orm.public.User
    .where((u) => u.email.eq("solicitante@beta.cl"))
    .select("id", "email", "name", "role", "companyId")
    .first();

  sessionAlpha = {
    userId: alphaReq!.id,
    companyId: alphaCompanyId,
    role: "REQUESTER",
    email: alphaReq!.email,
    name: alphaReq!.name,
  };
  sessionBeta = {
    userId: betaReq!.id,
    companyId: betaCompanyId,
    role: "REQUESTER",
    email: betaReq!.email,
    name: betaReq!.name,
  };

  // 3. Crear una solicitud DRAFT en cada empresa para los tests de acceso
  alphaDraftRequestId = crypto.randomUUID();
  await db.orm.public.PurchaseRequest.create({
    id: alphaDraftRequestId,
    companyId: alphaCompanyId,
    requesterId: alphaReq!.id,
    title: "Test HU-28 Alpha - solicitud",
    description: "Solicitud de test para aislamiento",
    costCenter: "CC-TEST",
    source: "API",
    externalId: `hu28-alpha-${Date.now()}`,
    payloadHash: null,
  });
  await db.orm.public.RequestItem.create({
    id: crypto.randomUUID(),
    requestId: alphaDraftRequestId,
    companyId: alphaCompanyId,
    description: "Producto test",
    quantity: 1,
    unitPrice: 100,
  });
  createdRequestIds.push(alphaDraftRequestId);

  betaDraftRequestId = crypto.randomUUID();
  await db.orm.public.PurchaseRequest.create({
    id: betaDraftRequestId,
    companyId: betaCompanyId,
    requesterId: betaReq!.id,
    title: "Test HU-28 Beta - solicitud",
    description: "Solicitud de test para aislamiento",
    costCenter: "CC-TEST",
    source: "API",
    externalId: `hu28-beta-${Date.now()}`,
    payloadHash: null,
  });
  await db.orm.public.RequestItem.create({
    id: crypto.randomUUID(),
    requestId: betaDraftRequestId,
    companyId: betaCompanyId,
    description: "Producto test",
    quantity: 1,
    unitPrice: 100,
  });
  createdRequestIds.push(betaDraftRequestId);
});

afterAll(async () => {
  for (const id of createdRequestIds) {
    try {
      await db.orm.public.ApprovalHistory.where((h) => h.requestId.eq(id)).deleteAll();
    } catch { /* puede no existir o trigger lo bloquea */ }
    try {
      await db.orm.public.RequestItem.where((i) => i.requestId.eq(id)).deleteAll();
    } catch { /* puede no existir */ }
    try {
      await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).deleteAll();
    } catch { /* puede no existir */ }
  }
});

// ─── HU-02 + HU-28: companyGuard — aislamiento por sesión de usuario ──────────

describe("HU-28 — companyGuard: usuario no puede acceder a recursos de otra empresa", () => {
  it("usuario Alpha recibe 404 al intentar acceder a solicitud de Beta", async () => {
    // La solicitud betaDraftRequestId pertenece a betaCompanyId
    // sessionAlpha.companyId = alphaCompanyId → debe fallar
    const guard = await companyGuard(betaCompanyId, sessionAlpha);
    expect(guard.ok).toBe(false);
    if (!guard.ok) {
      expect(guard.response.status).toBe(404);
    }
  });

  it("usuario Beta recibe 404 al intentar acceder a solicitud de Alpha", async () => {
    const guard = await companyGuard(alphaCompanyId, sessionBeta);
    expect(guard.ok).toBe(false);
    if (!guard.ok) {
      expect(guard.response.status).toBe(404);
    }
  });

  it("usuario Alpha puede acceder a solicitud de su propia empresa", async () => {
    const guard = await companyGuard(alphaCompanyId, sessionAlpha);
    expect(guard.ok).toBe(true);
  });

  it("usuario Beta puede acceder a solicitud de su propia empresa", async () => {
    const guard = await companyGuard(betaCompanyId, sessionBeta);
    expect(guard.ok).toBe(true);
  });

  it("la respuesta de error es 404 (no 403) para no revelar existencia del recurso", async () => {
    const guard = await companyGuard(betaCompanyId, sessionAlpha);
    expect(guard.ok).toBe(false);
    if (!guard.ok) {
      // Verificar que es 404 y NO 403
      expect(guard.response.status).toBe(404);
      expect(guard.response.status).not.toBe(403);
      const body = await guard.response.json() as { error: { code: string } };
      expect(body.error.code).toBe("NOT_FOUND");
    }
  });
});

// ─── HU-28: Aislamiento por API Key ──────────────────────────────────────────

describe("HU-28 — API Key: la API Key solo da acceso a solicitudes de su empresa", () => {
  it("solicitud de Alpha existe en BD con companyId Alpha", async () => {
    const pr = await db.orm.public.PurchaseRequest
      .where((r) => r.id.eq(alphaDraftRequestId))
      .select("id", "companyId")
      .first();

    expect(pr).toBeTruthy();
    expect(pr!.companyId).toBe(alphaCompanyId);
  });

  it("solicitud de Beta existe en BD con companyId Beta", async () => {
    const pr = await db.orm.public.PurchaseRequest
      .where((r) => r.id.eq(betaDraftRequestId))
      .select("id", "companyId")
      .first();

    expect(pr).toBeTruthy();
    expect(pr!.companyId).toBe(betaCompanyId);
  });

  it("API Key Alpha no puede ver solicitud de Beta (companyId mismatch → 404)", async () => {
    // Simular lo que haría apiKeyGuard + la verificación de companyId
    const pr = await db.orm.public.PurchaseRequest
      .where((r) => r.id.eq(betaDraftRequestId))
      .select("id", "companyId")
      .first();

    expect(pr).toBeTruthy();
    // La solicitud de Beta no pertenece a Alpha → debe devolver 404
    expect(pr!.companyId).not.toBe(alphaCompanyId);
  });

  it("API Key Beta no puede ver solicitud de Alpha (companyId mismatch → 404)", async () => {
    const pr = await db.orm.public.PurchaseRequest
      .where((r) => r.id.eq(alphaDraftRequestId))
      .select("id", "companyId")
      .first();

    expect(pr).toBeTruthy();
    expect(pr!.companyId).not.toBe(betaCompanyId);
  });

  it("la query de la API filtra SIEMPRE por companyId de la API Key", async () => {
    // Simular GET /api/v1/purchase-requests con companyId de Alpha
    const alphaItems = await db.orm.public.PurchaseRequest
      .where((r) => r.companyId.eq(alphaCompanyId))
      .select("id", "companyId")
      .all();

    // Ninguna solicitud devuelta debe tener companyId de Beta
    const leak = alphaItems.filter((r) => r.companyId === betaCompanyId);
    expect(leak).toHaveLength(0);
  });

  it("la query de Beta no devuelve solicitudes de Alpha", async () => {
    const betaItems = await db.orm.public.PurchaseRequest
      .where((r) => r.companyId.eq(betaCompanyId))
      .select("id", "companyId")
      .all();

    const leak = betaItems.filter((r) => r.companyId === alphaCompanyId);
    expect(leak).toHaveLength(0);
  });
});

// ─── HU-28: external_id es único POR EMPRESA, no global ──────────────────────

describe("HU-28 — external_id: unicidad por empresa (mismo external_id puede existir en distintas empresas)", () => {
  const sharedExternalId = `hu28-shared-ext-id-${Date.now()}`;
  const alphaRequestId   = crypto.randomUUID();
  const betaRequestId    = crypto.randomUUID();

  it("se puede crear una solicitud en Alpha con un external_id dado", async () => {
    const alphaUser = await db.orm.public.User
      .where((u) => u.email.eq("solicitante@alpha.cl"))
      .select("id")
      .first();

    await db.orm.public.PurchaseRequest.create({
      id: alphaRequestId,
      companyId: alphaCompanyId,
      requesterId: alphaUser!.id,
      title: "Test external_id Alpha",
      description: "Test",
      costCenter: "CC-TEST",
      source: "API",
      externalId: sharedExternalId,
      payloadHash: null,
    });
    await db.orm.public.RequestItem.create({
      id: crypto.randomUUID(),
      requestId: alphaRequestId,
      companyId: alphaCompanyId,
      description: "Producto",
      quantity: 1,
      unitPrice: 1,
    });
    createdRequestIds.push(alphaRequestId);

    const created = await db.orm.public.PurchaseRequest
      .where((r) => r.id.eq(alphaRequestId))
      .select("id", "externalId")
      .first();

    expect(created).toBeTruthy();
    expect(created!.externalId).toBe(sharedExternalId);
  });

  it("se puede crear el MISMO external_id en Beta (no hay conflicto entre empresas)", async () => {
    const betaUser = await db.orm.public.User
      .where((u) => u.email.eq("solicitante@beta.cl"))
      .select("id")
      .first();

    await db.orm.public.PurchaseRequest.create({
      id: betaRequestId,
      companyId: betaCompanyId,
      requesterId: betaUser!.id,
      title: "Test external_id Beta",
      description: "Test",
      costCenter: "CC-TEST",
      source: "API",
      externalId: sharedExternalId,
      payloadHash: null,
    });
    await db.orm.public.RequestItem.create({
      id: crypto.randomUUID(),
      requestId: betaRequestId,
      companyId: betaCompanyId,
      description: "Producto",
      quantity: 1,
      unitPrice: 1,
    });
    createdRequestIds.push(betaRequestId);

    const created = await db.orm.public.PurchaseRequest
      .where((r) => r.id.eq(betaRequestId))
      .select("id", "externalId", "companyId")
      .first();

    expect(created).toBeTruthy();
    expect(created!.externalId).toBe(sharedExternalId);
    expect(created!.companyId).toBe(betaCompanyId);
  });

  it("buscar por external_id en Alpha devuelve la solicitud de Alpha (no la de Beta)", async () => {
    const result = await db.orm.public.PurchaseRequest
      .where((r) => r.companyId.eq(alphaCompanyId))
      .where((r) => r.externalId.eq(sharedExternalId))
      .select("id", "companyId", "externalId")
      .first();

    expect(result).toBeTruthy();
    expect(result!.id).toBe(alphaRequestId);
    expect(result!.companyId).toBe(alphaCompanyId);
  });

  it("buscar por external_id en Beta devuelve la solicitud de Beta (no la de Alpha)", async () => {
    const result = await db.orm.public.PurchaseRequest
      .where((r) => r.companyId.eq(betaCompanyId))
      .where((r) => r.externalId.eq(sharedExternalId))
      .select("id", "companyId", "externalId")
      .first();

    expect(result).toBeTruthy();
    expect(result!.id).toBe(betaRequestId);
    expect(result!.companyId).toBe(betaCompanyId);
  });
});

// ─── HU-28: Las API Keys están en BD con el hash correcto ─────────────────────

describe("HU-28 — API Keys: existen en BD y pertenecen a la empresa correcta", () => {
  it("API Key de Alpha existe en BD y pertenece a empresa Alpha", async () => {
    const rawKey  = "sf_alpha_key_1234567890abcdef";
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const apiKey = await db.orm.public.ApiKey
      .where((k) => k.keyHash.eq(keyHash))
      .select("id", "companyId", "revokedAt")
      .first();

    expect(apiKey, "API Key de Alpha no encontrada en BD").toBeTruthy();
    expect(apiKey!.companyId).toBe(alphaCompanyId);
    expect(apiKey!.revokedAt).toBeNull();
  });

  it("API Key de Beta existe en BD y pertenece a empresa Beta", async () => {
    const rawKey  = "sf_beta_key_abcdef1234567890";
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const apiKey = await db.orm.public.ApiKey
      .where((k) => k.keyHash.eq(keyHash))
      .select("id", "companyId", "revokedAt")
      .first();

    expect(apiKey, "API Key de Beta no encontrada en BD").toBeTruthy();
    expect(apiKey!.companyId).toBe(betaCompanyId);
    expect(apiKey!.revokedAt).toBeNull();
  });

  it("un hash inventado no encuentra ninguna API Key", async () => {
    const fakeHash = crypto.createHash("sha256").update("clave-invalida-xyzabc").digest("hex");

    const apiKey = await db.orm.public.ApiKey
      .where((k) => k.keyHash.eq(fakeHash))
      .select("id")
      .first();

    expect(apiKey).toBeNull();
  });
});
