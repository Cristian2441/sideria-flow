/**
 * Tests HU-03: Permisos por rol
 *
 * Verifica que:
 * 1. Solicitante (REQUESTER): crea y edita sus solicitudes
 * 2. Jefatura (MANAGER): aprueba o rechaza la primera etapa
 * 3. Finanzas (FINANCE): aprueba o rechaza la segunda etapa
 * 4. Una acción sin permiso devuelve 403 validado en el servidor
 *
 * La validación es siempre server-side (roleGuard / permissionGuard).
 * Los tests inyectan sesiones directamente sin necesidad de HTTP ni cookies.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/prisma/db";
import {
  roleGuard,
  permissionGuard,
  ROLE_PERMISSIONS,
} from "@/lib/guards";
import type { JWTPayload } from "@/lib/auth";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

let sessionRequester: JWTPayload; // REQUESTER de Alpha
let sessionManager: JWTPayload;   // MANAGER de Alpha
let sessionFinance: JWTPayload;   // FINANCE de Alpha

beforeAll(async () => {
  const req = await db.orm.public.User
    .where((u) => u.email.eq("solicitante@alpha.cl"))
    .select("id", "email", "name", "role", "companyId")
    .first();
  const mgr = await db.orm.public.User
    .where((u) => u.email.eq("jefatura@alpha.cl"))
    .select("id", "email", "name", "role", "companyId")
    .first();
  const fin = await db.orm.public.User
    .where((u) => u.email.eq("finanzas@alpha.cl"))
    .select("id", "email", "name", "role", "companyId")
    .first();

  expect(req, "REQUESTER no encontrado — ejecuta el seed").toBeTruthy();
  expect(mgr, "MANAGER no encontrado — ejecuta el seed").toBeTruthy();
  expect(fin, "FINANCE no encontrado — ejecuta el seed").toBeTruthy();

  sessionRequester = { userId: req!.id, companyId: req!.companyId, role: "REQUESTER", email: req!.email, name: req!.name };
  sessionManager   = { userId: mgr!.id, companyId: mgr!.companyId, role: "MANAGER",   email: mgr!.email, name: mgr!.name };
  sessionFinance   = { userId: fin!.id, companyId: fin!.companyId, role: "FINANCE",   email: fin!.email, name: fin!.name };
});

// ─── 1. Matriz de permisos — REQUESTER ───────────────────────────────────────

describe("HU-03 — REQUESTER: crea y edita sus solicitudes", () => {
  it("REQUESTER puede crear solicitudes (CREATE_REQUEST)", async () => {
    const g = await permissionGuard(sessionRequester, "CREATE_REQUEST");
    expect(g.ok).toBe(true);
  });

  it("REQUESTER puede editar solicitudes en DRAFT (EDIT_REQUEST)", async () => {
    const g = await permissionGuard(sessionRequester, "EDIT_REQUEST");
    expect(g.ok).toBe(true);
  });

  it("REQUESTER puede enviar solicitud a aprobación (SUBMIT_REQUEST)", async () => {
    const g = await permissionGuard(sessionRequester, "SUBMIT_REQUEST");
    expect(g.ok).toBe(true);
  });

  it("REQUESTER puede ver la lista de solicitudes (LIST_REQUESTS)", async () => {
    const g = await permissionGuard(sessionRequester, "LIST_REQUESTS");
    expect(g.ok).toBe(true);
  });

  it("REQUESTER NO puede aprobar primera etapa → 403 en servidor", async () => {
    const g = await permissionGuard(sessionRequester, "REVIEW_FIRST_STAGE");
    expect(g.ok).toBe(false);
    if (!g.ok) {
      const body = await g.response.json();
      expect(g.response.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
    }
  });

  it("REQUESTER NO puede aprobar segunda etapa → 403 en servidor", async () => {
    const g = await permissionGuard(sessionRequester, "REVIEW_SECOND_STAGE");
    expect(g.ok).toBe(false);
    if (!g.ok) {
      expect(g.response.status).toBe(403);
    }
  });
});

// ─── 2. Matriz de permisos — MANAGER ─────────────────────────────────────────

describe("HU-03 — MANAGER: aprueba o rechaza la primera etapa", () => {
  it("MANAGER puede revisar primera etapa (REVIEW_FIRST_STAGE)", async () => {
    const g = await permissionGuard(sessionManager, "REVIEW_FIRST_STAGE");
    expect(g.ok).toBe(true);
  });

  it("MANAGER puede ver solicitudes (LIST_REQUESTS, VIEW_REQUEST)", async () => {
    const list = await permissionGuard(sessionManager, "LIST_REQUESTS");
    const view = await permissionGuard(sessionManager, "VIEW_REQUEST");
    expect(list.ok).toBe(true);
    expect(view.ok).toBe(true);
  });

  it("MANAGER NO puede crear solicitudes → 403 en servidor", async () => {
    const g = await permissionGuard(sessionManager, "CREATE_REQUEST");
    expect(g.ok).toBe(false);
    if (!g.ok) {
      const body = await g.response.json();
      expect(g.response.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
    }
  });

  it("MANAGER NO puede editar solicitudes → 403 en servidor", async () => {
    const g = await permissionGuard(sessionManager, "EDIT_REQUEST");
    expect(g.ok).toBe(false);
    if (!g.ok) {
      expect(g.response.status).toBe(403);
    }
  });

  it("MANAGER NO puede aprobar segunda etapa (FINANCE) → 403 en servidor", async () => {
    const g = await permissionGuard(sessionManager, "REVIEW_SECOND_STAGE");
    expect(g.ok).toBe(false);
    if (!g.ok) {
      expect(g.response.status).toBe(403);
    }
  });
});

// ─── 3. Matriz de permisos — FINANCE ─────────────────────────────────────────

describe("HU-03 — FINANCE: aprueba o rechaza la segunda etapa", () => {
  it("FINANCE puede revisar segunda etapa (REVIEW_SECOND_STAGE)", async () => {
    const g = await permissionGuard(sessionFinance, "REVIEW_SECOND_STAGE");
    expect(g.ok).toBe(true);
  });

  it("FINANCE puede ver solicitudes (LIST_REQUESTS, VIEW_REQUEST)", async () => {
    const list = await permissionGuard(sessionFinance, "LIST_REQUESTS");
    const view = await permissionGuard(sessionFinance, "VIEW_REQUEST");
    expect(list.ok).toBe(true);
    expect(view.ok).toBe(true);
  });

  it("FINANCE NO puede crear solicitudes → 403 en servidor", async () => {
    const g = await permissionGuard(sessionFinance, "CREATE_REQUEST");
    expect(g.ok).toBe(false);
    if (!g.ok) {
      const body = await g.response.json();
      expect(g.response.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
    }
  });

  it("FINANCE NO puede aprobar primera etapa (solo MANAGER) → 403 en servidor", async () => {
    const g = await permissionGuard(sessionFinance, "REVIEW_FIRST_STAGE");
    expect(g.ok).toBe(false);
    if (!g.ok) {
      expect(g.response.status).toBe(403);
    }
  });

  it("FINANCE NO puede editar solicitudes → 403 en servidor", async () => {
    const g = await permissionGuard(sessionFinance, "EDIT_REQUEST");
    expect(g.ok).toBe(false);
    if (!g.ok) {
      expect(g.response.status).toBe(403);
    }
  });
});

// ─── 4. Sin autenticación → 401 (no 403) ─────────────────────────────────────

describe("HU-03 — Sin sesión: devuelve 401, no 403", () => {
  it("usuario anónimo intentando crear solicitud → 401", async () => {
    const g = await permissionGuard(null, "CREATE_REQUEST");
    expect(g.ok).toBe(false);
    if (!g.ok) {
      expect(g.response.status).toBe(401);
    }
  });

  it("usuario anónimo intentando aprobar → 401", async () => {
    const g = await permissionGuard(null, "REVIEW_FIRST_STAGE");
    expect(g.ok).toBe(false);
    if (!g.ok) {
      expect(g.response.status).toBe(401);
    }
  });
});

// ─── 5. roleGuard con roles explícitos ───────────────────────────────────────

describe("HU-03 — roleGuard: verificación server-side (no solo UI)", () => {
  it("el guard devuelve 403 aunque el cliente envíe la petición directamente", async () => {
    // Simula un REQUESTER llamando directamente a una acción de MANAGER
    // (como si bypasseara la UI y llamara al endpoint directo)
    const g = await roleGuard(sessionRequester, "MANAGER");
    expect(g.ok).toBe(false);
    if (!g.ok) {
      const body = await g.response.json();
      expect(g.response.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
      // Confirma que el mensaje viene del servidor
      expect(body.error.message).toContain("REQUESTER");
    }
  });

  it("roleGuard acepta múltiples roles permitidos (OR lógico)", async () => {
    // Una acción que permite MANAGER o FINANCE
    const gMgr = await roleGuard(sessionManager, "MANAGER", "FINANCE");
    const gFin = await roleGuard(sessionFinance, "MANAGER", "FINANCE");
    const gReq = await roleGuard(sessionRequester, "MANAGER", "FINANCE");

    expect(gMgr.ok).toBe(true);
    expect(gFin.ok).toBe(true);
    expect(gReq.ok).toBe(false); // REQUESTER no está en la lista
    if (!gReq.ok) {
      expect(gReq.response.status).toBe(403);
    }
  });

  it("ROLE_PERMISSIONS contiene todos los roles correctos según la especificación", () => {
    // Verifica que la tabla de permisos esté bien definida
    expect(ROLE_PERMISSIONS.CREATE_REQUEST).toEqual(["REQUESTER"]);
    expect(ROLE_PERMISSIONS.EDIT_REQUEST).toEqual(["REQUESTER"]);
    expect(ROLE_PERMISSIONS.SUBMIT_REQUEST).toEqual(["REQUESTER"]);
    expect(ROLE_PERMISSIONS.REVIEW_FIRST_STAGE).toEqual(["MANAGER"]);
    expect(ROLE_PERMISSIONS.REVIEW_SECOND_STAGE).toEqual(["FINANCE"]);
    expect(ROLE_PERMISSIONS.LIST_REQUESTS).toContain("REQUESTER");
    expect(ROLE_PERMISSIONS.LIST_REQUESTS).toContain("MANAGER");
    expect(ROLE_PERMISSIONS.LIST_REQUESTS).toContain("FINANCE");
  });
});

