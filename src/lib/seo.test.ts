import { describe, expect, it } from "vitest";

import { absoluteUrl, ogImage, pageMetadata } from "./seo";
import { siteConfig } from "./site";

describe("absoluteUrl", () => {
  it("traduce la ruta y solo agrega el prefijo en inglés", () => {
    expect(absoluteUrl("/homes", "es")).toBe(new URL("/casas", siteConfig.url).toString());
    expect(absoluteUrl("/homes", "en")).toBe(new URL("/en/homes", siteConfig.url).toString());
  });

  it("resuelve rutas con parámetros", () => {
    const href = { pathname: "/homes/[slug]", params: { slug: "casa-ejemplo" } } as const;
    expect(absoluteUrl(href, "es")).toBe(new URL("/casas/casa-ejemplo", siteConfig.url).toString());
  });
});

describe("pageMetadata", () => {
  const meta = pageMetadata({ locale: "en", href: "/faq", title: "FAQ", description: "Answers" });

  it("declara la URL canónica y las versiones en cada idioma", () => {
    expect(meta.alternates?.canonical).toBe(new URL("/en/faq", siteConfig.url).toString());
    expect(meta.alternates?.languages).toEqual({
      es: new URL("/preguntas-frecuentes", siteConfig.url).toString(),
      en: new URL("/en/faq", siteConfig.url).toString(),
      "x-default": new URL("/preguntas-frecuentes", siteConfig.url).toString(),
    });
  });

  it("incluye la imagen para compartir del idioma, sin redirecciones", () => {
    expect(meta.openGraph?.images).toEqual([ogImage("en", siteConfig.name)]);
    expect(ogImage("en", "x").url).toBe(new URL("/en/opengraph-image", siteConfig.url).toString());
    expect(ogImage("es", "x").url).toBe(new URL("/opengraph-image", siteConfig.url).toString());
  });
});
