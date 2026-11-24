import "server-only";

import { getServerEnv } from "@/lib/env.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import {
  buildBucket,
  getClientIp,
  RATE_LIMITS,
  type RateLimitAction,
  type RateLimitResult,
  type RateLimitRule,
  type RateLimitStore,
} from "./rate-limit-core";

/** Contador compartido en Postgres (función `check_rate_limit`). Funciona entre instancias de Vercel. */
class PostgresRateLimitStore implements RateLimitStore {
  async hit(bucket: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_bucket: bucket,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });
    const row = data?.[0];
    if (error || !row) {
      // Si no podemos contar, no dejamos pasar: es más seguro rechazar que quedar sin límite.
      console.error("rate-limit: no se pudo consultar el contador", error?.code ?? "sin datos");
      return denied(rule);
    }
    return { allowed: row.allowed, remaining: row.remaining, resetAt: new Date(row.reset_at) };
  }
}

function denied(rule: RateLimitRule): RateLimitResult {
  return { allowed: false, remaining: 0, resetAt: new Date(Date.now() + rule.windowSeconds * 1000) };
}

const store: RateLimitStore = new PostgresRateLimitStore();

/**
 * Identificador de quien hace la petición, a partir de sus cabeceras.
 * En producción, sin una IP válida devuelve `null` y la petición se rechaza: es un error de
 * despliegue, y meter a todos los visitantes en un mismo contador dejaría que cinco
 * peticiones bloquearan a todo el mundo.
 */
export function getRequestIdentifier(headers: Headers): string | null {
  return getClientIp(headers) ?? (process.env.NODE_ENV === "production" ? null : "local-dev");
}

/**
 * Cuenta un intento de `action` para `identifier` (IP, correo, o ambos por separado).
 * Se llama al inicio de cada Server Action pública, antes de tocar la base.
 *
 *   const limit = await enforceRateLimit("contactForm", getRequestIdentifier(await headers()));
 *   if (!limit.allowed) return { error: "rateLimited", retryAt: limit.resetAt };
 */
export async function enforceRateLimit(
  action: RateLimitAction,
  identifier: string | null,
): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[action];
  if (!identifier) {
    console.error(`rate-limit: petición sin identificador en "${action}"; se rechaza`);
    return denied(rule);
  }
  const bucket = buildBucket(action, identifier, getServerEnv().RATE_LIMIT_SALT);
  return store.hit(bucket, rule);
}

export { RATE_LIMITS, type RateLimitAction, type RateLimitResult } from "./rate-limit-core";
