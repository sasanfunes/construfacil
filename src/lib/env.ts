import { z } from "zod";

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

/** En producción nada se deja a los valores por defecto. En desarrollo el sitio público arranca sin Supabase. */
const isProductionDeploy = process.env.VERCEL_ENV === "production";
if (isProductionDeploy) {
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
