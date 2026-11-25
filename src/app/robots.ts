import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

/**
 * Mientras el sitio muestre datos de ejemplo (NEXT_PUBLIC_ALLOW_INDEXING=false), nadie lo
 * indexa. Las rutas privadas nunca se indexan.
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
        disallow: ["/portal", "/en/portal", "/admin", "/en/admin", "/cotizacion/", "/en/quote/", "/api/"],
      },
    ],
    sitemap: new URL("/sitemap.xml", siteConfig.url).toString(),
  };
}
