/**
 * Seed de datos iniciales para Sideria Flow.
 *
 * Crea:
 *  - 2 empresas: "Empresa Alpha" y "Empresa Beta"
 *  - 3 usuarios por empresa (REQUESTER, MANAGER, FINANCE)
 *  - 1 API Key por empresa
 *  - Solicitudes de compra en distintos estados por empresa
 *
 * IMPORTANTE: Los triggers de la BD imponen las reglas de negocio.
 *  - Toda solicitud nueva nace en DRAFT (trigger force_draft_on_insert)
 *  - Los ítems solo se pueden agregar mientras la solicitud es DRAFT
 *  - total_amount lo calcula automáticamente el trigger sync_request_total_amount
 *  - Las transiciones de estado las valida guard_request_update
 *  - approval_history es inmutable (trigger forbid_history_changes)
 *
 * Uso:
 *   npx tsx prisma/seed.ts
 */

import "dotenv/config";
import { db } from "../src/prisma/db";
import { hashSync } from "bcryptjs";
import crypto from "crypto";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newId(): string {
  return crypto.randomUUID();
}

function hashPassword(plain: string): string {
  return hashSync(plain, 10);
}

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

// ─── Constantes ───────────────────────────────────────────────────────────────

// API keys en texto plano (documentadas en README)
const API_KEY_ALPHA = "sf_alpha_key_1234567890abcdef";
const API_KEY_BETA = "sf_beta_key_abcdef1234567890";

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Iniciando seed de Sideria Flow...\n");

  // ── 1. Limpiar datos previos (orden inverso de FK) ──────────────────────────
  console.log("🧹 Limpiando datos anteriores...");
  await db.orm.public.ApprovalHistory.where((f) => f.id.isNotNull()).deleteAll();
  await db.orm.public.RequestItem.where((f) => f.id.isNotNull()).deleteAll();
  await db.orm.public.PurchaseRequest.where((f) => f.id.isNotNull()).deleteAll();
  await db.orm.public.ApiKey.where((f) => f.id.isNotNull()).deleteAll();
  await db.orm.public.User.where((f) => f.id.isNotNull()).deleteAll();
  await db.orm.public.Company.where((f) => f.id.isNotNull()).deleteAll();
  console.log("  ✓ Tablas limpiadas\n");

  // ── 2. Empresas ─────────────────────────────────────────────────────────────
  const alphaId = newId();
  const betaId = newId();

  await db.orm.public.Company.create({ id: alphaId, name: "Empresa Alpha" });
  await db.orm.public.Company.create({ id: betaId, name: "Empresa Beta" });
  console.log("✅ Empresas creadas: Alpha y Beta");

  // ── 3. Usuarios ─────────────────────────────────────────────────────────────
  const reqAlphaId = newId();
  const mgrAlphaId = newId();
  const finAlphaId = newId();
  const reqBetaId = newId();
  const mgrBetaId = newId();
  const finBetaId = newId();

  const pw = hashPassword("Password123!");

  // Empresa Alpha
  await db.orm.public.User.create({
    id: reqAlphaId,
    companyId: alphaId,
    email: "solicitante@alpha.cl",
    name: "Ana Solicitante",
    passwordHash: pw,
    role: "REQUESTER",
  });
  await db.orm.public.User.create({
    id: mgrAlphaId,
    companyId: alphaId,
    email: "jefatura@alpha.cl",
    name: "Juan Jefatura",
    passwordHash: pw,
    role: "MANAGER",
  });
  await db.orm.public.User.create({
    id: finAlphaId,
    companyId: alphaId,
    email: "finanzas@alpha.cl",
    name: "María Finanzas",
    passwordHash: pw,
    role: "FINANCE",
  });

  // Empresa Beta
  await db.orm.public.User.create({
    id: reqBetaId,
    companyId: betaId,
    email: "solicitante@beta.cl",
    name: "Carlos Solicitante",
    passwordHash: pw,
    role: "REQUESTER",
  });
  await db.orm.public.User.create({
    id: mgrBetaId,
    companyId: betaId,
    email: "jefatura@beta.cl",
    name: "Laura Jefatura",
    passwordHash: pw,
    role: "MANAGER",
  });
  await db.orm.public.User.create({
    id: finBetaId,
    companyId: betaId,
    email: "finanzas@beta.cl",
    name: "Pedro Finanzas",
    passwordHash: pw,
    role: "FINANCE",
  });
  console.log("✅ 6 usuarios creados (3 por empresa)");

  // ── 4. API Keys ─────────────────────────────────────────────────────────────
  await db.orm.public.ApiKey.create({
    id: newId(),
    companyId: alphaId,
    name: "Clave API Alpha",
    prefix: API_KEY_ALPHA.slice(0, 8),
    keyHash: hashApiKey(API_KEY_ALPHA),
  });
  await db.orm.public.ApiKey.create({
    id: newId(),
    companyId: betaId,
    name: "Clave API Beta",
    prefix: API_KEY_BETA.slice(0, 8),
    keyHash: hashApiKey(API_KEY_BETA),
  });
  console.log("✅ API Keys creadas");

  // ── 5. Solicitudes de compra ────────────────────────────────────────────────
  // REGLAS DEL TRIGGER:
  //   - Toda solicitud se crea como DRAFT
  //   - Se agregan ítems ANTES de cambiar estado (trigger calcula total_amount)
  //   - Para ir a PENDING_MANAGER: debe tener al menos un ítem
  //   - Para ir a APPROVED directamente desde PENDING_MANAGER: total <= 500.000
  //   - Para ir a PENDING_FINANCE: total > 500.000
  //   - approval_history se registra DESPUÉS del cambio de estado

  // ── 5.1 DRAFT - Alpha ───────────────────────────────────────────────────────
  const r1 = newId();
  await db.orm.public.PurchaseRequest.create({
    id: r1,
    companyId: alphaId,
    requesterId: reqAlphaId,
    title: "Material de oficina",
    description: "Resmas de papel, bolígrafos y carpetas para el trimestre",
    costCenter: "CC-ADM",
    source: "WEB",
    externalId: null,
    payloadHash: null,
  });
  // Agregar ítems (trigger calculará total_amount: 3000 + 8000 = 11000)
  await db.orm.public.RequestItem.create({
    id: newId(),
    requestId: r1,
    companyId: alphaId,
    description: "Resma papel A4 500 hojas",
    quantity: 10,
    unitPrice: 300,
  });
  await db.orm.public.RequestItem.create({
    id: newId(),
    requestId: r1,
    companyId: alphaId,
    description: "Set bolígrafos (12 unidades)",
    quantity: 4,
    unitPrice: 2000,
  });
  console.log("  ✓ Solicitud 1: DRAFT (Alpha)");

  // ── 5.2 PENDING_MANAGER - Alpha (total <= 500k → jefatura puede aprobar) ───
  const r2 = newId();
  await db.orm.public.PurchaseRequest.create({
    id: r2,
    companyId: alphaId,
    requesterId: reqAlphaId,
    title: "Sillas ergonómicas",
    description: "Sillas para el área de desarrollo",
    costCenter: "CC-TI",
    source: "WEB",
    externalId: null,
    payloadHash: null,
  });
  await db.orm.public.RequestItem.create({
    id: newId(),
    requestId: r2,
    companyId: alphaId,
    description: "Silla ergonómica ejecutiva",
    quantity: 4,
    unitPrice: 85000,
  });
  // Transición DRAFT → PENDING_MANAGER
  await db.orm.public.PurchaseRequest.where((r) => r.id.eq(r2)).update({
    status: "PENDING_MANAGER",
  });
  await db.orm.public.ApprovalHistory.create({
    id: newId(),
    requestId: r2,
    companyId: alphaId,
    actorId: reqAlphaId,
    fromStatus: "DRAFT",
    toStatus: "PENDING_MANAGER",
    comment: null,
  });
  console.log("  ✓ Solicitud 2: PENDING_MANAGER (Alpha, 340k - solo jefatura)");

  // ── 5.3 APPROVED (via PENDING_MANAGER, total ≤ 500k) - Alpha ───────────────
  const r3 = newId();
  await db.orm.public.PurchaseRequest.create({
    id: r3,
    companyId: alphaId,
    requesterId: reqAlphaId,
    title: "Licencias software antivirus",
    description: "Renovación anual de licencias para toda la empresa",
    costCenter: "CC-TI",
    source: "WEB",
    externalId: null,
    payloadHash: null,
  });
  await db.orm.public.RequestItem.create({
    id: newId(),
    requestId: r3,
    companyId: alphaId,
    description: "Licencia antivirus anual",
    quantity: 5,
    unitPrice: 45000,
  });
  // DRAFT → PENDING_MANAGER
  await db.orm.public.PurchaseRequest.where((r) => r.id.eq(r3)).update({
    status: "PENDING_MANAGER",
  });
  await db.orm.public.ApprovalHistory.create({
    id: newId(),
    requestId: r3,
    companyId: alphaId,
    actorId: reqAlphaId,
    fromStatus: "DRAFT",
    toStatus: "PENDING_MANAGER",
    comment: null,
  });
  // PENDING_MANAGER → APPROVED (225k ≤ 500k)
  await db.orm.public.PurchaseRequest.where((r) => r.id.eq(r3)).update({
    status: "APPROVED",
  });
  await db.orm.public.ApprovalHistory.create({
    id: newId(),
    requestId: r3,
    companyId: alphaId,
    actorId: mgrAlphaId,
    fromStatus: "PENDING_MANAGER",
    toStatus: "APPROVED",
    comment: "Aprobado. Prioridad renovación de seguridad.",
  });
  console.log("  ✓ Solicitud 3: APPROVED (Alpha, 225k - solo jefatura)");

  // ── 5.4 PENDING_FINANCE - Alpha (total > 500k) ──────────────────────────────
  const r4 = newId();
  await db.orm.public.PurchaseRequest.create({
    id: r4,
    companyId: alphaId,
    requesterId: reqAlphaId,
    title: "Servidor de producción",
    description: "Servidor para ampliación de infraestructura cloud-local",
    costCenter: "CC-INF",
    source: "WEB",
    externalId: null,
    payloadHash: null,
  });
  await db.orm.public.RequestItem.create({
    id: newId(),
    requestId: r4,
    companyId: alphaId,
    description: 'Servidor Dell PowerEdge R740 (32GB RAM, 4TB HDD)',
    quantity: 1,
    unitPrice: 1800000,
  });
  await db.orm.public.RequestItem.create({
    id: newId(),
    requestId: r4,
    companyId: alphaId,
    description: "UPS 3000VA para servidor",
    quantity: 1,
    unitPrice: 280000,
  });
  // DRAFT → PENDING_MANAGER
  await db.orm.public.PurchaseRequest.where((r) => r.id.eq(r4)).update({
    status: "PENDING_MANAGER",
  });
  await db.orm.public.ApprovalHistory.create({
    id: newId(),
    requestId: r4,
    companyId: alphaId,
    actorId: reqAlphaId,
    fromStatus: "DRAFT",
    toStatus: "PENDING_MANAGER",
    comment: null,
  });
  // PENDING_MANAGER → PENDING_FINANCE (2.08M > 500k)
  await db.orm.public.PurchaseRequest.where((r) => r.id.eq(r4)).update({
    status: "PENDING_FINANCE",
  });
  await db.orm.public.ApprovalHistory.create({
    id: newId(),
    requestId: r4,
    companyId: alphaId,
    actorId: mgrAlphaId,
    fromStatus: "PENDING_MANAGER",
    toStatus: "PENDING_FINANCE",
    comment: "Monto supera umbral. Requiere aprobación de finanzas.",
  });
  console.log("  ✓ Solicitud 4: PENDING_FINANCE (Alpha, 2.08M - requiere finanzas)");

  // ── 5.5 REJECTED - Alpha ────────────────────────────────────────────────────
  const r5 = newId();
  await db.orm.public.PurchaseRequest.create({
    id: r5,
    companyId: alphaId,
    requesterId: reqAlphaId,
    title: "Capacitación en el extranjero",
    description: "Viaje a conferencia internacional de tecnología",
    costCenter: "CC-CAP",
    source: "WEB",
    externalId: null,
    payloadHash: null,
  });
  await db.orm.public.RequestItem.create({
    id: newId(),
    requestId: r5,
    companyId: alphaId,
    description: "Pasaje aéreo ida y vuelta",
    quantity: 1,
    unitPrice: 450000,
  });
  await db.orm.public.RequestItem.create({
    id: newId(),
    requestId: r5,
    companyId: alphaId,
    description: "Alojamiento 3 noches",
    quantity: 3,
    unitPrice: 100000,
  });
  // DRAFT → PENDING_MANAGER
  await db.orm.public.PurchaseRequest.where((r) => r.id.eq(r5)).update({
    status: "PENDING_MANAGER",
  });
  await db.orm.public.ApprovalHistory.create({
    id: newId(),
    requestId: r5,
    companyId: alphaId,
    actorId: reqAlphaId,
    fromStatus: "DRAFT",
    toStatus: "PENDING_MANAGER",
    comment: null,
  });
  // PENDING_MANAGER → REJECTED
  await db.orm.public.PurchaseRequest.where((r) => r.id.eq(r5)).update({
    status: "REJECTED",
  });
  await db.orm.public.ApprovalHistory.create({
    id: newId(),
    requestId: r5,
    companyId: alphaId,
    actorId: mgrAlphaId,
    fromStatus: "PENDING_MANAGER",
    toStatus: "REJECTED",
    comment: "Presupuesto de capacitación agotado para este semestre.",
  });
  console.log("  ✓ Solicitud 5: REJECTED (Alpha)");

  // ── 5.6 DRAFT - Beta ────────────────────────────────────────────────────────
  const r6 = newId();
  await db.orm.public.PurchaseRequest.create({
    id: r6,
    companyId: betaId,
    requesterId: reqBetaId,
    title: "Equipos de limpieza",
    description: "Aspiradoras industriales para oficinas",
    costCenter: "CC-FAC",
    source: "WEB",
    externalId: null,
    payloadHash: null,
  });
  await db.orm.public.RequestItem.create({
    id: newId(),
    requestId: r6,
    companyId: betaId,
    description: "Aspiradora industrial",
    quantity: 3,
    unitPrice: 65000,
  });
  console.log("  ✓ Solicitud 6: DRAFT (Beta)");

  // ── 5.7 PENDING_MANAGER - Beta ───────────────────────────────────────────────
  const r7 = newId();
  await db.orm.public.PurchaseRequest.create({
    id: r7,
    companyId: betaId,
    requesterId: reqBetaId,
    title: "Mobiliario sala de reuniones",
    description: "Mesa de reuniones y sillas para sala principal",
    costCenter: "CC-ADM",
    source: "WEB",
    externalId: null,
    payloadHash: null,
  });
  await db.orm.public.RequestItem.create({
    id: newId(),
    requestId: r7,
    companyId: betaId,
    description: "Mesa de reuniones 10 pax",
    quantity: 1,
    unitPrice: 250000,
  });
  await db.orm.public.RequestItem.create({
    id: newId(),
    requestId: r7,
    companyId: betaId,
    description: "Sillas de reunión",
    quantity: 8,
    unitPrice: 21250,
  });
  // DRAFT → PENDING_MANAGER
  await db.orm.public.PurchaseRequest.where((r) => r.id.eq(r7)).update({
    status: "PENDING_MANAGER",
  });
  await db.orm.public.ApprovalHistory.create({
    id: newId(),
    requestId: r7,
    companyId: betaId,
    actorId: reqBetaId,
    fromStatus: "DRAFT",
    toStatus: "PENDING_MANAGER",
    comment: null,
  });
  console.log("  ✓ Solicitud 7: PENDING_MANAGER (Beta)");

  // ── 5.8 APPROVED via FINANCE - Alpha ─────────────────────────────────────────
  const r8 = newId();
  await db.orm.public.PurchaseRequest.create({
    id: r8,
    companyId: alphaId,
    requesterId: reqAlphaId,
    title: "Renovación equipos audiovisuales",
    description: "Proyectores y pantallas para salas de reuniones",
    costCenter: "CC-ADM",
    source: "WEB",
    externalId: null,
    payloadHash: null,
  });
  await db.orm.public.RequestItem.create({
    id: newId(),
    requestId: r8,
    companyId: alphaId,
    description: "Proyector Full HD",
    quantity: 3,
    unitPrice: 250000,
  });
  await db.orm.public.RequestItem.create({
    id: newId(),
    requestId: r8,
    companyId: alphaId,
    description: "Pantalla motorizada 120\"",
    quantity: 3,
    unitPrice: 150000,
  });
  // DRAFT → PENDING_MANAGER
  await db.orm.public.PurchaseRequest.where((r) => r.id.eq(r8)).update({
    status: "PENDING_MANAGER",
  });
  await db.orm.public.ApprovalHistory.create({
    id: newId(),
    requestId: r8,
    companyId: alphaId,
    actorId: reqAlphaId,
    fromStatus: "DRAFT",
    toStatus: "PENDING_MANAGER",
    comment: null,
  });
  // PENDING_MANAGER → PENDING_FINANCE (1.2M > 500k)
  await db.orm.public.PurchaseRequest.where((r) => r.id.eq(r8)).update({
    status: "PENDING_FINANCE",
  });
  await db.orm.public.ApprovalHistory.create({
    id: newId(),
    requestId: r8,
    companyId: alphaId,
    actorId: mgrAlphaId,
    fromStatus: "PENDING_MANAGER",
    toStatus: "PENDING_FINANCE",
    comment: "Monto supera umbral. Derivado a finanzas.",
  });
  // PENDING_FINANCE → APPROVED
  await db.orm.public.PurchaseRequest.where((r) => r.id.eq(r8)).update({
    status: "APPROVED",
  });
  await db.orm.public.ApprovalHistory.create({
    id: newId(),
    requestId: r8,
    companyId: alphaId,
    actorId: finAlphaId,
    fromStatus: "PENDING_FINANCE",
    toStatus: "APPROVED",
    comment: "Aprobado. Inversión justificada por plan de modernización.",
  });
  console.log("  ✓ Solicitud 8: APPROVED via FINANCE (Alpha, 1.2M)");

  console.log("\n✅ 8 solicitudes de compra creadas (6 Alpha + 2 Beta)");

  // ── Cerrar conexión ─────────────────────────────────────────────────────────
  await db.close();

  // ── Resumen ─────────────────────────────────────────────────────────────────
  console.log("\n🎉 Seed completado exitosamente.\n");
  console.log("═".repeat(52));
  console.log("  CREDENCIALES DE ACCESO");
  console.log("═".repeat(52));
  console.log("\n🏢 EMPRESA ALPHA");
  console.log("  Solicitante → solicitante@alpha.cl → Password123!");
  console.log("  Jefatura    → jefatura@alpha.cl    → Password123!");
  console.log("  Finanzas    → finanzas@alpha.cl    → Password123!");
  console.log(`  API Key     → ${API_KEY_ALPHA}`);
  console.log("\n🏢 EMPRESA BETA");
  console.log("  Solicitante → solicitante@beta.cl  → Password123!");
  console.log("  Jefatura    → jefatura@beta.cl     → Password123!");
  console.log("  Finanzas    → finanzas@beta.cl     → Password123!");
  console.log(`  API Key     → ${API_KEY_BETA}`);
  console.log("═".repeat(52) + "\n");
}

main().catch(async (e) => {
  console.error("❌ Error en seed:", e);
  await db.close();
  process.exit(1);
});
