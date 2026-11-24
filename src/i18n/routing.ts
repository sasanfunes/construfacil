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
  pathnames: {
    "/": "/",
    "/portal": "/portal",
  },
});

export type AppLocale = (typeof routing.locales)[number];
export type AppPathname = keyof typeof routing.pathnames;
