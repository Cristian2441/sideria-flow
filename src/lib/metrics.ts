/**
 * HU-31: Funciones puras de cálculo de métricas del dashboard de indicadores.
 */
import type { PurchaseRequestStatus } from "./types";

export interface StatusCount {
  status: PurchaseRequestStatus;
  count: number;
}

export interface ApprovalHistoryEntry {
  requestId: string;
  toStatus: string;
  createdAt: string;
}

export interface RequestCreatedAt {
  id: string;
  createdAt: string;
}

/**
 * Cuenta solicitudes por estado dado un array de { status }.
 */
export function countByStatus(
  requests: Array<{ status: string }>
): Record<PurchaseRequestStatus, number> {
  const counts: Record<PurchaseRequestStatus, number> = {
    DRAFT: 0,
    PENDING_MANAGER: 0,
    PENDING_FINANCE: 0,
    APPROVED: 0,
    REJECTED: 0,
  };
  for (const r of requests) {
    const s = r.status as PurchaseRequestStatus;
    if (s in counts) counts[s]++;
  }
  return counts;
}

/**
 * Suma el totalAmount de todas las solicitudes con status APPROVED.
 */
export function sumApprovedAmount(
  requests: Array<{ status: string; totalAmount: number | string }>
): number {
  return requests
    .filter((r) => r.status === "APPROVED")
    .reduce((acc, r) => acc + Number(r.totalAmount), 0);
}

/**
 * Calcula el tiempo medio de aprobación en horas.
 * Para cada solicitud APPROVED, calcula la diferencia entre la createdAt de la
 * PurchaseRequest y el createdAt del ApprovalHistory entry con toStatus=APPROVED.
 * Retorna null si no hay datos suficientes.
 */
export function avgApprovalTimeHours(
  history: ApprovalHistoryEntry[],
  requests: RequestCreatedAt[]
): number | null {
  const requestMap = new Map(requests.map((r) => [r.id, r.createdAt]));

  const approvalEntries = history.filter((h) => h.toStatus === "APPROVED");
  if (approvalEntries.length === 0) return null;

  const durations: number[] = [];
  for (const entry of approvalEntries) {
    const requestCreatedAt = requestMap.get(entry.requestId);
    if (!requestCreatedAt) continue;
    const diffMs =
      new Date(entry.createdAt).getTime() -
      new Date(requestCreatedAt).getTime();
    if (diffMs >= 0) durations.push(diffMs);
  }

  if (durations.length === 0) return null;
  const avgMs = durations.reduce((a, b) => a + b, 0) / durations.length;
  return Math.round((avgMs / (1000 * 60 * 60)) * 10) / 10; // horas con 1 decimal
}

