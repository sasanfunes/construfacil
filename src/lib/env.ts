import { z } from "./zod";

/**
 * Variables públicas (viajan al navegador). Solo aquí se lee `process.env.NEXT_PUBLIC_*`.
 * Las variables secretas viven en `env.server.ts`, que no se puede importar desde el cliente.
 */

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optional = <T extends z.ZodType>(schema: T) => z.preprocess(emptyToUndefined, schema.optional());

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.preprocess(emptyToUndefined, z.url().default("http://localhost:3000")),
  NEXT_PUBLIC_SUPABASE_URL: optional(z.url()),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional(z.string().min(20)),
  /** Solo dígitos, con código de país. Ej.: 50499998888 */
  NEXT_PUBLIC_WHATSAPP_NUMBER: optional(z.string().regex(/^\d{8,15}$/, "Solo dígitos, con código de país")),
  /** El sitio no se indexa en buscadores hasta que esto sea "true". */
  NEXT_PUBLIC_ALLOW_INDEXING: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).default("false")),
});

const parsed = publicSchema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
  NEXT_PUBLIC_ALLOW_INDEXING: process.env.NEXT_PUBLIC_ALLOW_INDEXING,
});

if (!parsed.success) {
  throw new Error(`Variables de entorno públicas inválidas:\n${z.prettifyError(parsed.error)}`);
}

export const publicEnv = parsed.data;

/** Valores de `APP_ENV` que permiten arrancar sin Supabase ni Resend (datos de ejemplo). */
const NON_PRODUCTION_APP_ENVS: ReadonlySet<string> = new Set(["development", "test", "ci", "preview"]);

/**
 * ¿Hay que exigir la configuración completa? Falla cerrado: cualquier build de producción o
 * despliegue en Vercel (vistas previas incluidas) cuenta como producción, salvo que `APP_ENV`
 * diga explícitamente que no lo es. Así un despliegue mal configurado no arranca en modo de
 * ejemplo, perdiendo leads en memoria y con una sal pública en el rate limiting.
 *
 * - `next dev`, Vitest: no es producción (NODE_ENV distinto de "production").
 * - `next build` / `next start` en tu máquina o en CI: define `APP_ENV=development` o `ci`.
 * - Vista previa de Vercel con datos de ejemplo: `APP_ENV=preview`, y con Deployment Protection.
 */
export function isProductionDeploy(): boolean {
  const appEnv = process.env.APP_ENV;
  if (appEnv) return !NON_PRODUCTION_APP_ENVS.has(appEnv);
  if (process.env.VERCEL) return true;
  return process.env.NODE_ENV === "production";
}

/** En producción nada se deja a los valores por defecto. En desarrollo el sitio público arranca sin Supabase. */
if (typeof window === "undefined" && isProductionDeploy()) {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en producción.");
  }
  // Sin esto la CSP no forzaría https y los enlaces canónicos apuntarían a localhost.
  if (!process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://")) {
    throw new Error("NEXT_PUBLIC_SITE_URL debe ser la URL https del sitio en producción.");
  }
}

export function getSupabasePublicConfig() {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase no está configurado. Copia .env.example a .env.local y completa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return { url, anonKey };
}

/**
 * ¿Hay Supabase? Sin él, el sitio usa los datos de EJEMPLO (desarrollo, CI y pruebas).
 * En producción esto siempre es verdadero: arriba se exige.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
