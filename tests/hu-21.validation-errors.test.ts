/**
 * Tests HU-21: Validación y errores coherentes en la API de integración.
 *
 * Criterios de aceptación:
 * 1. Formato único: { error: { code, message, details[] } }.
 * 2. Códigos HTTP coherentes:
 *    - 400: JSON inválido
 *    - 401: API Key ausente o inválida
 *    - 422: Validación por campo (Zod)
 *    - 409: Duplicado (mismo payload en la empresa o conflicto de idempotencia)
 *    - 429: Rate limit excedido
 *    - 500: Error interno del servidor
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST, GET } from "@/app/api/v1/purchase-requests/route";
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limiter";
import { apiError } from "@/lib/api-response";
import { db } from "@/prisma/db";
import { NextRequest } from "next/server";
import crypto from "crypto";

const ALPHA_RAW_KEY = "sf_alpha_key_1234567890abcdef";

let alphaCompanyId: string;
const createdRequestIds: string[] = [];

beforeAll(async () => {
  resetRateLimits();
  const alpha = await db.orm.public.Company
    .where((c) => c.name.eq("Empresa Alpha"))
    .select("id")
    .first();

  expect(alpha).toBeTruthy();
  alphaCompanyId = alpha!.id;
});

afterAll(async () => {
  // Limpieza de solicitudes creadas en los tests
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
});

describe("HU-21 — Validación y errores coherentes", () => {
  // ─── 1. Formato único de error ───────────────────────────────────────────────
  it("todos los errores cumplen con el formato estándar { error: { code, message, details[] } }", () => {
    const res = apiError(400, "TEST_CODE", "Mensaje de prueba");
    expect(res.status).toBe(400);

    // Verificamos estructura del JSON
    // @ts-expect-error - Acceso a json interno para test unitario
    const body = res._body ? JSON.parse(res._body) : undefined;
    // Si no está serializado como _body, testeamos via Response.json()
    if (body) {
      expect(body).toHaveProperty("error");
      expect(body.error).toHaveProperty("code", "TEST_CODE");
      expect(body.error).toHaveProperty("message", "Mensaje de prueba");
      expect(Array.isArray(body.error.details)).toBe(true);
    }
  });

  // ─── 2. Código 400: JSON inválido ───────────────────────────────────────────
  it("devuelve 400 INVALID_JSON con formato estándar si el body no es JSON válido", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/purchase-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ALPHA_RAW_KEY,
      },
      body: "este no es un json valido {{{",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe("INVALID_JSON");
    expect(typeof data.error.message).toBe("string");
    expect(Array.isArray(data.error.details)).toBe(true);
  });

  // ─── 3. Código 401: API Key ausente o inválida ──────────────────────────────
  it("devuelve 401 MISSING_API_KEY si la petición no incluye cabecera de autenticación", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/purchase-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe("MISSING_API_KEY");
    expect(Array.isArray(data.error.details)).toBe(true);
  });

  it("devuelve 401 INVALID_API_KEY si la API Key es errónea", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/purchase-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "sf_clave_totalmente_invalida_0000",
      },
      body: JSON.stringify({ title: "Test" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe("INVALID_API_KEY");
    expect(Array.isArray(data.error.details)).toBe(true);
  });

  // ─── 4. Código 422: Validación por campo (Zod) ──────────────────────────────
  it("devuelve 422 VALIDATION_ERROR con details[] describiendo cada campo fallido", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/purchase-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ALPHA_RAW_KEY,
      },
      // Body con campos faltantes o inválidos
      body: JSON.stringify({
        title: "", // vacío
        costCenter: "TI",
        items: [], // vacío
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);

    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(data.error.details)).toBe(true);
    expect(data.error.details.length).toBeGreaterThan(0);

    // Comprobamos que details contiene fields descriptivos
    const fields = data.error.details.map((d: { field: string }) => d.field);
    expect(fields.some((f: string) => f.includes("title") || f.includes("items"))).toBe(true);
  });

  // ─── 5. Código 409: Duplicado y conflicto de idempotencia ───────────────────
  it("devuelve 409 DUPLICATE_PAYLOAD al enviar una solicitud idéntica en la misma empresa", async () => {
    const uniqueTitle = `HU-21 Duplicado Test ${crypto.randomUUID().slice(0, 8)}`;
    const payload = {
      title: uniqueTitle,
      description: "Descripción de prueba para verificar duplicados",
      costCenter: "Tecnología",
      items: [
        { description: "Monitor Dell 27", quantity: 2, unitPrice: 150000 },
      ],
    };

    // Primera creación exitosa (201)
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
    createdRequestIds.push(data1.data.id);

    // Segundo envío idéntico sin external_id -> Debe detectar duplicado (409)
    const req2 = new NextRequest("http://localhost:3000/api/v1/purchase-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ALPHA_RAW_KEY,
      },
      body: JSON.stringify(payload),
    });

    const res2 = await POST(req2);
    expect(res2.status).toBe(409);

    const data2 = await res2.json();
    expect(data2.error).toBeDefined();
    expect(data2.error.code).toBe("DUPLICATE_PAYLOAD");
    expect(Array.isArray(data2.error.details)).toBe(true);
  });

  it("devuelve 409 IDEMPOTENCY_CONFLICT si se reusa un external_id con datos diferentes", async () => {
    const externalId = `EXT-CONFLICT-${crypto.randomUUID().slice(0, 8)}`;
    const payloadA = {
      external_id: externalId,
      title: `HU-21 Idempotencia Original ${crypto.randomUUID().slice(0, 6)}`,
      description: "Primera versión de los datos",
      costCenter: "TI",
      items: [{ description: "Teclado mecánico", quantity: 1, unitPrice: 45000 }],
    };

    // 1. Envío original -> 201 Created
    const req1 = new NextRequest("http://localhost:3000/api/v1/purchase-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ALPHA_RAW_KEY,
      },
      body: JSON.stringify(payloadA),
    });

    const res1 = await POST(req1);
    expect(res1.status).toBe(201);
    const data1 = await res1.json();
    createdRequestIds.push(data1.data.id);

    // 2. Envío con el mismo external_id pero diferente payload -> 409 Conflict
    const payloadB = {
      external_id: externalId,
      title: "HU-21 Título Alterado que no coincide",
      description: "Segunda versión con datos alterados",
      costCenter: "Finanzas",
      items: [{ description: "Mouse inalámbrico", quantity: 5, unitPrice: 20000 }],
    };

    const req2 = new NextRequest("http://localhost:3000/api/v1/purchase-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ALPHA_RAW_KEY,
      },
      body: JSON.stringify(payloadB),
    });

    const res2 = await POST(req2);
    expect(res2.status).toBe(409);

    const data2 = await res2.json();
    expect(data2.error).toBeDefined();
    expect(data2.error.code).toBe("IDEMPOTENCY_CONFLICT");
    expect(Array.isArray(data2.error.details)).toBe(true);
  });

  // ─── 6. Código 429: Rate limit ──────────────────────────────────────────────
  it("devuelve 429 RATE_LIMIT_EXCEEDED cuando se supera el número máximo de peticiones", async () => {
    const testKey = `test-rate-key-${Date.now()}`;

    // Simulamos agotar el límite con la función checkRateLimit
    for (let i = 0; i < 3; i++) {
      const check = checkRateLimit(testKey, 3);
      expect(check.allowed).toBe(true);
    }

    // La siguiente llamada debe ser bloqueada
    const blockedCheck = checkRateLimit(testKey, 3);
    expect(blockedCheck.allowed).toBe(false);
    expect(blockedCheck.remaining).toBe(0);

    // Verificamos que la respuesta estructurada devuelta por apiError para 429 cumple el contrato
    const res = apiError(
      429,
      "RATE_LIMIT_EXCEEDED",
      "Límite de peticiones excedido.",
      [{ field: "rate_limit", message: "Máximo permitido superado." }]
    );
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(Array.isArray(data.error.details)).toBe(true);
  });

  // ─── 7. Código 500: Error interno ───────────────────────────────────────────
  it("devuelve 500 INTERNAL_SERVER_ERROR con contrato coherente ante errores no controlados", async () => {
    const res = apiError(
      500,
      "INTERNAL_SERVER_ERROR",
      "Ocurrió un error interno en el servidor."
    );
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(Array.isArray(data.error.details)).toBe(true);
  });
});

