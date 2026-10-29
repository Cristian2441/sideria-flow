/**
 * Tests HU-22: Idempotencia en la creación de solicitudes vía API.
 *
 * Criterios de aceptación:
 * 1. Se usa un externalId único por empresa (o header Idempotency-Key).
 * 2. Un reenvío idéntico devuelve la solicitud existente (200 OK, idempotent: true).
 * 3. Un reenvío con datos distintos devuelve 409 Conflict (IDEMPOTENCY_CONFLICT).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST } from "@/app/api/v1/purchase-requests/route";
import { db } from "@/prisma/db";
import { resetRateLimits } from "@/lib/rate-limiter";
import { NextRequest } from "next/server";
import crypto from "crypto";

const ALPHA_RAW_KEY = "sf_alpha_key_1234567890abcdef";
const BETA_RAW_KEY  = "sf_beta_key_abcdef1234567890";

const createdRequestIds: string[] = [];

beforeAll(async () => {
  resetRateLimits();
});

afterAll(async () => {
  for (const id of createdRequestIds) {
    try {
      await db.orm.public.ApprovalHistory.where((h) => h.requestId.eq(id)).delete().catch(() => {});
      await db.orm.public.RequestItem.where((it) => it.requestId.eq(id)).delete().catch(() => {});
      await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).delete().catch(() => {});
    } catch {
      // Ignorar
    }
  }
  resetRateLimits();
}, 25000);

describe("HU-22 — Idempotencia", { timeout: 25000 }, () => {
  it("un reenvío idéntico con external_id en body devuelve la solicitud existente con status 200 e idempotent: true", async () => {
    const externalId = `IDEM-BODY-${crypto.randomUUID().slice(0, 8)}`;
    const payload = {
      external_id: externalId,
      title: `Licencias Software ${crypto.randomUUID().slice(0, 6)}`,
      description: "Licencias anuales de desarrollo",
      costCenter: "TI",
      items: [{ description: "Licencia JetBrains", quantity: 3, unitPrice: 85000 }],
    };

    // 1. Primer envío -> 201 Created
    const req1 = new NextRequest("http://localhost:3000/api/v1/purchase-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ALPHA_RAW_KEY,
      },
      body: JSON.stringify(payload),
    });

    const res1 = await POST(req1);
    expect(res1.status).toBe(201);
    const data1 = await res1.json();
    expect(data1.data?.id).toBeDefined();
    expect(data1.data.externalId).toBe(externalId);
    createdRequestIds.push(data1.data.id);

    // 2. Reenvío idéntico -> 200 OK (idempotente)
    const req2 = new NextRequest("http://localhost:3000/api/v1/purchase-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ALPHA_RAW_KEY,
      },
      body: JSON.stringify(payload),
    });

    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.idempotent).toBe(true);
    expect(data2.data.id).toBe(data1.data.id);
  });

  it("un reenvío idéntico usando el header Idempotency-Key devuelve la solicitud existente con 200", async () => {
    const idempotencyKey = `IDEM-HDR-${crypto.randomUUID().slice(0, 8)}`;
    const payload = {
      title: `Cloud Services ${crypto.randomUUID().slice(0, 6)}`,
      description: "Hosting y servicios de base de datos",
      costCenter: "Infraestructura",
      items: [{ description: "Créditos AWS", quantity: 1, unitPrice: 200000 }],
    };

    // 1. Primer envío usando header Idempotency-Key
    const req1 = new NextRequest("http://localhost:3000/api/v1/purchase-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ALPHA_RAW_KEY,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const res1 = await POST(req1);
    expect(res1.status).toBe(201);
    const data1 = await res1.json();
    expect(data1.data?.id).toBeDefined();
    expect(data1.data.externalId).toBe(idempotencyKey);
    createdRequestIds.push(data1.data.id);

    // 2. Reenvío idéntico con el mismo header -> 200 OK
    const req2 = new NextRequest("http://localhost:3000/api/v1/purchase-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ALPHA_RAW_KEY,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.idempotent).toBe(true);
    expect(data2.data.id).toBe(data1.data.id);
  });

  it("un reenvío con el mismo external_id pero con datos distintos devuelve 409 IDEMPOTENCY_CONFLICT", async () => {
    const externalId = `IDEM-DIFF-${crypto.randomUUID().slice(0, 8)}`;
    const payloadOriginal = {
      external_id: externalId,
      title: `Insumos Oficina ${crypto.randomUUID().slice(0, 6)}`,
      description: "Tóner y papel para impresoras",
      costCenter: "Administración",
      items: [{ description: "Tóner HP LaserJet", quantity: 2, unitPrice: 45000 }],
    };

    // 1. Envío inicial
    const req1 = new NextRequest("http://localhost:3000/api/v1/purchase-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ALPHA_RAW_KEY,
      },
      body: JSON.stringify(payloadOriginal),
    });

    const res1 = await POST(req1);
    expect(res1.status).toBe(201);
    const data1 = await res1.json();
    createdRequestIds.push(data1.data.id);

    // 2. Envío con mismo external_id pero datos cambiados
    const payloadModificado = {
      external_id: externalId,
      title: `Insumos Oficina MODIFICADO ${crypto.randomUUID().slice(0, 6)}`,
      description: "Tóner y papel para impresoras",
      costCenter: "Administración",
      items: [{ description: "Tóner HP LaserJet", quantity: 10, unitPrice: 35000 }],
    };

    const req2 = new NextRequest("http://localhost:3000/api/v1/purchase-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ALPHA_RAW_KEY,
      },
      body: JSON.stringify(payloadModificado),
    });

    const res2 = await POST(req2);
    expect(res2.status).toBe(409);
    const data2 = await res2.json();
    expect(data2.error?.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("el external_id es único por empresa: dos empresas distintas pueden usar el mismo external_id", async () => {
    const sharedExternalId = `SHARED-EXT-${crypto.randomUUID().slice(0, 8)}`;
    const payload = {
      external_id: sharedExternalId,
      title: `Mobiliario Ergonómico ${crypto.randomUUID().slice(0, 6)}`,
      description: "Mobiliario ergonómico",
      costCenter: "Operaciones",
      items: [{ description: "Silla ergonómica", quantity: 2, unitPrice: 120000 }],
    };

    // 1. Crear en Alpha
    const reqAlpha = new NextRequest("http://localhost:3000/api/v1/purchase-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ALPHA_RAW_KEY,
      },
      body: JSON.stringify(payload),
    });
    const resAlpha = await POST(reqAlpha);
    expect(resAlpha.status).toBe(201);
    const dataAlpha = await resAlpha.json();
    createdRequestIds.push(dataAlpha.data.id);

    // 2. Crear el mismo external_id en Beta (debe permitirlo exitosamente)
    const reqBeta = new NextRequest("http://localhost:3000/api/v1/purchase-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": BETA_RAW_KEY,
      },
      body: JSON.stringify(payload),
    });
    const resBeta = await POST(reqBeta);
    expect(resBeta.status).toBe(201);
    const dataBeta = await resBeta.json();
    createdRequestIds.push(dataBeta.data.id);

    // Verificamos que son solicitudes distintas y pertenecen a empresas diferentes
    expect(dataAlpha.data.id).not.toBe(dataBeta.data.id);
  });
});
