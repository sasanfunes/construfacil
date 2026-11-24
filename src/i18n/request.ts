import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";

import { routing, type AppLocale } from "./routing";

const loaders = {
  es: () => import("../../messages/es"),
  en: () => import("../../messages/en"),
} satisfies Record<AppLocale, () => Promise<{ default: unknown }>>;

/**
 * El idioma sale del segmento `[locale]` (root param), así las páginas públicas se pueden
 * prerenderizar. En Server Actions y Route Handlers no hay root params: ahí se pasa el
 * idioma explícito, p. ej. `getTranslations({ locale })`.
 */
export default getRequestConfig(async ({ locale: explicitLocale }) => {
  const candidate = explicitLocale ?? (await rootLocale());
  const locale = hasLocale(routing.locales, candidate) ? candidate : routing.defaultLocale;

  return {
    locale,
    messages: (await loaders[locale]()).default,
    timeZone: "America/Tegucigalpa",
  };
});
