import { APPROVAL_THRESHOLD, type PurchaseRequestStatus, type UserRole } from "./types";


export function determineApprovedStatus(
  role: UserRole,
  totalAmount: number
): "APPROVED" | "PENDING_FINANCE" {
  if (role === "MANAGER") {
    return totalAmount > APPROVAL_THRESHOLD ? "PENDING_FINANCE" : "APPROVED";
  }
  if (role === "FINANCE") {
    return "APPROVED";
  }
  throw new Error(`El rol '${role}' no está facultado para emitir aprobaciones.`);
}


export function isSelfApproval(requesterId: string, actorId: string): boolean {
  return requesterId === actorId;
}


export function canReviewInStatus(role: UserRole, currentStatus: string): boolean {
  if (role === "MANAGER") return currentStatus === "PENDING_MANAGER";
  if (role === "FINANCE") return currentStatus === "PENDING_FINANCE";
  return false;
}


export function isValidRejectionComment(comment?: string | null): boolean {
  return typeof comment === "string" && comment.trim().length > 0;
}

