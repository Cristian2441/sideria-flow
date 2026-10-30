export type UserRole = "REQUESTER" | "MANAGER" | "FINANCE";


export type PurchaseRequestStatus =
  | "DRAFT"
  | "PENDING_MANAGER"
  | "PENDING_FINANCE"
  | "APPROVED"
  | "REJECTED";

export type RequestSource = "WEB" | "API";

export const USER_ROLES: UserRole[] = ["REQUESTER", "MANAGER", "FINANCE"];

export const PURCHASE_REQUEST_STATUSES: PurchaseRequestStatus[] = [
  "DRAFT",
  "PENDING_MANAGER",
  "PENDING_FINANCE",
  "APPROVED",
  "REJECTED",
];

export const APPROVAL_THRESHOLD = 500_000;


export interface Company {
  id: string;
  name: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  companyId: string;
  createdAt: string;
}

export interface PurchaseRequest {
  id: string;
  companyId: string;
  requesterId: string;
  title: string;
  description: string;
  costCenter: string;
  status: PurchaseRequestStatus;
  totalAmount: number; 
  source: RequestSource;
  externalId: string | null;
  payloadHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequestItem {
  id: string;
  requestId: string;
  companyId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  createdAt: string;
}

export interface ApprovalHistory {
  id: string;
  requestId: string;
  companyId: string;
  actorId: string;
  fromStatus: PurchaseRequestStatus | null;
  toStatus: PurchaseRequestStatus;
  comment: string | null;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  companyId: string;
  name: string;
  prefix: string;
  keyHash: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}
