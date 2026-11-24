import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getSupabasePublicConfig } from "@/lib/env";

import type { Database } from "./database.types";

/**
 * Cliente con la sesión de quien está navegando. Respeta RLS: solo ve lo que esa
 * persona puede ver. Es el cliente por defecto para todo lo que hace un usuario o
 * un miembro del equipo (así `auth.uid()` queda en la bitácora de auditoría).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabasePublicConfig();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Desde un Server Component no se pueden escribir cookies. La sesión se
          // refresca en proxy.ts (Fase 2), así que aquí es seguro ignorarlo.
        }
      },
    },
  });
}

/**
 * Cliente sin sesión, como visitante. Para leer datos públicos (catálogo, geografía)
 * en páginas que se prerenderizan o se cachean: no toca cookies.
 */
export function createSupabaseAnonClient() {
  const { url, anonKey } = getSupabasePublicConfig();
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
