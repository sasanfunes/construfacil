import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { buildCsp, generateNonce } from "@/lib/security/csp";
import { isHttpsSite } from "@/lib/security/headers";
import { isPrivatePath } from "@/lib/security/private-paths";

const handleI18n = createMiddleware(routing);

/**
 * Corre antes de cada página (en Next 16 reemplaza a `middleware.ts`).
 * 1. Resuelve el idioma y la ruta traducida.
 * 2. En rutas privadas genera un nonce y aplica la CSP estricta.
 * La sesión de Supabase se refrescará aquí a partir de la Fase 2.
 */
export function proxy(request: NextRequest) {
  if (!isPrivatePath(request.nextUrl.pathname, routing.locales)) {
    return handleI18n(request);
  }

  const nonce = generateNonce();
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    upgradeInsecureRequests: isHttpsSite(process.env.NEXT_PUBLIC_SITE_URL),
  });

  // Next.js lee el nonce de la CSP que llega en la petición y lo pone en sus scripts.
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);

  const response = handleI18n(request);
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  // Todo menos API, archivos internos de Next y archivos con extensión.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
