import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { apiError } from "@/lib/api-response";
import type { JWTPayload } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

export type GuardResult<T = JWTPayload> =
  | { ok: true; session: T }
  | { ok: false; response: NextResponse };


export const ROLE_PERMISSIONS = {
  CREATE_REQUEST: ["REQUESTER"] as UserRole[],

  EDIT_REQUEST: ["REQUESTER"] as UserRole[],

  SUBMIT_REQUEST: ["REQUESTER"] as UserRole[],

  REVIEW_FIRST_STAGE: ["MANAGER"] as UserRole[],

  REVIEW_SECOND_STAGE: ["FINANCE"] as UserRole[],

  LIST_REQUESTS: ["REQUESTER", "MANAGER", "FINANCE"] as UserRole[],

  VIEW_REQUEST: ["REQUESTER", "MANAGER", "FINANCE"] as UserRole[],
} as const;

export type PermissionKey = keyof typeof ROLE_PERMISSIONS;


async function resolveSession(
  injected?: JWTPayload | null
): Promise<JWTPayload | null> {
  if (injected !== undefined) return injected; 
  return getSession();                         
}


export async function authGuard(
  injectedSession?: JWTPayload | null
): Promise<GuardResult> {
  const session = await resolveSession(injectedSession);
  if (!session) {
    return {
      ok: false,
      response: apiError(401, "UNAUTHORIZED", "Debes iniciar sesión para continuar."),
    };
  }
  return { ok: true, session };
}

export async function roleGuard(
  injectedSession: JWTPayload | null | undefined,
  ...allowedRoles: UserRole[]
): Promise<GuardResult> {
  const auth = await authGuard(injectedSession);
  if (!auth.ok) return auth;

  if (!allowedRoles.includes(auth.session.role as UserRole)) {
    return {
      ok: false,
      response: apiError(
        403,
        "FORBIDDEN",
        `Acción no permitida para el rol ${auth.session.role}.`
      ),
    };
  }
  return auth;
}

export async function permissionGuard(
  injectedSession: JWTPayload | null | undefined,
  action: PermissionKey
): Promise<GuardResult> {
  return roleGuard(injectedSession, ...ROLE_PERMISSIONS[action]);
}


export async function companyGuard(
  resourceCompanyId: string,
  injectedSession?: JWTPayload | null
): Promise<GuardResult> {
  const auth = await authGuard(injectedSession);
  if (!auth.ok) return auth;

  if (auth.session.companyId !== resourceCompanyId) {
    return {
      ok: false,
      response: apiError(404, "NOT_FOUND", "Recurso no encontrado."),
    };
  }
  return auth;
}

export function getCompanyId(session: JWTPayload): string {
  return session.companyId;
}
