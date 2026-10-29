/**
 * Rate Limiter simple en memoria para la API externa (HU-21).
 * Limita el número de peticiones por clave (API Key o IP) en una ventana de tiempo.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minuto
const DEFAULT_MAX_REQUESTS = 60; // 60 peticiones por minuto por cliente

const store = new Map<string, RateLimitRecord>();

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp en segundos
}

/**
 * Verifica si la clave ha excedido su límite de tasa.
 */
export function checkRateLimit(
  key: string,
  limit: number = DEFAULT_MAX_REQUESTS,
  windowMs: number = DEFAULT_WINDOW_MS
): RateLimitResult {
  const now = Date.now();
  const record = store.get(key);

  if (!record || now >= record.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      reset: Math.ceil((now + windowMs) / 1000),
    };
  }

  if (record.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      reset: Math.ceil(record.resetAt / 1000),
    };
  }

  record.count += 1;
  return {
    allowed: true,
    limit,
    remaining: limit - record.count,
    reset: Math.ceil(record.resetAt / 1000),
  };
}

/**
 * Resetea el almacenamiento de rate limiting (útil para pruebas unitarias).
 */
export function resetRateLimits(): void {
  store.clear();
}

