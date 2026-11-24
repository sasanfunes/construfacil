import "server-only";

import { getServerEnv } from "@/lib/env.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import {
  buildBucket,
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
      return { allowed: false, remaining: 0, resetAt: new Date(Date.now() + rule.windowSeconds * 1000) };
    }
    return { allowed: row.allowed, remaining: row.remaining, resetAt: new Date(row.reset_at) };
  }
}

const store: RateLimitStore = new PostgresRateLimitStore();

/**
 * Cuenta un intento de `action` para `identifier` (IP, correo, o ambos por separado).
 * Se llama al inicio de cada Server Action pública, antes de tocar la base.
 *
 *   const limit = await enforceRateLimit("contactForm", getClientIp(await headers()));
 *   if (!limit.allowed) return { error: "rateLimited", retryAt: limit.resetAt };
 */
export async function enforceRateLimit(
  action: RateLimitAction,
  identifier: string,
): Promise<RateLimitResult> {
  const bucket = buildBucket(action, identifier, getServerEnv().RATE_LIMIT_SALT);
  return store.hit(bucket, RATE_LIMITS[action]);
}

export { getClientIp, RATE_LIMITS, type RateLimitAction, type RateLimitResult } from "./rate-limit-core";
