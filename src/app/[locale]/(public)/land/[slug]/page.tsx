import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { ExampleBadge } from "@/components/shared/example-badge";
import { whatsappHref } from "@/components/shared/whatsapp";
import { Badge } from "@/components/ui/badge";
import { activeModels, listedLots } from "@/features/catalog/catalog";
import { LotLegalBadge, ModelCard } from "@/features/catalog/components/cards";
import { LotIllustration } from "@/features/catalog/components/illustrations";
import { LazyMap } from "@/features/catalog/components/lazy-map";
import {
  DetailSection,
  DocumentsList,
  FactsList,
  ListingActions,
  SuggestedPlan,
} from "@/features/catalog/components/listing-detail";
import { getCatalog } from "@/features/catalog/data/load";
import { suggestedLotPlan } from "@/features/catalog/payment-plan";
import { placeOf } from "@/features/catalog/place";
import { LeadForm } from "@/features/leads/components/lead-form";
import { modelPriceRange } from "@/features/quote/engine";
import { pricingRulesFrom } from "@/features/catalog/catalog";
import type { AppLocale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { squareMetersToVaras } from "@/lib/units";

export async function generateStaticParams() {
  const slugs = listedLots(await getCatalog()).map((lot) => ({ slug: lot.slug }));
  return slugs.length > 0 ? slugs : [{ slug: "sin-terrenos" }];
}

async function findLot(slug: string) {
  const catalog = await getCatalog();
  return { catalog, lot: listedLots(catalog).find((l) => l.slug === slug) };
}

export async function generateMetadata({ params }: PageProps<"/[locale]/land/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const locale = (await getLocale()) as AppLocale;
  const { lot } = await findLot(slug);
  if (!lot) return {};
  return pageMetadata({
    locale,
    href: { pathname: "/land/[slug]", params: { slug } },
    title: lot.title[locale],
    description: lot.summary[locale],
  });
}

export default async function LotDetailPage({ params }: PageProps<"/[locale]/land/[slug]">) {
  const { slug } = await params;
  const [{ catalog, lot }, t, tc, locale] = await Promise.all([
    findLot(slug),
    getTranslations("catalog"),
    getTranslations("common"),
    getLocale() as Promise<AppLocale>,
  ]);
  if (!lot) notFound();

  const place = placeOf(catalog, lot);
  const reserved = lot.listingStatus === "reserved";
  const title = lot.title[locale];
  const yesNo = (value: boolean) => (value ? t("yesNo.yes") : t("yesNo.no"));
  const rules = pricingRulesFrom(catalog);
  const fittingModels = activeModels(catalog).filter((m) => m.minLotAreaM2 <= lot.areaM2);

  const facts = [
    {
      label: t("lots.detail.area"),
      value: t("facts.lotArea", {
        m2: formatNumber(lot.areaM2, locale),
        varas: formatNumber(squareMetersToVaras(lot.areaM2), locale),
      }),
    },
    ...(lot.frontM && lot.depthM
      ? [
          {
            label: t("lots.detail.dimensions"),
            value: t("lots.detail.dimensionsValue", {
              front: formatNumber(lot.frontM, locale, 1),
              depth: formatNumber(lot.depthM, locale, 1),
            }),
          },
        ]
      : []),
    { label: t("lots.detail.legal"), value: t(`legal.${lot.legalStatus}`) },
    { label: t("lots.detail.road"), value: t(`road.${lot.roadAccess}`) },
    { label: t("lots.detail.topography"), value: t(`topography.${lot.topography}`) },
    { label: t("lots.detail.water"), value: yesNo(lot.hasWater) },
    { label: t("lots.detail.electricity"), value: yesNo(lot.hasElectricity) },
    { label: t("lots.detail.sewer"), value: yesNo(lot.hasSewer) },
  ];

  return (
    <article className="container-page flex flex-col gap-8 py-8 md:py-12">
      <Breadcrumbs items={[{ label: tc("nav.land"), href: "/land" }, { label: title }]} />

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {reserved ? <Badge variant="brand">{t("listing.reservedLot")}</Badge> : null}
          <LotLegalBadge legalStatus={lot.legalStatus} />
          {lot.isExample ? <ExampleBadge /> : null}
        </div>
        <h1 className="text-3xl md:text-5xl">{title}</h1>
        <p className="text-lg text-muted-foreground">
          {t("place", place)}
          {lot.neighborhood ? ` · ${lot.neighborhood}` : null}
        </p>
        <p className="text-sm font-bold text-muted-foreground">{t("lots.detail.code", { code: lot.code })}</p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-10">
          <figure className="flex flex-col gap-2">
            <LotIllustration
              seed={lot.slug}
              title={title}
              className="aspect-[16/10] w-full overflow-hidden rounded-2xl border"
            />
            <figcaption className="text-sm text-muted-foreground">{t("illustrationNote")}</figcaption>
          </figure>

          <DetailSection title={t("lots.detail.summaryTitle")}>
            <FactsList items={facts} />
            {lot.legalStatus === "title_in_process" ? (
              <p className="rounded-xl bg-accent p-4">{t("lots.detail.inProcessNote")}</p>
            ) : null}
          </DetailSection>

          <DetailSection title={t("lots.detail.descriptionTitle")}>
            <p className="max-w-prose text-lg">{lot.description[locale]}</p>
          </DetailSection>

          <DetailSection title={t("lots.detail.modelsTitle")}>
            {fittingModels.length > 0 ? (
              <ul className="grid gap-6 sm:grid-cols-2">
                {fittingModels.slice(0, 4).map((model) => (
                  <li key={model.id} className="flex">
                    <ModelCard
                      model={model}
                      locale={locale}
                      fromUsdCents={modelPriceRange(model.id, rules)?.minUsdCents ?? null}
                      usdToHnl={catalog.exchangeRate.usdToHnl}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">{t("lots.detail.modelsNone")}</p>
            )}
          </DetailSection>

          {lot.latitude !== null && lot.longitude !== null ? (
            <DetailSection title={t("lots.detail.locationTitle")}>
              <LazyMap
                className="h-72 w-full overflow-hidden rounded-2xl border"
                ariaLabel={t("map.ariaOne")}
                linkLabel={t("map.link")}
                zoom={13}
                points={[
                  {
                    id: lot.id,
                    latitude: lot.latitude,
                    longitude: lot.longitude,
                    title,
                    subtitle: t("place", place),
                    href: "#",
                  },
                ]}
              />
              <p className="text-sm text-muted-foreground">{t("map.approx")}</p>
            </DetailSection>
          ) : null}

          <DetailSection title={t("lots.detail.paymentTitle")}>
            <SuggestedPlan payments={suggestedLotPlan(lot)} kind="lot" />
          </DetailSection>

          <DetailSection title={t("lots.detail.documentsTitle")}>
            <DocumentsList items={t.raw("lots.detail.documents") as string[]} />
          </DetailSection>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <ListingActions
            priceUsdCents={lot.priceUsdCents}
            usdToHnl={catalog.exchangeRate.usdToHnl}
            primary={
              reserved
                ? {
                    label: t("homes.detail.similarCta"),
                    href: { pathname: "/land/[slug]", params: { slug }, hash: "solicitud" },
                  }
                : {
                    label: t("lots.detail.buildCta"),
                    href: { pathname: "/build/quote", query: { lot: lot.slug } },
                  }
            }
            secondary={
              reserved
                ? undefined
                : {
                    label: t("lots.detail.reserveCta"),
                    href: { pathname: "/land/[slug]", params: { slug }, hash: "solicitud" },
                  }
            }
            scheduleHref={{ pathname: "/schedule", query: { lot: lot.slug } }}
            scheduleLabel={t("lots.detail.scheduleCta")}
            whatsappHref={whatsappHref(t("lots.detail.whatsappMessage", { code: lot.code, title }))}
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
            {reserved ? t("lots.detail.formInquiryTitle") : t("lots.detail.formReserveTitle")}
          </h2>
          <p className="text-muted-foreground">
            {reserved ? t("lots.detail.formInquiryIntro") : t("lots.detail.formReserveIntro")}
          </p>
          <LeadForm
            intent={reserved ? "listing_inquiry" : "reservation"}
            lotId={lot.id}
            whatsappHref={whatsappHref(t("lots.detail.whatsappMessage", { code: lot.code, title }))}
          />
        </div>
      </section>
    </article>
  );
}
