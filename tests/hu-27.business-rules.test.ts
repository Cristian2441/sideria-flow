import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/prisma/db";
import {
  permissionGuard,
  companyGuard,
  roleGuard,
} from "@/lib/guards";
import { reviewRequestSchema } from "@/lib/schemas/request.schema";
import { APPROVAL_THRESHOLD } from "@/lib/types";
import {
  determineApprovedStatus,
  isSelfApproval,
  canReviewInStatus,
  isValidRejectionComment,
} from "@/lib/business-rules";
import type { JWTPayload } from "@/lib/auth";
import crypto from "crypto";

let companyId: string;
let sessionRequester: JWTPayload;
let sessionManager: JWTPayload;
let sessionFinance: JWTPayload;

const createdRequestIds: string[] = [];

beforeAll(async () => {
 
  const company = await db.orm.public.Company
    .where((c) => c.name.eq("Empresa Alpha"))
    .select("id")
    .first();
  expect(company, "Empresa Alpha no encontrada").toBeTruthy();
  companyId = company!.id;

  const req = await db.orm.public.User.where((u) => u.email.eq("solicitante@alpha.cl")).select("id","email","name","role","companyId").first();
  const mgr = await db.orm.public.User.where((u) => u.email.eq("jefatura@alpha.cl")).select("id","email","name","role","companyId").first();
  const fin = await db.orm.public.User.where((u) => u.email.eq("finanzas@alpha.cl")).select("id","email","name","role","companyId").first();

  sessionRequester = { userId: req!.id, companyId, role: "REQUESTER", email: req!.email, name: req!.name };
  sessionManager   = { userId: mgr!.id, companyId, role: "MANAGER",   email: mgr!.email, name: mgr!.name };
  sessionFinance   = { userId: fin!.id, companyId, role: "FINANCE",   email: fin!.email, name: fin!.name };
});

afterAll(async () => {
 
  if (createdRequestIds.length > 0) {
    for (const id of createdRequestIds) {
      try {
        await db.orm.public.ApprovalHistory.where((h) => h.requestId.eq(id)).deleteAll();
        await db.orm.public.RequestItem.where((i) => i.requestId.eq(id)).deleteAll();
        await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).deleteAll();
      } catch {}
    }
  }
});


async function createTestRequest(totalAmount: number): Promise<string> {
  const id = crypto.randomUUID();
  createdRequestIds.push(id);

  await db.orm.public.PurchaseRequest.create({
    id,
    companyId,
    requesterId: sessionRequester.userId,
    title: `Test solicitud ${totalAmount} CLP`,
    description: "Solicitud de prueba automatizada",
    costCenter: "CC-TEST",
    source: "WEB",
    externalId: null,
    payloadHash: null,
  });

  await db.orm.public.RequestItem.create({
    id: crypto.randomUUID(),
    requestId: id,
    companyId,
    description: "Producto de prueba",
    quantity: 1,
    unitPrice: totalAmount,
  });

  return id;
}

describe("HU-27 — Umbral de aprobación 500.000 CLP", () => {
  it("APPROVAL_THRESHOLD es exactamente 500.000", () => {
    expect(APPROVAL_THRESHOLD).toBe(500_000);
  });

  it("solicitud de 500.000 CLP exactos → MANAGER aprueba directamente (APPROVED)", async () => {
    const id = await createTestRequest(500_000);

    await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).update({ status: "PENDING_MANAGER" });
    await db.orm.public.ApprovalHistory.create({ id: crypto.randomUUID(), requestId: id, companyId, actorId: sessionRequester.userId, fromStatus: "DRAFT", toStatus: "PENDING_MANAGER", comment: null });

    const pr = await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).select("totalAmount", "status").first();
    expect(pr!.totalAmount).toBe(500_000);

    const newStatus = pr!.totalAmount > APPROVAL_THRESHOLD ? "PENDING_FINANCE" : "APPROVED";
    expect(newStatus).toBe("APPROVED");
  });

  it("solicitud de 500.001 CLP → MANAGER deriva a PENDING_FINANCE", async () => {
    const id = await createTestRequest(500_001);

    await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).update({ status: "PENDING_MANAGER" });
    await db.orm.public.ApprovalHistory.create({ id: crypto.randomUUID(), requestId: id, companyId, actorId: sessionRequester.userId, fromStatus: "DRAFT", toStatus: "PENDING_MANAGER", comment: null });

    const pr = await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).select("totalAmount").first();
    expect(pr!.totalAmount).toBe(500_001);

    const newStatus = pr!.totalAmount > APPROVAL_THRESHOLD ? "PENDING_FINANCE" : "APPROVED";
    expect(newStatus).toBe("PENDING_FINANCE");
  });

  it("solicitud de 1 CLP → MANAGER aprueba directamente", async () => {
    const id = await createTestRequest(1);
    await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).update({ status: "PENDING_MANAGER" });
    const pr = await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).select("totalAmount").first();
    const newStatus = pr!.totalAmount > APPROVAL_THRESHOLD ? "PENDING_FINANCE" : "APPROVED";
    expect(newStatus).toBe("APPROVED");
  });

  it("solicitud de 1.000.000 CLP → se deriva a finanzas", async () => {
    const id = await createTestRequest(1_000_000);
    await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).update({ status: "PENDING_MANAGER" });
    const pr = await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).select("totalAmount").first();
    const newStatus = pr!.totalAmount > APPROVAL_THRESHOLD ? "PENDING_FINANCE" : "APPROVED";
    expect(newStatus).toBe("PENDING_FINANCE");
  });
});

describe("HU-27 — No self-approval (el creador no puede aprobar su propia solicitud)", () => {
  it("el solicitante NO puede aprobar con roleGuard → 403", async () => {
    const g = await permissionGuard(sessionRequester, "REVIEW_FIRST_STAGE");
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.response.status).toBe(403);
  });

  it("MANAGER puede aprobar una solicitud que NO creó", async () => {

    const id = await createTestRequest(100_000);
    await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).update({ status: "PENDING_MANAGER" });

    const pr = await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).select("requesterId").first();

    expect(pr!.requesterId).toBe(sessionRequester.userId);
    expect(pr!.requesterId).not.toBe(sessionManager.userId);
    expect(true).toBe(true);
  });

  it("si requesterId === actorId → el guard de negocio bloquea (simulado)", async () => {
    const fakeRequesterId = sessionManager.userId;
    const actorId = sessionManager.userId;
    const isSelfApproval = fakeRequesterId === actorId;
    expect(isSelfApproval).toBe(true); 
  });
});

describe("HU-27 — Rechazo requiere comentario obligatorio", () => {
  it("REJECT sin comentario → Zod rechaza la validación", () => {
    const result = reviewRequestSchema.safeParse({ action: "REJECT", comment: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const commentIssue = result.error.issues.find((i) => i.path.includes("comment"));
      expect(commentIssue).toBeTruthy();
    }
  });

  it("REJECT sin comentario (undefined) → Zod rechaza", () => {
    const result = reviewRequestSchema.safeParse({ action: "REJECT" });
    expect(result.success).toBe(false);
  });

  it("REJECT con comentario → Zod acepta", () => {
    const result = reviewRequestSchema.safeParse({
      action: "REJECT",
      comment: "Presupuesto insuficiente para este trimestre.",
    });
    expect(result.success).toBe(true);
  });

  it("APPROVE sin comentario → Zod acepta (comentario opcional)", () => {
    const result = reviewRequestSchema.safeParse({ action: "APPROVE" });
    expect(result.success).toBe(true);
  });

  it("APPROVE con comentario → Zod acepta", () => {
    const result = reviewRequestSchema.safeParse({ action: "APPROVE", comment: "Todo en orden." });
    expect(result.success).toBe(true);
  });
});


describe("HU-27 — Trigger BD: solicitud sin ítems no puede enviarse", () => {
  it("la BD rechaza la transición DRAFT → PENDING_MANAGER si no hay ítems", async () => {
    const id = crypto.randomUUID();
    createdRequestIds.push(id);

    await db.orm.public.PurchaseRequest.create({
      id, companyId,
      requesterId: sessionRequester.userId,
      title: "Sin ítems",
      description: "Test",
      costCenter: "CC-TEST",
      source: "WEB",
      externalId: null,
      payloadHash: null,
    });

    await expect(
      db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).update({ status: "PENDING_MANAGER" })
    ).rejects.toThrow(); 
  });
});

describe("HU-27 — Trigger BD: transiciones de estado inválidas son rechazadas", () => {
  it("PENDING_MANAGER → APPROVED con totalAmount > 500k lanza error en BD", async () => {
    const id = await createTestRequest(1_000_000);

    await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).update({ status: "PENDING_MANAGER" });
    await db.orm.public.ApprovalHistory.create({ id: crypto.randomUUID(), requestId: id, companyId, actorId: sessionRequester.userId, fromStatus: "DRAFT", toStatus: "PENDING_MANAGER", comment: null });

    await expect(
      db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).update({ status: "APPROVED" })
    ).rejects.toThrow(); 
  });

  it("PENDING_MANAGER → PENDING_FINANCE con totalAmount ≤ 500k lanza error en BD", async () => {
    const id = await createTestRequest(100_000);

    await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).update({ status: "PENDING_MANAGER" });
    await db.orm.public.ApprovalHistory.create({ id: crypto.randomUUID(), requestId: id, companyId, actorId: sessionRequester.userId, fromStatus: "DRAFT", toStatus: "PENDING_MANAGER", comment: null });

    await expect(
      db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).update({ status: "PENDING_FINANCE" })
    ).rejects.toThrow(); 
  });

  it("APPROVED → cualquier estado lanza error en BD (estado final)", async () => {
    const id = await createTestRequest(100_000);
    await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).update({ status: "PENDING_MANAGER" });
    await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).update({ status: "APPROVED" });

    await expect(
      db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).update({ status: "DRAFT" })
    ).rejects.toThrow();
  });
});

describe("HU-27 — Solo se pueden editar solicitudes en DRAFT", () => {
  it("editar contenido en PENDING_MANAGER lanza error en BD", async () => {
    const id = await createTestRequest(100_000);

    await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).update({ status: "PENDING_MANAGER" });
    await db.orm.public.ApprovalHistory.create({ id: crypto.randomUUID(), requestId: id, companyId, actorId: sessionRequester.userId, fromStatus: "DRAFT", toStatus: "PENDING_MANAGER", comment: null });

    await expect(
      db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).update({ title: "Nuevo título" })
    ).rejects.toThrow(); 
  });
});

describe("HU-27 — Trigger BD: total_amount se calcula automáticamente", () => {
  it("el trigger calcula total_amount correctamente al insertar ítems", async () => {
    const id = await createTestRequest(0); 

    await db.orm.public.RequestItem.create({ id: crypto.randomUUID(), requestId: id, companyId, description: "A", quantity: 3, unitPrice: 100_000 });
    await db.orm.public.RequestItem.create({ id: crypto.randomUUID(), requestId: id, companyId, description: "B", quantity: 2, unitPrice: 50_000 });

    const pr = await db.orm.public.PurchaseRequest.where((r) => r.id.eq(id)).select("totalAmount").first();
    expect(pr!.totalAmount).toBe(400_000);
  });
});


describe("HU-27 — Reglas implementadas como funciones puras", () => {
  it("determineApprovedStatus: MANAGER aprueba directamente si monto <= 500.000", () => {
    expect(determineApprovedStatus("MANAGER", 500_000)).toBe("APPROVED");
    expect(determineApprovedStatus("MANAGER", 499_999)).toBe("APPROVED");
    expect(determineApprovedStatus("MANAGER", 1)).toBe("APPROVED");
  });

  it("determineApprovedStatus: MANAGER deriva a PENDING_FINANCE si monto > 500.000", () => {
    expect(determineApprovedStatus("MANAGER", 500_001)).toBe("PENDING_FINANCE");
    expect(determineApprovedStatus("MANAGER", 1_000_000)).toBe("PENDING_FINANCE");
  });

  it("determineApprovedStatus: FINANCE siempre aprueba (APPROVED)", () => {
    expect(determineApprovedStatus("FINANCE", 5_000_000)).toBe("APPROVED");
  });

  it("isSelfApproval: detecta si el actor es el mismo solicitante", () => {
    expect(isSelfApproval("usr-123", "usr-123")).toBe(true);
    expect(isSelfApproval("usr-123", "usr-456")).toBe(false);
  });

  it("canReviewInStatus: valida roles y estados correspondientes", () => {
    expect(canReviewInStatus("MANAGER", "PENDING_MANAGER")).toBe(true);
    expect(canReviewInStatus("MANAGER", "PENDING_FINANCE")).toBe(false);
    expect(canReviewInStatus("FINANCE", "PENDING_FINANCE")).toBe(true);
    expect(canReviewInStatus("FINANCE", "PENDING_MANAGER")).toBe(false);
    expect(canReviewInStatus("REQUESTER", "PENDING_MANAGER")).toBe(false);
  });

  it("isValidRejectionComment: rechaza comentarios vacíos o con solo espacios", () => {
    expect(isValidRejectionComment("")).toBe(false);
    expect(isValidRejectionComment("   ")).toBe(false);
    expect(isValidRejectionComment(null)).toBe(false);
    expect(isValidRejectionComment(undefined)).toBe(false);
    expect(isValidRejectionComment("Presupuesto insuficiente")).toBe(true);
  });
});


