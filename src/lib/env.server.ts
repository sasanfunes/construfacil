import "server-only";

import { z } from "./zod";

import { isProductionDeploy, isSupabaseConfigured } from "./env";

/**
 * Variables secretas. `server-only` hace fallar el build si algo de esto se importa
 * desde un componente de cliente. Se validan la primera vez que se usan.
 *
 * En desarrollo casi todas son opcionales (el sitio funciona con datos de ejemplo y los
 * correos se escriben en la consola). En producción todas son obligatorias.
 */

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optional = <T extends z.ZodType>(schema: T) => z.preprocess(emptyToUndefined, schema.optional());

const serverSchema = z.object({
  /** Llave con acceso total a la base. Nunca sale del servidor. */
  SUPABASE_SERVICE_ROLE_KEY: optional(z.string().min(20)),
  /** Sal para anonimizar IPs y correos en el rate limiting. Mínimo 32 caracteres aleatorios. */
  RATE_LIMIT_SALT: optional(z.string().min(32)),
  RESEND_API_KEY: optional(z.string().min(10)),
  /** Remitente de los correos, p. ej. "ConstruFácil <hola@dominio.com>". El dominio debe estar verificado en Resend. */
  EMAIL_FROM: optional(z.string().min(3).max(200)),
  /** Buzón del equipo de ventas que recibe cada lead. */
  LEADS_NOTIFICATION_EMAIL: optional(z.email()),
  // Fase 3
  STRIPE_SECRET_KEY: optional(z.string().min(10)),
  STRIPE_WEBHOOK_SECRET: optional(z.string().min(10)),
});

const REQUIRED_IN_PRODUCTION = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "RATE_LIMIT_SALT",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "LEADS_NOTIFICATION_EMAIL",
] as const;

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    // Solo se listan los nombres de las variables, nunca sus valores.
    throw new Error(`Variables de entorno del servidor inválidas:\n${z.prettifyError(parsed.error)}`);
  }
  if (isProductionDeploy()) {
    const missing = REQUIRED_IN_PRODUCTION.filter((name) => !parsed.data[name]);
    if (missing.length > 0)
      throw new Error(`Faltan variables obligatorias en producción: ${missing.join(", ")}`);
  }
  cached = parsed.data;
  return cached;
}

/** Sal del rate limiting. Fuera de producción hay una fija para que el sitio arranque sin configurar nada. */
export function getRateLimitSalt(): string {
  return getServerEnv().RATE_LIMIT_SALT ?? "solo-desarrollo-no-usar-en-produccion-0000";
}

/** ¿Se puede escribir en Supabase? Hace falta la URL pública y la llave de servicio. */
export function canWriteToSupabase(): boolean {
  return isSupabaseConfigured() && Boolean(getServerEnv().SUPABASE_SERVICE_ROLE_KEY);
}
