import type { Metadata } from "next";

import { getPathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

import { siteConfig } from "./site";

type Href = Parameters<typeof getPathname>[0]["href"];

/** URL absoluta de una ruta en un idioma: "https://…/casas" o "https://…/en/homes". */
export function absoluteUrl(href: Href, locale: AppLocale): string {
  return new URL(getPathname({ href, locale }), siteConfig.url).toString();
}

/**
 * Metadatos de una página: título, descripción, URL canónica, versiones en cada idioma
 * (hreflang) y Open Graph. Las URLs salen de NEXT_PUBLIC_SITE_URL, nunca de la petición.
 */
export function pageMetadata({
  locale,
  href,
  title,
  description,
}: {
  locale: AppLocale;
  href: Href;
  title: string;
  description: string;
}): Metadata {
  const languages = Object.fromEntries(routing.locales.map((l) => [l, absoluteUrl(href, l)]));
  return {
    title,
    description,
    alternates: {
      canonical: absoluteUrl(href, locale),
      languages: { ...languages, "x-default": absoluteUrl(href, routing.defaultLocale) },
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(href, locale),
      siteName: siteConfig.name,
      locale: locale === "es" ? "es_HN" : "en_US",
      type: "website",
    },
  };
}
