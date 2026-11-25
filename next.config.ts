import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { staticSecurityHeaders } from "./src/lib/security/headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  /**
   * Terrenos y Materiales dejaron de ser secciones: comprar un terreno es un paso de
   * "Construir" y los materiales se eligen dentro del proyecto. Las direcciones viejas
   * (y las del cotizador anterior) llevan a Construir. Temporales: el sitio aún no se indexa.
   */
  async redirects() {
    return [
      { source: "/terrenos", destination: "/construir/nuevo", permanent: false },
      { source: "/terrenos/:slug", destination: "/construir/nuevo?lot=:slug", permanent: false },
      { source: "/en/land", destination: "/en/build/new", permanent: false },
      { source: "/en/land/:slug", destination: "/en/build/new?lot=:slug", permanent: false },
      { source: "/materiales", destination: "/construir", permanent: false },
      { source: "/en/materials", destination: "/en/build", permanent: false },
      { source: "/construir/cotizador", destination: "/construir/nuevo", permanent: false },
      { source: "/en/build/quote", destination: "/en/build/new", permanent: false },
      // Los enlaces privados de las cotizaciones de antes: el token no se reenvía a ningún lado.
      { source: "/cotizacion/:token", destination: "/construir", permanent: false },
      { source: "/en/quote/:token", destination: "/en/build", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: staticSecurityHeaders({
          isDev: process.env.NODE_ENV === "development",
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        }),
      },
    ];
  },
};

export default withNextIntl(nextConfig);
