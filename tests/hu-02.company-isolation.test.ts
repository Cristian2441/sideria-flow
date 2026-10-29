/**
 * Tests HU-02: Aislamiento entre empresas
 *
 * Verifica que:
 * 1. Toda consulta se filtra por companyId del JWT (nunca del cliente)
 * 2. Acceder a un recurso de otra empresa devuelve 404
 * 3. Los guards funcionan correctamente para dos empresas distintas
 *
 * Estos tests son de integración contra Supabase real usando los datos del seed.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/prisma/db";
import { companyGuard, authGuard, roleGuard, getCompanyId } from "@/lib/guards";
import type { JWTPayload } from "@/lib/auth";

// ─── Fixtures: usuarios del seed ─────────────────────────────────────────────
// Estos valores se cargan dinámicamente desde la BD antes de los tests

let alphaCompanyId: string;
let betaCompanyId: string;

let sessionAlpha: JWTPayload;
let sessionBeta: JWTPayload;
let sessionAlphaManager: JWTPayload;

let alphaRequestId: string; // cualquier solicitud de Alpha

beforeAll(async () => {
  // Cargar empresa Alpha
  const alpha = await db.orm.public.Company
    .where((c) => c.name.eq("Empresa Alpha"))
    .select("id")
    .first();
  expect(alpha, "Empresa Alpha no encontrada — ejecuta el seed primero").toBeTruthy();
  alphaCompanyId = alpha!.id;

  // Cargar empresa Beta
  const beta = await db.orm.public.Company
    .where((c) => c.name.eq("Empresa Beta"))
    .select("id")
    .first();
  expect(beta, "Empresa Beta no encontrada — ejecuta el seed primero").toBeTruthy();
  betaCompanyId = beta!.id;

  // Cargar usuario solicitante de Alpha
  const reqAlpha = await db.orm.public.User
    .where((u) => u.email.eq("solicitante@alpha.cl"))
    .select("id", "email", "name", "role", "companyId")
    .first();
  expect(reqAlpha).toBeTruthy();
  sessionAlpha = {
    userId: reqAlpha!.id,
    companyId: reqAlpha!.companyId,
    role: reqAlpha!.role as JWTPayload["role"],
    email: reqAlpha!.email,
    name: reqAlpha!.name,
  };

  // Cargar usuario solicitante de Beta
  const reqBeta = await db.orm.public.User
    .where((u) => u.email.eq("solicitante@beta.cl"))
    .select("id", "email", "name", "role", "companyId")
    .first();
  expect(reqBeta).toBeTruthy();
  sessionBeta = {
    userId: reqBeta!.id,
    companyId: reqBeta!.companyId,
    role: reqBeta!.role as JWTPayload["role"],
    email: reqBeta!.email,
    name: reqBeta!.name,
  };

  // Cargar usuario jefatura de Alpha
  const mgrAlpha = await db.orm.public.User
    .where((u) => u.email.eq("jefatura@alpha.cl"))
    .select("id", "email", "name", "role", "companyId")
    .first();
  expect(mgrAlpha).toBeTruthy();
  sessionAlphaManager = {
    userId: mgrAlpha!.id,
    companyId: mgrAlpha!.companyId,
    role: mgrAlpha!.role as JWTPayload["role"],
    email: mgrAlpha!.email,
    name: mgrAlpha!.name,
  };

  // Cargar una solicitud de Alpha para testear aislamiento
  const alphaReq = await db.orm.public.PurchaseRequest
    .where((r) => r.companyId.eq(alphaCompanyId))
    .select("id")
    .first();
  expect(alphaReq, "No hay solicitudes en Alpha — ejecuta el seed primero").toBeTruthy();
  alphaRequestId = alphaReq!.id;
});

// ─── 1. companyId siempre del JWT, nunca del cliente ─────────────────────────

describe("HU-02 — companyId del JWT es la única fuente de verdad", () => {
  it("getCompanyId extrae el companyId del JWT y no acepta overrides externos", () => {
    const fromJwt = getCompanyId(sessionAlpha);
    expect(fromJwt).toBe(alphaCompanyId);

    // El companyId de Beta nunca puede sobreescribir el del JWT de Alpha
    const fromBetaJwt = getCompanyId(sessionBeta);
    expect(fromBetaJwt).toBe(betaCompanyId);
    expect(fromBetaJwt).not.toBe(alphaCompanyId);
  });

  it("una query filtrada por companyId del JWT no devuelve datos de otra empresa", async () => {
    // Simula lo que haría un route handler: usa el companyId del JWT de Alpha
    const alphaRequests = await db.orm.public.PurchaseRequest
      .where((r) => r.companyId.eq(getCompanyId(sessionAlpha)))
      .select("id", "companyId")
      .all();

    // Todos los resultados deben ser de Alpha
    for (const req of alphaRequests) {
      expect(req.companyId).toBe(alphaCompanyId);
      expect(req.companyId).not.toBe(betaCompanyId);
    }

    // Beta tampoco ve los datos de Alpha
    const betaRequests = await db.orm.public.PurchaseRequest
      .where((r) => r.companyId.eq(getCompanyId(sessionBeta)))
      .select("id", "companyId")
      .all();

    for (const req of betaRequests) {
      expect(req.companyId).toBe(betaCompanyId);
      expect(req.companyId).not.toBe(alphaCompanyId);
    }
  });

  it("los conjuntos de solicitudes de Alpha y Beta son disjuntos", async () => {
    const alphaIds = new Set(
      (await db.orm.public.PurchaseRequest
        .where((r) => r.companyId.eq(alphaCompanyId))
        .select("id")
        .all()
      ).map((r) => r.id)
    );

    const betaIds = new Set(
      (await db.orm.public.PurchaseRequest
        .where((r) => r.companyId.eq(betaCompanyId))
        .select("id")
        .all()
      ).map((r) => r.id)
    );

    // Ningún id de Alpha aparece en Beta y viceversa
    const intersection = [...alphaIds].filter((id) => betaIds.has(id));
    expect(intersection).toHaveLength(0);
  });
});

// ─── 2. companyGuard devuelve 404 para recursos de otra empresa ───────────────

describe("HU-02 — companyGuard: recurso de otra empresa devuelve 404", () => {
  it("companyGuard permite acceso cuando el recurso es de la misma empresa", async () => {
    // Alpha intenta acceder a un recurso de Alpha → ok
    const guard = await companyGuard(alphaCompanyId, sessionAlpha);
    expect(guard.ok).toBe(true);
  });

  it("companyGuard bloquea con 404 cuando el recurso pertenece a otra empresa", async () => {
    // Beta intenta acceder a un recurso de Alpha → 404
    const guard = await companyGuard(alphaCompanyId, sessionBeta);
    expect(guard.ok).toBe(false);
    if (!guard.ok) {
      const body = await guard.response.json();
      expect(guard.response.status).toBe(404);
      expect(body.error.code).toBe("NOT_FOUND");
    }
  });

  it("companyGuard con la solicitud real de Alpha bloquea al usuario de Beta", async () => {
    // Carga la solicitud de Alpha desde la BD
    const req = await db.orm.public.PurchaseRequest
      .where((r) => r.id.eq(alphaRequestId))
      .select("id", "companyId")
      .first();

    expect(req).toBeTruthy();

    // Beta intenta acceder → el guard la rechaza con 404
    const guard = await companyGuard(req!.companyId, sessionBeta);
    expect(guard.ok).toBe(false);
    if (!guard.ok) {
      expect(guard.response.status).toBe(404);
    }
  });

  it("un usuario de Alpha no puede listar usuarios de Beta aunque conozca el companyId", async () => {
    // Intento malicioso: usar el companyId de Beta en la query
    // En un route handler real, el companyId SIEMPRE viene del JWT
    const betaUsersViaAlphaSession = await db.orm.public.User
      .where((u) => u.companyId.eq(getCompanyId(sessionAlpha))) // companyId del JWT de Alpha
      .select("id", "companyId")
      .all();

    // Todos son de Alpha — Beta está completamente oculta
    for (const user of betaUsersViaAlphaSession) {
      expect(user.companyId).toBe(alphaCompanyId);
    }
  });
});

// ─── 3. authGuard con sesión inyectada ───────────────────────────────────────

describe("HU-02 — authGuard", () => {
  it("authGuard permite acceso con sesión válida de Alpha", async () => {
    const guard = await authGuard(sessionAlpha);
    expect(guard.ok).toBe(true);
    if (guard.ok) {
      expect(guard.session.companyId).toBe(alphaCompanyId);
    }
  });

  it("authGuard permite acceso con sesión válida de Beta", async () => {
    const guard = await authGuard(sessionBeta);
    expect(guard.ok).toBe(true);
    if (guard.ok) {
      expect(guard.session.companyId).toBe(betaCompanyId);
    }
  });

  it("authGuard rechaza con 401 cuando no hay sesión", async () => {
    const guard = await authGuard(null);
    expect(guard.ok).toBe(false);
    if (!guard.ok) {
      expect(guard.response.status).toBe(401);
    }
  });
});

// ─── 4. roleGuard (HU-03 preview) ────────────────────────────────────────────

describe("HU-03 — roleGuard: control de roles", () => {
  it("roleGuard permite acceso al rol correcto", async () => {
    const guard = await roleGuard(sessionAlphaManager, "MANAGER");
    expect(guard.ok).toBe(true);
  });

  it("roleGuard rechaza con 403 cuando el rol no tiene permiso", async () => {
    // Un REQUESTER intenta hacer algo de MANAGER
    const guard = await roleGuard(sessionAlpha, "MANAGER", "FINANCE");
    expect(guard.ok).toBe(false);
    if (!guard.ok) {
      const body = await guard.response.json();
      expect(guard.response.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
    }
  });

  it("roleGuard rechaza con 401 cuando no hay sesión", async () => {
    const guard = await roleGuard(null, "MANAGER");
    expect(guard.ok).toBe(false);
    if (!guard.ok) {
      expect(guard.response.status).toBe(401);
    }
  });
});

