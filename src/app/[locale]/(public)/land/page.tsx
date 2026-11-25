import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PageIntro } from "@/components/shared/page-intro";
import { whatsappHref } from "@/components/shared/whatsapp";
import { activeDepartments, listedLots } from "@/features/catalog/catalog";
import { LotCard } from "@/features/catalog/components/cards";
import { LotFiltersForm } from "@/features/catalog/components/filters";
import { LazyMap } from "@/features/catalog/components/lazy-map";
import { EmptyResults, ResultsSkeleton, ViewToggle } from "@/features/catalog/components/results";
import { getCatalog } from "@/features/catalog/data/load";
import { filterLots, parseLotFilters, toSearchParams } from "@/features/catalog/filters";
import { placeOf } from "@/features/catalog/place";
import { getPathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { formatUsd } from "@/lib/money";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("catalog.lots");
  return pageMetadata({ locale, href: "/land", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function LandPage({ searchParams }: PageProps<"/[locale]/land">) {
  const t = await getTranslations("catalog.lots");
  return (
    <>
      <PageIntro title={t("title")} intro={t("intro")} />
      <div className="container-page flex flex-col gap-6 pb-16">
        <Suspense fallback={<ResultsSkeleton label={t("title")} />}>
          <LotsResults searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function LotsResults({ searchParams }: { searchParams: PageProps<"/[locale]/land">["searchParams"] }) {
  const [catalog, t, locale, params] = await Promise.all([
    getCatalog(),
    getTranslations("catalog"),
    getLocale() as Promise<AppLocale>,
    searchParams,
  ]);
  const filters = parseLotFilters(params);
  const lots = filterLots(listedLots(catalog), filters);
  const base = getPathname({ href: "/land", locale });
  const withParams = (overrides: Record<string, string>) => {
    const query = toSearchParams(filters, overrides).toString();
    return query ? `${base}?${query}` : base;
  };
  const geo = { departments: activeDepartments(catalog), municipalities: catalog.municipalities };
  const usdToHnl = catalog.exchangeRate.usdToHnl;

  return (
    <>
      <LotFiltersForm action={base} filters={filters} geo={geo} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Es el título de la lista: las tarjetas usan h3 y deben ir debajo de un h2. */}
        <h2 className="font-sans text-lg leading-normal font-bold tracking-normal" aria-live="polite">
          {t("lots.count", { count: lots.length })}
        </h2>
        <ViewToggle
          listHref={withParams({ view: "list" })}
          mapHref={withParams({ view: "map" })}
          current={filters.view}
        />
      </div>

      {lots.length === 0 ? (
        <EmptyResults
          title={t("lots.empty.title")}
          body={t("lots.empty.body")}
          clearHref={base}
          clearLabel={t("filters.clear")}
          whatsappHref={whatsappHref(t("lots.empty.whatsappMessage"))}
          whatsappLabel={t("lots.empty.whatsappCta")}
        />
      ) : filters.view === "map" ? (
        <div className="flex flex-col gap-2">
          <LazyMap
            className="h-[65vh] min-h-80 w-full overflow-hidden rounded-2xl border"
            ariaLabel={t("map.ariaLots")}
            linkLabel={t("map.link")}
            points={lots
              .filter((h) => h.latitude !== null && h.longitude !== null)
              .map((h) => ({
                id: h.id,
                latitude: h.latitude!,
                longitude: h.longitude!,
                title: h.title[locale],
                subtitle: `${formatUsd(h.priceUsdCents, locale)} · ${t("place", placeOf(catalog, h))}`,
                href: getPathname({ href: { pathname: "/land/[slug]", params: { slug: h.slug } }, locale }),
              }))}
          />
          <p className="text-sm text-muted-foreground">{t("map.approx")}</p>
        </div>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {lots.map((lot) => (
            <li key={lot.id} className="flex">
              <LotCard lot={lot} place={placeOf(catalog, lot)} locale={locale} usdToHnl={usdToHnl} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
