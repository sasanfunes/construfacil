import type { MetadataRoute } from "next";

import { activeModels, listedHomes, listedLots } from "@/features/catalog/catalog";
import { getCatalog } from "@/features/catalog/data/load";
import type { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { absoluteUrl } from "@/lib/seo";

type Href = Parameters<typeof getPathname>[0]["href"];

const STATIC_PAGES: ReadonlyArray<{ href: Href; priority: number }> = [
  { href: "/", priority: 1 },
  { href: "/build/quote", priority: 0.9 },
  { href: "/homes", priority: 0.9 },
  { href: "/land", priority: 0.9 },
  { href: "/build", priority: 0.8 },
  { href: "/calculator", priority: 0.8 },
  { href: "/how-it-works", priority: 0.7 },
  { href: "/why-trust-us", priority: 0.7 },
  { href: "/faq", priority: 0.6 },
  { href: "/contact", priority: 0.6 },
  { href: "/schedule", priority: 0.6 },
  { href: "/materials", priority: 0.4 },
  { href: "/legal/terms", priority: 0.2 },
  { href: "/legal/privacy", priority: 0.2 },
  { href: "/legal/refunds", priority: 0.2 },
  { href: "/legal/payments", priority: 0.2 },
];

/** Una entrada por página en español, con su versión en inglés como alternativa (hreflang). */
function entry(href: Href, priority: number): MetadataRoute.Sitemap[number] {
  return {
    url: absoluteUrl(href, routing.defaultLocale),
    priority,
    alternates: {
      languages: Object.fromEntries(routing.locales.map((locale) => [locale, absoluteUrl(href, locale)])),
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await getCatalog();
  return [
    ...STATIC_PAGES.map(({ href, priority }) => entry(href, priority)),
    ...listedHomes(catalog).map((home) =>
      entry({ pathname: "/homes/[slug]", params: { slug: home.slug } }, 0.7),
    ),
    ...listedLots(catalog).map((lot) => entry({ pathname: "/land/[slug]", params: { slug: lot.slug } }, 0.7)),
    ...activeModels(catalog).map((model) =>
      entry({ pathname: "/build/models/[slug]", params: { slug: model.slug } }, 0.6),
    ),
  ];
}
