import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";

import type { Database } from "./database.types";

/**
 * Cliente con la llave service role: SE SALTA EL RLS.
 *
 * Solo para operaciones del sistema que no hace una persona con sesión:
 * guardar un lead del formulario público, el webhook de Stripe, el rate limiting
 * y la bitácora de auditoría. Antes de usarlo, el código que lo llama ya validó
 * la entrada con Zod y comprobó permisos. Nunca se importa desde el cliente:
 * `server-only` hace fallar el build si ocurre.
 */
export function createSupabaseAdminClient() {
  const { url } = getSupabasePublicConfig();
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");

  return createClient<Database>(url, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
