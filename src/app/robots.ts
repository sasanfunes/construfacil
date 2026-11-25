import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

/**
 * Mientras el sitio muestre datos de ejemplo (NEXT_PUBLIC_ALLOW_INDEXING=false), nadie lo
 * indexa.
 *
 * Las rutas privadas (portal, cotizaciones) NO se bloquean aquí a propósito: un buscador que
 * no puede leer la página tampoco ve su `noindex` (meta y cabecera X-Robots-Tag) y podría
 * listar la URL desnuda si alguien la publica, con el token de la cotización incluido.
 */
export default function robots(): MetadataRoute.Robots {
  if (!siteConfig.allowIndexing) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: new URL("/sitemap.xml", siteConfig.url).toString(),
  };
}
