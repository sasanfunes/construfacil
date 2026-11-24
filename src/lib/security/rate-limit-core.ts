import { createHash } from "node:crypto";

/**
 * Parte pura del rate limiting (sin base de datos), para poder probarla.
 * La regla de cada acción vive aquí para que los límites se revisen en un solo lugar.
 */

export type RateLimitRule = { limit: number; windowSeconds: number };

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: Date };

export const RATE_LIMITS = {
  /** Pedir enlace de acceso: por correo y por IP. */
  login: { limit: 5, windowSeconds: 15 * 60 },
  signup: { limit: 5, windowSeconds: 60 * 60 },
  contactForm: { limit: 5, windowSeconds: 60 * 60 },
  videoCallRequest: { limit: 5, windowSeconds: 60 * 60 },
  /** Cotizaciones guardadas. El cálculo en pantalla no gasta intentos. */
  quote: { limit: 10, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitAction = keyof typeof RATE_LIMITS;

export interface RateLimitStore {
  hit(bucket: string, rule: RateLimitRule): Promise<RateLimitResult>;
}

/**
 * Nombre del contador: acción + huella anonimizada de quien hace la petición.
 * La IP o el correo nunca se guardan en claro: se pasan por SHA-256 con una sal secreta.
 */
export function buildBucket(action: string, identifier: string, salt: string): string {
  const fingerprint = createHash("sha256")
    .update(`${salt}:${action}:${identifier.trim().toLowerCase()}`)
    .digest("hex");
  return `${action}:${fingerprint.slice(0, 40)}`;
}

/** IP del cliente según las cabeceras que pone Vercel. Fuera de Vercel hay que revisar esta lista. */
export function getClientIp(headers: Headers): string {
  const candidates = [
    headers.get("x-vercel-forwarded-for"),
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const candidate of candidates) {
    const ip = candidate?.trim();
    if (ip) return ip;
  }
  return "unknown";
}

/** Contador en memoria. Solo para tests y desarrollo: en Vercel cada instancia tendría el suyo. */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly windows = new Map<string, { hits: number; resetAt: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async hit(bucket: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const windowMs = rule.windowSeconds * 1000;
    const windowStart = Math.floor(this.now() / windowMs) * windowMs;
    const key = `${bucket}:${windowStart}`;
    const entry = this.windows.get(key) ?? { hits: 0, resetAt: windowStart + windowMs };
    entry.hits += 1;
    this.windows.set(key, entry);
    return {
      allowed: entry.hits <= rule.limit,
      remaining: Math.max(rule.limit - entry.hits, 0),
      resetAt: new Date(entry.resetAt),
    };
  }
}
