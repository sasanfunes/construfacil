/**
 * Content Security Policy.
 *
 * Hay dos variantes, porque un nonce obliga a generar la página en cada visita:
 * - Con nonce (portal, admin, cuenta): solo corre JavaScript que el servidor firmó.
 * - Sin nonce (páginas públicas, que se sirven prerenderizadas): Next.js necesita
 *   scripts en línea para hidratar, así que se permite 'unsafe-inline' en script-src.
 *   El resto de la política sigue cerrado: nada de scripts de otros dominios.
 *
 * Este archivo no importa nada del proyecto: lo usa `next.config.ts`.
 */

export type CspOptions = {
  /** Si se pasa, la política es estricta (nonce + strict-dynamic). */
  nonce?: string;
  isDev: boolean;
  /** URL del proyecto de Supabase, para permitir sus imágenes y su API. */
  supabaseUrl?: string;
  /** Solo en despliegues con HTTPS. En http://localhost rompe las peticiones. */
  upgradeInsecureRequests: boolean;
};

const OSM_TILES = "https://*.tile.openstreetmap.org";

function supabaseSources(supabaseUrl?: string): { http: string[]; ws: string[] } {
  if (!supabaseUrl) return { http: [], ws: [] };
  try {
    const { origin, host, protocol } = new URL(supabaseUrl);
    return { http: [origin], ws: [`${protocol === "https:" ? "wss" : "ws"}://${host}`] };
  } catch {
    return { http: [], ws: [] };
  }
}

export function buildCsp({ nonce, isDev, supabaseUrl, upgradeInsecureRequests }: CspOptions): string {
  const supabase = supabaseSources(supabaseUrl);

  const scriptSrc = nonce
    ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"]
    : ["'self'", "'unsafe-inline'"];
  // React usa eval en desarrollo para reconstruir errores del servidor. En producción no.
  if (isDev) scriptSrc.push("'unsafe-eval'");

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    // Los componentes de interfaz y el mapa posicionan con estilos en línea.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...supabase.http, OSM_TILES],
    "font-src": ["'self'"],
    "connect-src": [
      "'self'",
      ...supabase.http,
      ...supabase.ws,
      ...(isDev ? ["ws://localhost:*", "ws://127.0.0.1:*"] : []),
    ],
    "media-src": ["'self'", "blob:", ...supabase.http],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const parts = Object.entries(directives).map(([name, sources]) => `${name} ${sources.join(" ")}`);
  if (upgradeInsecureRequests) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

export function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}
