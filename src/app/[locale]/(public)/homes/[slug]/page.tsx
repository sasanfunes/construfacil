import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { whatsappHref } from "@/components/shared/whatsapp";
import { listedHomes } from "@/features/catalog/catalog";
import { HomeStatusBadges } from "@/features/catalog/components/cards";
import { FloorPlan } from "@/features/catalog/components/floor-plan";
import { HouseIllustration } from "@/features/catalog/components/illustrations";
import { LazyMap } from "@/features/catalog/components/lazy-map";
import {
  DetailSection,
  DocumentsList,
  FactsList,
  FeatureList,
  ListingActions,
  MediaLinks,
  SuggestedPlan,
} from "@/features/catalog/components/listing-detail";
import { getCatalog } from "@/features/catalog/data/load";
import { suggestedHomePlan } from "@/features/catalog/payment-plan";
import { placeOf } from "@/features/catalog/place";
import { LeadForm } from "@/features/leads/components/lead-form";
import type { AppLocale } from "@/i18n/routing";
import { formatMonthYear, formatNumber } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { squareMetersToVaras } from "@/lib/units";

export async function generateStaticParams() {
  const slugs = listedHomes(await getCatalog()).map((home) => ({ slug: home.slug }));
  // Cache Components exige al menos un valor; si el catálogo está vacío, esa ruta da 404.
  return slugs.length > 0 ? slugs : [{ slug: "sin-casas" }];
}

async function findHome(slug: string) {
  const catalog = await getCatalog();
  return { catalog, home: listedHomes(catalog).find((h) => h.slug === slug) };
}

export async function generateMetadata({ params }: PageProps<"/[locale]/homes/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const locale = (await getLocale()) as AppLocale;
  const { home } = await findHome(slug);
  if (!home) return {};
  return pageMetadata({
    locale,
    href: { pathname: "/homes/[slug]", params: { slug } },
    title: home.title[locale],
    description: home.summary[locale],
  });
}

export default async function HomeDetailPage({ params }: PageProps<"/[locale]/homes/[slug]">) {
  const { slug } = await params;
  const [{ catalog, home }, t, tc, locale] = await Promise.all([
    findHome(slug),
    getTranslations("catalog"),
    getTranslations("common"),
    getLocale() as Promise<AppLocale>,
  ]);
  if (!home) notFound();

  const place = placeOf(catalog, home);
  const model = home.houseModelId ? catalog.models.find((m) => m.id === home.houseModelId) : undefined;
  const reserved = home.listingStatus === "reserved";
  const title = home.title[locale];
  const d = (key: Parameters<typeof t>[0]) => t(key);

  const facts = [
    { label: d("homes.detail.bedrooms"), value: home.bedrooms },
    { label: d("homes.detail.bathrooms"), value: formatNumber(home.bathrooms, locale, 1) },
    {
      label: d("homes.detail.constructionArea"),
      value: t("facts.area", { value: formatNumber(home.constructionAreaM2, locale) }),
    },
    {
      label: d("homes.detail.lotArea"),
      value: t("facts.lotArea", {
        m2: formatNumber(home.lotAreaM2, locale),
        varas: formatNumber(squareMetersToVaras(home.lotAreaM2), locale),
      }),
    },
    { label: d("homes.detail.floors"), value: home.floors },
    { label: d("homes.detail.parking"), value: home.parkingSpaces },
    { label: d("homes.detail.status"), value: t(`construction.${home.constructionStatus}`) },
    ...(home.estimatedDelivery
      ? [{ label: d("homes.detail.delivery"), value: formatMonthYear(home.estimatedDelivery, locale) }]
      : []),
    ...(model ? [{ label: d("homes.detail.model"), value: model.name[locale] }] : []),
  ];

  return (
    <article className="container-page flex flex-col gap-8 py-8 md:py-12">
      <Breadcrumbs items={[{ label: tc("nav.homes"), href: "/homes" }, { label: title }]} />

      <header className="flex flex-col gap-3">
        <HomeStatusBadges home={home} />
        <h1 className="text-3xl md:text-5xl">{title}</h1>
        <p className="text-lg text-muted-foreground">
          {t("place", place)}
          {home.neighborhood ? ` · ${home.neighborhood}` : null}
        </p>
        <p className="text-sm font-bold text-muted-foreground">
          {t("homes.detail.code", { code: home.code })}
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-10">
          <figure className="flex flex-col gap-2">
            <HouseIllustration
              seed={home.slug}
              floors={home.floors}
              withCarport={home.features.includes("carport") || home.features.includes("covered_garage")}
              title={title}
              className="aspect-[16/10] w-full overflow-hidden rounded-2xl border"
            />
            <figcaption className="text-sm text-muted-foreground">{t("illustrationNote")}</figcaption>
          </figure>

          <DetailSection title={t("homes.detail.summaryTitle")}>
            <FactsList items={facts} />
          </DetailSection>

          <DetailSection title={t("homes.detail.descriptionTitle")}>
            <p className="max-w-prose text-lg">{home.description[locale]}</p>
            <MediaLinks videoUrl={home.videoUrl} tourUrl={home.tourUrl} />
          </DetailSection>

          {home.features.length > 0 ? (
            <DetailSection title={t("homes.detail.featuresTitle")}>
              <FeatureList features={home.features} />
            </DetailSection>
          ) : null}

          {model && model.floorPlan.length > 0 ? (
            <DetailSection title={t("homes.detail.planTitle")}>
              <FloorPlan rooms={model.floorPlan} title={model.name[locale]} />
            </DetailSection>
          ) : null}

          {home.latitude !== null && home.longitude !== null ? (
            <DetailSection title={t("homes.detail.locationTitle")}>
              <LazyMap
                className="h-72 w-full overflow-hidden rounded-2xl border"
                ariaLabel={t("map.ariaOne")}
                linkLabel={t("map.link")}
                zoom={13}
                points={[
                  {
                    id: home.id,
                    latitude: home.latitude,
                    longitude: home.longitude,
                    title,
                    subtitle: t("place", place),
                    href: "#",
                  },
                ]}
              />
              <p className="text-sm text-muted-foreground">{t("map.approx")}</p>
            </DetailSection>
          ) : null}

          <DetailSection title={t("homes.detail.paymentTitle")}>
            <SuggestedPlan payments={suggestedHomePlan(home, catalog.initialPaymentPercent)} kind="home" />
          </DetailSection>

          <DetailSection title={t("homes.detail.documentsTitle")}>
            <DocumentsList items={t.raw("homes.detail.documents") as string[]} />
          </DetailSection>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <ListingActions
            priceUsdCents={home.priceUsdCents}
            usdToHnl={catalog.exchangeRate.usdToHnl}
            primary={{
              label: reserved ? t("homes.detail.similarCta") : t("homes.detail.reserveCta"),
              href: { pathname: "/homes/[slug]", params: { slug }, hash: "solicitud" },
            }}
            scheduleHref={{ pathname: "/schedule", query: { home: home.slug } }}
            scheduleLabel={t("homes.detail.scheduleCta")}
            whatsappHref={whatsappHref(t("homes.detail.whatsappMessage", { code: home.code, title }))}
            whatsappLabel={tc("whatsapp.cta")}
            trustLine={tc("stagePayments")}
          />
        </aside>
      </div>

      <section
        id="solicitud"
        aria-labelledby="solicitud-title"
        className="scroll-mt-24 rounded-3xl bg-muted/50 p-6 md:p-10"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <h2 id="solicitud-title" className="text-2xl md:text-3xl">
            {reserved ? t("homes.detail.formInquiryTitle") : t("homes.detail.formReserveTitle")}
          </h2>
          <p className="text-muted-foreground">
            {reserved ? t("homes.detail.formInquiryIntro") : t("homes.detail.formReserveIntro")}
          </p>
          <LeadForm
            intent={reserved ? "listing_inquiry" : "reservation"}
            homeId={home.id}
            whatsappHref={whatsappHref(t("homes.detail.whatsappMessage", { code: home.code, title }))}
          />
        </div>
      </section>
    </article>
  );
}
