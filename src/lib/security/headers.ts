import { buildCsp } from "./csp";

export type SecurityHeaderOptions = {
  isDev: boolean;
  supabaseUrl?: string;
  siteUrl?: string;
};

export function isHttpsSite(siteUrl?: string): boolean {
  return typeof siteUrl === "string" && siteUrl.startsWith("https://");
}

/**
 * Cabeceras que van en todas las respuestas. La CSP de aquí es la variante sin nonce;
 * `proxy.ts` la reemplaza por la estricta en las rutas privadas.
 */
export function staticSecurityHeaders({ isDev, supabaseUrl, siteUrl }: SecurityHeaderOptions) {
  return [
    {
      key: "Content-Security-Policy",
      value: buildCsp({ isDev, supabaseUrl, upgradeInsecureRequests: isHttpsSite(siteUrl) }),
    },
    // Dos años, con subdominios. Los navegadores lo ignoran en http://localhost.
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()",
    },
  ];
}
