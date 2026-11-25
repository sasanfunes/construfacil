import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PageIntro } from "@/components/shared/page-intro";
import { whatsappHref } from "@/components/shared/whatsapp";
import { activeDepartments, listedHomes } from "@/features/catalog/catalog";
import { HomeCard } from "@/features/catalog/components/cards";
import { HomeFiltersForm } from "@/features/catalog/components/filters";
import { LazyMap } from "@/features/catalog/components/lazy-map";
import { EmptyResults, ResultsSkeleton, ViewToggle } from "@/features/catalog/components/results";
import { getCatalog } from "@/features/catalog/data/load";
import { filterHomes, parseHomeFilters, toSearchParams } from "@/features/catalog/filters";
import { placeOf } from "@/features/catalog/place";
import { getPathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { formatUsd } from "@/lib/money";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("catalog.homes");
  return pageMetadata({ locale, href: "/homes", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function HomesPage({ searchParams }: PageProps<"/[locale]/homes">) {
  const t = await getTranslations("catalog.homes");
  return (
    <>
      <PageIntro title={t("title")} intro={t("intro")} />
      <div className="container-page flex flex-col gap-6 pb-16">
        <Suspense fallback={<ResultsSkeleton label={t("title")} />}>
          <HomesResults searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function HomesResults({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/homes">["searchParams"];
}) {
  const [catalog, t, locale, params] = await Promise.all([
    getCatalog(),
    getTranslations("catalog"),
    getLocale() as Promise<AppLocale>,
    searchParams,
  ]);
  const filters = parseHomeFilters(params);
  const homes = filterHomes(listedHomes(catalog), filters);
  const base = getPathname({ href: "/homes", locale });
  const withParams = (overrides: Record<string, string>) => {
    const query = toSearchParams(filters, overrides).toString();
    return query ? `${base}?${query}` : base;
  };
  const geo = { departments: activeDepartments(catalog), municipalities: catalog.municipalities };
  const usdToHnl = catalog.exchangeRate.usdToHnl;

  return (
    <>
      <HomeFiltersForm action={base} filters={filters} geo={geo} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-lg font-bold" aria-live="polite">
          {t("homes.count", { count: homes.length })}
        </p>
        <ViewToggle
          listHref={withParams({ view: "list" })}
          mapHref={withParams({ view: "map" })}
          current={filters.view}
        />
      </div>

      {homes.length === 0 ? (
        <EmptyResults
          title={t("homes.empty.title")}
          body={t("homes.empty.body")}
          clearHref={base}
          clearLabel={t("filters.clear")}
          whatsappHref={whatsappHref(t("homes.empty.whatsappMessage"))}
          whatsappLabel={t("homes.empty.whatsappCta")}
        />
      ) : filters.view === "map" ? (
        <div className="flex flex-col gap-2">
          <LazyMap
            className="h-[65vh] min-h-80 w-full overflow-hidden rounded-2xl border"
            ariaLabel={t("map.ariaHomes")}
            linkLabel={t("map.link")}
            points={homes
              .filter((h) => h.latitude !== null && h.longitude !== null)
              .map((h) => ({
                id: h.id,
                latitude: h.latitude!,
                longitude: h.longitude!,
                title: h.title[locale],
                subtitle: `${formatUsd(h.priceUsdCents, locale)} · ${t("place", placeOf(catalog, h))}`,
                href: getPathname({ href: { pathname: "/homes/[slug]", params: { slug: h.slug } }, locale }),
              }))}
          />
          <p className="text-sm text-muted-foreground">{t("map.approx")}</p>
        </div>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {homes.map((home) => (
            <li key={home.id} className="flex">
              <HomeCard home={home} place={placeOf(catalog, home)} locale={locale} usdToHnl={usdToHnl} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
