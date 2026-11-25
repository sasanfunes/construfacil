import { CalendarDays, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { ExampleBadge } from "@/components/shared/example-badge";
import { Price } from "@/components/shared/price";
import { whatsappHref } from "@/components/shared/whatsapp";
import { Button } from "@/components/ui/button";
import { activeModels, pricingRulesFrom } from "@/features/catalog/catalog";
import { FloorPlan } from "@/features/catalog/components/floor-plan";
import { HouseIllustration } from "@/features/catalog/components/illustrations";
import { DetailSection, FactsList } from "@/features/catalog/components/listing-detail";
import { getCatalog } from "@/features/catalog/data/load";
import { calculateQuote } from "@/features/quote/engine";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { squareMetersToVaras } from "@/lib/units";

/** Departamento de referencia para los precios de la ficha: Cortés (factor 1.0). */
const REFERENCE_DEPARTMENT = 5;

export async function generateStaticParams() {
  const slugs = activeModels(await getCatalog()).map((m) => ({ slug: m.slug }));
  return slugs.length > 0 ? slugs : [{ slug: "sin-modelos" }];
}

async function findModel(slug: string) {
  const catalog = await getCatalog();
  return { catalog, model: activeModels(catalog).find((m) => m.slug === slug) };
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/build/models/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const locale = (await getLocale()) as AppLocale;
  const { model } = await findModel(slug);
  if (!model) return {};
  return pageMetadata({
    locale,
    href: { pathname: "/build/models/[slug]", params: { slug } },
    title: model.name[locale],
    description: model.summary[locale],
  });
}

export default async function ModelPage({ params }: PageProps<"/[locale]/build/models/[slug]">) {
  const { slug } = await params;
  const [{ catalog, model }, t, tc, tcat, locale] = await Promise.all([
    findModel(slug),
    getTranslations("build.model"),
    getTranslations("common"),
    getTranslations("catalog"),
    getLocale() as Promise<AppLocale>,
  ]);
  if (!model) notFound();

  const rules = pricingRulesFrom(catalog);
  const department =
    catalog.departments.find((d) => d.id === REFERENCE_DEPARTMENT && d.isActive) ??
    catalog.departments.find((d) => d.isActive);
  const prices = department
    ? [...catalog.finishLevels]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((finish) => ({
          finish,
          usdCents: calculateQuote(
            {
              landStatus: "not_yet",
              lotId: null,
              departmentId: department.id,
              municipalityId: null,
              landAreaM2: null,
              design: { kind: "model", modelId: model.id },
              finishLevelId: finish.id,
              extras: [],
            },
            rules,
          ).constructionUsdCents,
        }))
    : [];
  const name = model.name[locale];
  const wa = whatsappHref(t("whatsappMessage", { model: name }));

  return (
    <article className="container-page flex flex-col gap-8 py-8 md:py-12">
      <Breadcrumbs items={[{ label: tc("nav.build"), href: "/build" }, { label: name }]} />
      <header className="flex flex-col gap-3">
        {model.isExample ? <ExampleBadge className="self-start" /> : null}
        <h1 className="text-3xl md:text-5xl">{name}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">{model.summary[locale]}</p>
      </header>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-10">
          <figure className="flex flex-col gap-2">
            <HouseIllustration
              seed={model.slug}
              floors={model.floors}
              withCarport={model.floorPlan.some((r) => r.room === "carport")}
              title={name}
              className="aspect-[16/10] w-full overflow-hidden rounded-2xl border"
            />
            <figcaption className="text-sm text-muted-foreground">{tcat("illustrationNote")}</figcaption>
          </figure>

          <DetailSection title={t("factsTitle")}>
            <FactsList
              items={[
                {
                  label: t("area"),
                  value: tcat("facts.area", { value: formatNumber(model.areaM2, locale) }),
                },
                { label: t("bedrooms"), value: model.bedrooms },
                { label: t("bathrooms"), value: formatNumber(model.bathrooms, locale, 1) },
                { label: t("floors"), value: model.floors },
                {
                  label: t("minLot"),
                  value: tcat("facts.lotArea", {
                    m2: formatNumber(model.minLotAreaM2, locale),
                    varas: formatNumber(squareMetersToVaras(model.minLotAreaM2), locale),
                  }),
                },
                ...(model.minLotFrontM
                  ? [
                      {
                        label: t("minFront"),
                        value: t("minFrontValue", { value: formatNumber(model.minLotFrontM, locale, 1) }),
                      },
                    ]
                  : []),
                { label: t("buildTime"), value: tc("units.weeks", { count: model.buildWeeks }) },
              ]}
            />
          </DetailSection>

          <DetailSection title={t("descriptionTitle")}>
            <p className="max-w-prose text-lg">{model.description[locale]}</p>
          </DetailSection>

          {model.floorPlan.length > 0 ? (
            <DetailSection title={t("planTitle")}>
              <FloorPlan rooms={model.floorPlan} title={name} />
            </DetailSection>
          ) : null}

          {department ? (
            <DetailSection title={t("pricesTitle")}>
              <p className="text-muted-foreground">{t("pricesIntro", { department: department.name })}</p>
              <div className="overflow-x-auto rounded-2xl border">
                <table className="w-full bg-card text-left">
                  <thead className="bg-muted">
                    <tr>
                      <th scope="col" className="p-4">
                        {t("finishCol")}
                      </th>
                      <th scope="col" className="p-4">
                        {t("priceCol")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {prices.map(({ finish, usdCents }) => (
                      <tr key={finish.id} className="border-t">
                        <th scope="row" className="p-4 font-bold">
                          {finish.name[locale]}
                        </th>
                        <td className="p-4">
                          <Price usdCents={usdCents} usdToHnl={catalog.exchangeRate.usdToHnl} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted-foreground">{t("pricesNote")}</p>
            </DetailSection>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm">
            {prices[0] ? (
              <div className="flex flex-col">
                <span className="text-sm font-bold text-muted-foreground">{tcat("models.from")}</span>
                <Price
                  usdCents={Math.min(...prices.map((p) => p.usdCents))}
                  usdToHnl={catalog.exchangeRate.usdToHnl}
                  size="lg"
                />
              </div>
            ) : null}
            <Button asChild size="lg">
              <Link href={{ pathname: "/build/quote", query: { model: model.slug } }}>{t("quoteCta")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={{ pathname: "/schedule", query: { model: model.slug } }}>
                <CalendarDays aria-hidden="true" />
                {t("scheduleCta")}
              </Link>
            </Button>
            {wa ? (
              <Button asChild variant="ghost">
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden="true" />
                  {tc("whatsapp.cta")}
                </a>
              </Button>
            ) : null}
          </div>
        </aside>
      </div>
    </article>
  );
}
