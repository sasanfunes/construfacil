import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { isPublishedSlug, type DetailKind } from "@/features/catalog/data/known-slugs";
import { routing } from "@/i18n/routing";
import { buildCsp, generateNonce } from "@/lib/security/csp";
import { isHttpsSite } from "@/lib/security/headers";
import { isPrivatePath, isSuspiciousPath } from "@/lib/security/private-paths";

const handleI18n = createMiddleware(routing);

/**
 * Archivos de metadatos que Next sirve en la raíz. Lista exacta a propósito: cualquier
 * otra ruta pasa por el enrutador de idiomas. Las imágenes del sitio se importan desde el
 * código (salen bajo `/_next/static`) o vienen de Supabase Storage; no se usa `/public`.
 */
const PASSTHROUGH_FILES: ReadonlySet<string> = new Set([
  "/icon.svg",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
]);

/** Rutas de API que existen. Cualquier otra `/api/*` responde 404 sin llegar a la app. */
const API_ROUTES: ReadonlySet<string> = new Set<string>([
  // Fase 3: "/api/webhooks/stripe"
]);

/** Cabeceras que solo puede poner este proxy. Si vienen del navegador, se descartan. */
const PROXY_OWNED_HEADERS = ["content-security-policy", "content-security-policy-report-only", "x-nonce"];

/** Fichas del catálogo (ruta interna, después de traducir): `/es/homes/<slug>`, etc. */
const DETAIL_ROUTE = /^\/([a-z]{2})\/(homes|build\/models)\/([^/]+)\/?$/;
const DETAIL_KIND: Record<string, DetailKind> = { homes: "home", "build/models": "model" };

/**
 * Las fichas usan ISR: Next genera y guarda una página por cada slug que alguien visita, exista
 * o no. Un slug que no está publicado se manda a una ruta inexistente fija, que responde 404
 * sin crear entradas nuevas en la caché.
 */
async function unknownDetailRewrite(request: NextRequest, response: NextResponse) {
  const target = response.headers.get("x-middleware-rewrite");
  const internalPath = target ? new URL(target, request.url).pathname : request.nextUrl.pathname;
  const match = DETAIL_ROUTE.exec(internalPath);
  if (!match) return null;
  const [, locale, section, rawSlug] = match;
  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug!);
  } catch {
    return null;
  }
  if (await isPublishedSlug(DETAIL_KIND[section!]!, slug)) return null;
  return NextResponse.rewrite(new URL(`/${locale}/ficha-no-encontrada`, request.url));
}

function bare(status: 400 | 404) {
  return new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Corre antes de cada petición (en Next 16 reemplaza a `middleware.ts`).
 * 1. Rechaza rutas malformadas.
 * 2. Resuelve el idioma y la ruta traducida.
 * 3. Manda las fichas del catálogo que no existen a un 404 fijo (ver `unknownDetailRewrite`).
 * 4. En rutas privadas genera un nonce y aplica la CSP estricta, sin caché y sin indexar.
 *
 * No es la barrera de acceso: cada página y cada acción privada comprueba la sesión por
 * su cuenta. La sesión de Supabase se refrescará aquí a partir de la Fase 2.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isSuspiciousPath(pathname)) return bare(400);
  if (PASSTHROUGH_FILES.has(pathname)) return NextResponse.next();
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return API_ROUTES.has(pathname) ? NextResponse.next() : bare(404);
  }
  // En Vercel estas rutas las atiende la plataforma (analítica). Fuera de Vercel no existen.
  if (pathname.startsWith("/_vercel/")) return process.env.VERCEL ? NextResponse.next() : bare(404);

  // Next toma el nonce de la CSP que llega en la petición: nunca se acepta la del navegador.
  for (const header of PROXY_OWNED_HEADERS) request.headers.delete(header);

  if (!isPrivatePath(pathname, routing.locales)) {
    const response = handleI18n(request);
    // Segunda comprobación sobre lo que de verdad se va a servir, por si el enrutador de
    // idiomas reescribe la petición hacia una ruta privada.
    const rewrite = response.headers.get("x-middleware-rewrite");
    if (!rewrite || !isPrivatePath(new URL(rewrite, request.url).pathname, routing.locales)) {
      return (await unknownDetailRewrite(request, response)) ?? response;
    }
  }

  const nonce = generateNonce();
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    upgradeInsecureRequests: isHttpsSite(process.env.NEXT_PUBLIC_SITE_URL),
  });

  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);

  const response = handleI18n(request);
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store");
  // Los buscadores deben poder leer esta cabecera: por eso robots.txt no bloquea estas rutas.
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  // Todo pasa por aquí salvo los archivos internos de Next. No se excluyen las rutas con
  // punto: una ruta privada como `/portal/contrato.pdf` también debe recibir la CSP estricta.
  matcher: ["/((?!_next/|__nextjs).*)"],
};
