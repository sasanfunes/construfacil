import "server-only";

import { z } from "zod";

/**
 * Variables secretas. `server-only` hace fallar el build si algo de esto se importa
 * desde un componente de cliente. Se validan la primera vez que se usan.
 */

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optional = <T extends z.ZodType>(schema: T) => z.preprocess(emptyToUndefined, schema.optional());

const serverSchema = z.object({
  /** Llave con acceso total a la base. Nunca sale del servidor. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  /** Sal para anonimizar IPs en el rate limiting. Mínimo 32 caracteres aleatorios. */
  RATE_LIMIT_SALT: z.string().min(32),
  // Fase 1
  RESEND_API_KEY: optional(z.string().min(10)),
  LEADS_NOTIFICATION_EMAIL: optional(z.email()),
  // Fase 3
  STRIPE_SECRET_KEY: optional(z.string().min(10)),
  STRIPE_WEBHOOK_SECRET: optional(z.string().min(10)),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    // Solo se listan los nombres de las variables, nunca sus valores.
    throw new Error(`Variables de entorno del servidor inválidas:\n${z.prettifyError(parsed.error)}`);
  }
  cached = parsed.data;
  return cached;
}
