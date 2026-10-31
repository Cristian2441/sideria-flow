/**
 * HU-31: Tests de funciones puras de métricas del dashboard de indicadores.
 */
import { describe, it, expect } from "vitest";
import { countByStatus, sumApprovedAmount, avgApprovalTimeHours } from "../src/lib/metrics";

describe("HU-31: countByStatus", () => {
  it("cuenta correctamente por estado", () => {
    const requests = [
      { status: "DRAFT" },
      { status: "DRAFT" },
      { status: "PENDING_MANAGER" },
      { status: "APPROVED" },
      { status: "REJECTED" },
    ];
    const result = countByStatus(requests);
    expect(result.DRAFT).toBe(2);
    expect(result.PENDING_MANAGER).toBe(1);
    expect(result.PENDING_FINANCE).toBe(0);
    expect(result.APPROVED).toBe(1);
    expect(result.REJECTED).toBe(1);
  });

  it("retorna ceros si no hay solicitudes", () => {
    const result = countByStatus([]);
    expect(Object.values(result).every((v) => v === 0)).toBe(true);
  });
});

describe("HU-31: sumApprovedAmount", () => {
  it("suma solo solicitudes APPROVED", () => {
    const requests = [
      { status: "APPROVED", totalAmount: 500000 },
      { status: "APPROVED", totalAmount: 1200000 },
      { status: "REJECTED", totalAmount: 300000 },
      { status: "DRAFT", totalAmount: 100000 },
    ];
    expect(sumApprovedAmount(requests)).toBe(1700000);
  });

  it("acepta totalAmount como string (viene así de la DB)", () => {
    const requests = [
      { status: "APPROVED", totalAmount: "750000" as unknown as number },
    ];
    expect(sumApprovedAmount(requests)).toBe(750000);
  });

  it("retorna 0 si no hay solicitudes aprobadas", () => {
    expect(sumApprovedAmount([{ status: "DRAFT", totalAmount: 100 }])).toBe(0);
  });
});

describe("HU-31: avgApprovalTimeHours", () => {
  it("calcula correctamente el tiempo medio en horas", () => {
    const base = new Date("2026-01-01T00:00:00Z");
    const twoHoursLater = new Date(base.getTime() + 2 * 60 * 60 * 1000);
    const fourHoursLater = new Date(base.getTime() + 4 * 60 * 60 * 1000);

    const history = [
      { requestId: "r1", toStatus: "APPROVED", createdAt: twoHoursLater.toISOString() },
      { requestId: "r2", toStatus: "APPROVED", createdAt: fourHoursLater.toISOString() },
      { requestId: "r3", toStatus: "REJECTED", createdAt: twoHoursLater.toISOString() },
    ];
    const requests = [
      { id: "r1", createdAt: base.toISOString() },
      { id: "r2", createdAt: base.toISOString() },
      { id: "r3", createdAt: base.toISOString() },
    ];

    const avg = avgApprovalTimeHours(history, requests);
    expect(avg).toBe(3); // (2 + 4) / 2 = 3 horas
  });

  it("retorna null si no hay entradas APPROVED", () => {
    const history = [{ requestId: "r1", toStatus: "REJECTED", createdAt: new Date().toISOString() }];
    const requests = [{ id: "r1", createdAt: new Date().toISOString() }];
    expect(avgApprovalTimeHours(history, requests)).toBeNull();
  });

  it("retorna null si history está vacío", () => {
    expect(avgApprovalTimeHours([], [])).toBeNull();
  });

  it("redondea a 1 decimal", () => {
    const base = new Date("2026-01-01T00:00:00Z");
    const history = [
      { requestId: "r1", toStatus: "APPROVED", createdAt: new Date(base.getTime() + 1.5 * 60 * 60 * 1000).toISOString() },
    ];
    const requests = [{ id: "r1", createdAt: base.toISOString() }];
    expect(avgApprovalTimeHours(history, requests)).toBe(1.5);
  });
});

