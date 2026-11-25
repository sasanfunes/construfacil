import { ArrowRight, Calculator, PencilRuler } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { PageIntro, SectionTitle } from "@/components/shared/page-intro";
import { Button } from "@/components/ui/button";
import { activeModels, pricingRulesFrom } from "@/features/catalog/catalog";
import { ModelCard } from "@/features/catalog/components/cards";
import { getCatalog } from "@/features/catalog/data/load";
import { modelPriceRange } from "@/features/quote/engine";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("build");
  return pageMetadata({ locale, href: "/build", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function BuildPage() {
  const [catalog, t, locale] = await Promise.all([
    getCatalog(),
    getTranslations("build"),
    getLocale() as Promise<AppLocale>,
  ]);
  const rules = pricingRulesFrom(catalog);
  const steps = (["design", "stages", "payments", "handover"] as const).map((key) => ({
    title: t(`steps.${key}.title`),
    body: t(`steps.${key}.body`),
  }));

  return (
    <>
      <PageIntro title={t("title")} intro={t("intro")}>
        <div className="flex flex-wrap items-center gap-4">
          <Button asChild size="lg">
            <Link href="/build/quote">{t("cta")}</Link>
          </Button>
          <Link
            href="/calculator"
            className="inline-flex min-h-11 items-center gap-2 font-bold text-brand underline underline-offset-4"
          >
            <Calculator aria-hidden="true" className="size-5" />
            {t("calculatorLink")}
          </Link>
        </div>
      </PageIntro>

      <section aria-labelledby="build-steps" className="container-page flex flex-col gap-6 py-10">
        <SectionTitle id="build-steps">{t("stepsTitle")}</SectionTitle>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
              <span className="flex size-10 items-center justify-center rounded-full bg-brand font-bold text-brand-foreground">
                {index + 1}
              </span>
              <h3 className="text-xl">{step.title}</h3>
              <p className="text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="build-models" className="container-page flex flex-col gap-6 py-10">
        <div className="flex flex-col gap-2">
          <SectionTitle id="build-models">{t("modelsTitle")}</SectionTitle>
          <p className="max-w-2xl text-muted-foreground">{t("modelsIntro")}</p>
        </div>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {activeModels(catalog).map((model) => (
            <li key={model.id} className="flex">
              <ModelCard
                model={model}
                locale={locale}
                fromUsdCents={modelPriceRange(model.id, rules)?.minUsdCents ?? null}
                usdToHnl={catalog.exchangeRate.usdToHnl}
              />
            </li>
          ))}
          <li className="flex">
            <div className="flex flex-1 flex-col gap-3 rounded-2xl bg-accent p-6">
              <PencilRuler aria-hidden="true" className="size-10 text-brand" />
              <h3 className="text-xl">{t("customTitle")}</h3>
              <p>{t("customBody")}</p>
              <Link
                href="/build/quote"
                className="mt-auto inline-flex min-h-11 items-center gap-2 font-bold text-brand underline underline-offset-4"
              >
                {t("customCta")}
                <ArrowRight aria-hidden="true" className="size-5" />
              </Link>
            </div>
          </li>
        </ul>
      </section>
    </>
  );
}
