/**
 * Guards de autenticación, autorización y aislamiento multiempresa.
 *
 * HU-02: companyId siempre viene del JWT, nunca de params del cliente.
 * HU-03: roles permitidos se verifican antes de cualquier operación.
 *
 * Diseño testeable: los guards aceptan una sesión inyectada opcional.
 * En producción (route handlers) se llama sin sesión → la lee de cookies.
 * En tests se pasa la sesión directamente → sin necesidad de cookies ni HTTP.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { apiError } from "@/lib/api-response";
import type { JWTPayload } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Resultado de un guard: sesión válida o respuesta de error lista para retornar */
export type GuardResult<T = JWTPayload> =
  | { ok: true; session: T }
  | { ok: false; response: NextResponse };

// ─── Matriz de permisos por rol (HU-03) ──────────────────────────────────────
//
// REQUESTER : crea solicitudes, edita sus propias solicitudes en DRAFT, envía a aprobación.
// MANAGER   : aprueba o rechaza la primera etapa (PENDING_MANAGER).
//             Si total > 500.000 → deriva a PENDING_FINANCE.
//             Si total ≤ 500.000 → aprueba directamente (APPROVED).
// FINANCE   : aprueba o rechaza la segunda etapa (PENDING_FINANCE).
//             Solo actúa sobre solicitudes que superan el umbral.
//
// La validación SIEMPRE se hace en el servidor (nunca confiar solo en la UI).

/** Acciones del sistema y qué roles pueden ejecutarlas */
export const ROLE_PERMISSIONS = {
  /** Crear una nueva solicitud de compra */
  CREATE_REQUEST: ["REQUESTER"] as UserRole[],

  /** Editar una solicitud en estado DRAFT (solo el creador) */
  EDIT_REQUEST: ["REQUESTER"] as UserRole[],

  /** Enviar solicitud a aprobación (DRAFT → PENDING_MANAGER) */
  SUBMIT_REQUEST: ["REQUESTER"] as UserRole[],

  /** Aprobar/rechazar primera etapa (PENDING_MANAGER) */
  REVIEW_FIRST_STAGE: ["MANAGER"] as UserRole[],

  /** Aprobar/rechazar segunda etapa (PENDING_FINANCE) */
  REVIEW_SECOND_STAGE: ["FINANCE"] as UserRole[],

  /** Ver lista de solicitudes (todos los roles) */
  LIST_REQUESTS: ["REQUESTER", "MANAGER", "FINANCE"] as UserRole[],

  /** Ver detalle de una solicitud (todos los roles) */
  VIEW_REQUEST: ["REQUESTER", "MANAGER", "FINANCE"] as UserRole[],
} as const;

export type PermissionKey = keyof typeof ROLE_PERMISSIONS;

// ─── Resolución de sesión ────────────────────────────────────────────────────

/**
 * Resuelve la sesión: usa la inyectada (para tests) o la lee de cookies (producción).
 * `null` explícito = sin sesión (útil en tests para simular usuario anónimo).
 */
async function resolveSession(
  injected?: JWTPayload | null
): Promise<JWTPayload | null> {
  if (injected !== undefined) return injected; // test: sesión inyectada o null explícito
  return getSession();                          // producción: lee de cookie HttpOnly
}

// ─── HU-01: Autenticación ─────────────────────────────────────────────────────

/**
 * Verifica que el usuario esté autenticado.
 *
 * En route handlers (producción):
 *   const guard = await authGuard();
 *
 * En tests:
 *   const guard = await authGuard(sessionAlpha);  // con sesión
 *   const guard = await authGuard(null);           // sin sesión → 401
 */
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

// ─── HU-03: Control de roles ──────────────────────────────────────────────────

/**
 * Verifica autenticación y que el rol esté entre los permitidos.
 * Retorna 401 si no hay sesión, 403 si el rol no está autorizado.
 * La validación ocurre en el SERVIDOR, independientemente de la UI.
 *
 * En route handlers:
 *   const guard = await roleGuard(undefined, "MANAGER", "FINANCE");
 *   if (!guard.ok) return guard.response; // NextResponse 403
 *
 * En tests:
 *   const guard = await roleGuard(sessionManager, "MANAGER");
 */
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

/**
 * Guard semántico: verifica permiso por nombre de acción.
 * Usa la tabla ROLE_PERMISSIONS para determinar los roles autorizados.
 *
 * @example
 * // En un route handler de aprobación:
 * const guard = await permissionGuard(undefined, "REVIEW_FIRST_STAGE");
 * if (!guard.ok) return guard.response; // 403 si no es MANAGER
 *
 * @example
 * // En un test:
 * const guard = await permissionGuard(sessionRequester, "REVIEW_FIRST_STAGE");
 * expect(guard.ok).toBe(false); // REQUESTER no puede aprobar
 */
export async function permissionGuard(
  injectedSession: JWTPayload | null | undefined,
  action: PermissionKey
): Promise<GuardResult> {
  return roleGuard(injectedSession, ...ROLE_PERMISSIONS[action]);
}

// ─── HU-02: Aislamiento multiempresa ─────────────────────────────────────────

/**
 * Verifica que el recurso pertenece a la empresa del usuario autenticado.
 * El companyId se extrae SIEMPRE del JWT — nunca de params del cliente.
 *
 * Retorna 401 si no hay sesión, 404 si el recurso es de otra empresa.
 * Usa 404 (no 403) para no revelar la existencia del recurso en otra empresa.
 */
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

/**
 * Extrae el companyId del JWT de forma explícita para usarlo en queries.
 * NUNCA usar el companyId que venga de params/body del cliente.
 */
export function getCompanyId(session: JWTPayload): string {
  return session.companyId;
}
