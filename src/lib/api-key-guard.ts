/**
 * Middleware de autenticación por API Key para la API externa.
 * HU-19: Las solicitudes externas se autentican con X-API-Key.
 *
 * Flujo:
 * 1. Leer el header X-API-Key
 * 2. Hashear con SHA-256
 * 3. Buscar en api_keys donde key_hash = hash AND revoked_at IS NULL
 * 4. Actualizar last_used_at
 * 5. Retornar el companyId asociado a la API Key
 */

import crypto from "crypto";
import { db } from "@/prisma/db";
import { apiError } from "@/lib/api-response";
import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

export interface ApiKeyContext {
  companyId: string;
  apiKeyId: string;
}

export type ApiKeyGuardResult =
  | { ok: true; context: ApiKeyContext }
  | { ok: false; response: NextResponse };

/**
 * Verifica la API Key del header X-API-Key o Authorization: Bearer.
 * Retorna el companyId si es válida, 401 si no existe o está revocada.
 */
export async function apiKeyGuard(request: NextRequest): Promise<ApiKeyGuardResult> {
  // HU-19: Se envía en header (X-API-Key o Authorization: Bearer)
  let rawKey = request.headers.get("X-API-Key");

  if (!rawKey || rawKey.trim().length === 0) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      rawKey = authHeader.slice(7).trim();
    }
  }

  if (!rawKey || rawKey.trim().length === 0) {
    return {
      ok: false,
      response: apiError(401, "MISSING_API_KEY", "Se requiere el header X-API-Key o Authorization: Bearer."),
    };
  }

  // Hashear la clave recibida
  const keyHash = crypto.createHash("sha256").update(rawKey.trim()).digest("hex");

  // Buscar en la BD (solo claves no revocadas)
  const apiKey = await db.orm.public.ApiKey
    .where((k) => k.keyHash.eq(keyHash))
    .select("id", "companyId", "revokedAt")
    .first();

  if (!apiKey) {
    return {
      ok: false,
      response: apiError(401, "INVALID_API_KEY", "API Key inválida o no existe."),
    };
  }

  if (apiKey.revokedAt !== null) {
    return {
      ok: false,
      response: apiError(401, "REVOKED_API_KEY", "Esta API Key ha sido revocada."),
    };
  }

  // Actualizar last_used_at de forma no bloqueante
  db.orm.public.ApiKey
    .where((k) => k.id.eq(apiKey.id))
    .update({ lastUsedAt: new Date().toISOString() })
    .catch(() => { /* no crítico */ });

  return {
    ok: true,
    context: {
      companyId: apiKey.companyId,
      apiKeyId: apiKey.id,
    },
  };
}

