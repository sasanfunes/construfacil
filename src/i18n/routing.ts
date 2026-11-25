import { defineRouting } from "next-intl/routing";

/**
 * Español es el idioma por defecto y va sin prefijo (`/casas`).
 * Inglés va bajo `/en` con la ruta traducida (`/en/homes`).
 *
 * Las llaves de `pathnames` son los nombres internos (carpetas en `src/app/[locale]`).
 * Cada ruta nueva se agrega aquí con su traducción.
 */
export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  localePrefix: "as-needed",
  // El idioma lo elige la persona con el selector. No redirigimos según el idioma del
  // navegador: muchos celulares en EE. UU. están en inglés aunque su dueño prefiera español.
  localeDetection: false,
  // next-intl armaría las cabeceras hreflang con el Host de la petición, que un atacante
  // puede falsificar frente a un CDN. Los hreflang salen de los metadatos de cada página.
  alternateLinks: false,
  pathnames: {
    "/": "/",
    "/homes": { es: "/casas", en: "/homes" },
    "/homes/[slug]": { es: "/casas/[slug]", en: "/homes/[slug]" },
    "/land": { es: "/terrenos", en: "/land" },
    "/land/[slug]": { es: "/terrenos/[slug]", en: "/land/[slug]" },
    "/build": { es: "/construir", en: "/build" },
    "/build/models/[slug]": { es: "/construir/modelos/[slug]", en: "/build/models/[slug]" },
    "/build/quote": { es: "/construir/cotizador", en: "/build/quote" },
    "/calculator": { es: "/calculadora", en: "/calculator" },
    "/materials": { es: "/materiales", en: "/materials" },
    "/how-it-works": { es: "/como-funciona", en: "/how-it-works" },
    "/why-trust-us": { es: "/por-que-confiar", en: "/why-trust-us" },
    "/faq": { es: "/preguntas-frecuentes", en: "/faq" },
    "/contact": { es: "/contacto", en: "/contact" },
    "/schedule": { es: "/agendar", en: "/schedule" },
    "/legal/terms": { es: "/legal/terminos", en: "/legal/terms" },
    "/legal/privacy": { es: "/legal/privacidad", en: "/legal/privacy" },
    "/legal/refunds": { es: "/legal/reembolsos", en: "/legal/refunds" },
    "/legal/payments": { es: "/legal/pagos", en: "/legal/payments" },
    // Privadas
    "/quote/[token]": { es: "/cotizacion/[token]", en: "/quote/[token]" },
    "/portal": "/portal",
  },
});

export type AppLocale = (typeof routing.locales)[number];
export type AppPathname = keyof typeof routing.pathnames;
