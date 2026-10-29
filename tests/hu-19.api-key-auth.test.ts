/**
 * Tests HU-19: Autenticación por API Key.
 *
 * Criterios de aceptación:
 * 1. Se envía en header (X-API-Key o Authorization: Bearer).
 * 2. La clave se guarda hasheada y está asociada a una empresa.
 * 3. Una clave ausente o inválida devuelve 401.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { apiKeyGuard } from "@/lib/api-key-guard";
import { db } from "@/prisma/db";
import { NextRequest } from "next/server";
import crypto from "crypto";

const ALPHA_RAW_KEY = "sf_alpha_key_1234567890abcdef";
const BETA_RAW_KEY  = "sf_beta_key_abcdef1234567890";

let alphaCompanyId: string;
let betaCompanyId: string;

beforeAll(async () => {
  const alpha = await db.orm.public.Company.where((c) => c.name.eq("Empresa Alpha")).select("id").first();
  const beta  = await db.orm.public.Company.where((c) => c.name.eq("Empresa Beta")).select("id").first();

  expect(alpha).toBeTruthy();
  expect(beta).toBeTruthy();

  alphaCompanyId = alpha!.id;
  betaCompanyId  = beta!.id;
});

describe("HU-19 — Autenticación por API Key (X-API-Key o Authorization: Bearer)", () => {
  it("autentica exitosamente usando el header X-API-Key", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/purchase-requests", {
      headers: {
        "X-API-Key": ALPHA_RAW_KEY,
      },
    });

    const guard = await apiKeyGuard(req);
    expect(guard.ok).toBe(true);
    if (guard.ok) {
      expect(guard.context.companyId).toBe(alphaCompanyId);
    }
  });

  it("autentica exitosamente usando el header Authorization: Bearer <key>", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/purchase-requests", {
      headers: {
        Authorization: `Bearer ${ALPHA_RAW_KEY}`,
      },
    });

    const guard = await apiKeyGuard(req);
    expect(guard.ok).toBe(true);
    if (guard.ok) {
      expect(guard.context.companyId).toBe(alphaCompanyId);
    }
  });

  it("autentica con Authorization: Bearer para Empresa Beta y resuelve su empresa", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/purchase-requests", {
      headers: {
        Authorization: `Bearer ${BETA_RAW_KEY}`,
      },
    });

    const guard = await apiKeyGuard(req);
    expect(guard.ok).toBe(true);
    if (guard.ok) {
      expect(guard.context.companyId).toBe(betaCompanyId);
    }
  });

  it("devuelve 401 MISSING_API_KEY si no se envía ningún header", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/purchase-requests");

    const guard = await apiKeyGuard(req);
    expect(guard.ok).toBe(false);
    if (!guard.ok) {
      expect(guard.response.status).toBe(401);
      const body = await guard.response.json() as { error: { code: string } };
      expect(body.error.code).toBe("MISSING_API_KEY");
    }
  });

  it("devuelve 401 INVALID_API_KEY si la clave es incorrecta", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/purchase-requests", {
      headers: {
        "X-API-Key": "sf_clave_totalmente_inexistente",
      },
    });

    const guard = await apiKeyGuard(req);
    expect(guard.ok).toBe(false);
    if (!guard.ok) {
      expect(guard.response.status).toBe(401);
      const body = await guard.response.json() as { error: { code: string } };
      expect(body.error.code).toBe("INVALID_API_KEY");
    }
  });

  it("la clave se almacena como SHA-256 en la base de datos asociada a la empresa", async () => {
    const hash = crypto.createHash("sha256").update(ALPHA_RAW_KEY).digest("hex");

    const record = await db.orm.public.ApiKey
      .where((k) => k.keyHash.eq(hash))
      .select("id", "companyId", "keyHash")
      .first();

    expect(record).toBeTruthy();
    expect(record!.companyId).toBe(alphaCompanyId);
    expect(record!.keyHash).toBe(hash);
  });
});

