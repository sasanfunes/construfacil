import { createHash } from "node:crypto";
import { isIP } from "node:net";

/**
 * Parte pura del rate limiting (sin base de datos), para poder probarla.
 * La regla de cada acción vive aquí para que los límites se revisen en un solo lugar.
 *
 * Alcance: esto protege los formularios y acciones de NUESTRO servidor. Los endpoints de
 * Supabase Auth son públicos y se protegen aparte, con sus propios límites y CAPTCHA
 * (ver docs/seguridad.md).
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

/**
 * Deja la IP lista para contar. Una conexión IPv6 dispone de un bloque /64 entero
 * (millones de direcciones), así que se cuenta por bloque y no por dirección.
 * Devuelve `null` si el texto no es una IP.
 */
export function normalizeIp(raw: string): string | null {
  let ip = raw.trim().toLowerCase();
  if (ip.startsWith("[")) ip = ip.slice(1, ip.indexOf("]") === -1 ? undefined : ip.indexOf("]"));
  const zone = ip.indexOf("%");
  if (zone !== -1) ip = ip.slice(0, zone);

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (mapped?.[1]) ip = mapped[1];

  const version = isIP(ip);
  if (version === 4) return ip;
  if (version !== 6) return null;

  const [head = "", tail] = ip.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const groups =
    tail === undefined
      ? headParts
      : [
          ...headParts,
          ...Array<string>(Math.max(8 - headParts.length - tailParts.length, 0)).fill("0"),
          ...tailParts,
        ];
  const prefix = groups.slice(0, 4).map((group) => group.replace(/^0+(?=.)/, ""));
  return `${prefix.join(":")}::/64`;
}

/**
 * IP del cliente según las cabeceras que pone Vercel (que las sobrescribe: el navegador
 * no puede falsificarlas). Fuera de Vercel hay que revisar esta lista.
 * Devuelve `null` si no hay una IP válida; quien llama decide qué hacer.
 */
export function getClientIp(headers: Headers): string | null {
  const candidates = [
    headers.get("x-vercel-forwarded-for"),
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const candidate of candidates) {
    const ip = candidate ? normalizeIp(candidate) : null;
    if (ip) return ip;
  }
  return null;
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
