import {
  ArrowRight,
  Check,
  ClipboardCheck,
  HardHat,
  MessageCircle,
  Package,
  PencilRuler,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { SectionTitle } from "@/components/shared/page-intro";
import { Term } from "@/components/shared/term";
import { whatsappHref } from "@/components/shared/whatsapp";
import { Button } from "@/components/ui/button";
import { activeModels, projectRulesFrom } from "@/features/catalog/catalog";
import { ModelCard } from "@/features/catalog/components/cards";
import { getCatalog } from "@/features/catalog/data/load";
import { modelReferenceEstimate } from "@/features/projects/engine";
import { OPTION_STAGES } from "@/features/projects/types";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("projects.intro");
  return pageMetadata({ locale, href: "/build", title: t("metaTitle"), description: t("metaDescription") });
}

const EXPERTS = [
  { key: "permits", icon: ClipboardCheck },
  { key: "architects", icon: PencilRuler },
  { key: "engineers", icon: HardHat },
  { key: "materials", icon: Package },
] as const satisfies ReadonlyArray<{ key: string; icon: LucideIcon }>;

const STEPS = ["name", "land", "design", "materials", "panel"] as const;

/**
 * "Construir": explica qué es crear un proyecto de construcción y quién guía al cliente,
 * y lo lleva al onboarding (/construir/nuevo).
 */
export default async function BuildPage() {
  const [catalog, t, tp, tc, locale] = await Promise.all([
    getCatalog(),
    getTranslations("projects.intro"),
    getTranslations("projects"),
    getTranslations("common"),
    getLocale() as Promise<AppLocale>,
  ]);
  const rules = projectRulesFrom(catalog);
  const whatsapp = whatsappHref(tc("whatsapp.defaultMessage"));

  return (
    <>
      {/* Presentación: azul noche, con una sola acción teja */}
      <section className="on-brand bg-brand text-brand-foreground">
        <div className="container-page flex flex-col gap-6 py-12 md:py-16">
          <p className="font-bold text-brand-muted">{t("eyebrow")}</p>
          <h1 className="max-w-3xl text-4xl md:text-5xl">{t("title")}</h1>
          <p className="max-w-2xl text-lg text-brand-muted md:text-xl">{t("lead")}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Button asChild size="lg">
              <Link href="/build/new">{t("cta")}</Link>
            </Button>
            <a
              href="#como-pagas"
              className="inline-flex min-h-11 items-center gap-2 font-bold underline underline-offset-4"
            >
              {t("secondary")}
              <ArrowRight aria-hidden="true" className="size-5" />
            </a>
          </div>
          <ul className="flex flex-col gap-2 text-brand-muted sm:flex-row sm:flex-wrap sm:gap-x-8">
            {(["free", "price", "change"] as const).map((point) => (
              <li key={point} className="flex items-center gap-2">
                <Check aria-hidden="true" className="size-5 shrink-0 text-brand-foreground" />
                {t(`points.${point}`)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Expertos que guían */}
      <section aria-labelledby="experts-title" className="container-page flex flex-col gap-6 py-12 md:py-16">
        <div className="flex flex-col gap-2">
          <SectionTitle id="experts-title">{t("experts.title")}</SectionTitle>
          <p className="max-w-2xl text-muted-foreground">{t("experts.intro")}</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EXPERTS.map(({ key, icon: Icon }) => (
            <li key={key} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent text-brand">
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <h3 className="text-xl">{t(`experts.items.${key}.title`)}</h3>
              <p className="text-muted-foreground">{t(`experts.items.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Pasos del onboarding */}
      <section aria-labelledby="steps-title" className="bg-muted/50">
        <div className="container-page flex flex-col gap-6 py-12 md:py-16">
          <SectionTitle id="steps-title">{t("stepsTitle")}</SectionTitle>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((step, index) => (
              <li key={step} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
                <span className="flex size-10 items-center justify-center rounded-full bg-brand font-bold text-brand-foreground">
                  {index + 1}
                </span>
                <h3 className="text-lg">{t(`steps.${step}.title`)}</h3>
                <p className="text-muted-foreground">{t(`steps.${step}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Las 4 etapas */}
      <section aria-labelledby="stages-title" className="container-page flex flex-col gap-6 py-12 md:py-16">
        <div className="flex flex-col gap-2">
          <SectionTitle id="stages-title">{t("stagesTitle")}</SectionTitle>
          <p className="max-w-2xl text-muted-foreground">{t("stagesIntro")}</p>
        </div>
        <ol className="grid gap-4 md:grid-cols-5">
          {OPTION_STAGES.map((stage, index) => (
            <li
              key={stage}
              className={
                index === 0
                  ? "flex flex-col gap-2 rounded-2xl border-2 border-dashed bg-card p-5"
                  : "flex flex-col gap-2 rounded-2xl border bg-card p-5"
              }
            >
              <span className="text-sm font-bold text-primary">{index === 0 ? "0" : index}</span>
              <h3 className="text-lg">
                {stage === "grey_work" ? (
                  <Term term="obraGris">{tp(`stages.${stage}.name`)}</Term>
                ) : (
                  tp(`stages.${stage}.name`)
                )}
              </h3>
              <p className="text-sm text-muted-foreground">{tp(`stages.${stage}.description`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Cómo se paga y abonos */}
      <section id="como-pagas" aria-labelledby="pay-title" className="scroll-mt-24 bg-muted/50">
        <div className="container-page grid gap-6 py-12 md:grid-cols-2 md:py-16">
          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-6">
            <h2 id="pay-title" className="text-2xl">
              {t("payTitle")}
            </h2>
            <p className="text-muted-foreground">{t("payBody")}</p>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-6">
            <h2 className="text-2xl">{t("abonosTitle")}</h2>
            <p className="text-muted-foreground">{t("abonosBody")}</p>
            <p className="text-sm font-bold">{t("abonosSoon")}</p>
          </div>
        </div>
      </section>

      {/* Modelos del catálogo */}
      <section aria-labelledby="models-title" className="container-page flex flex-col gap-6 py-12 md:py-16">
        <div className="flex flex-col gap-2">
          <SectionTitle id="models-title">{t("modelsTitle")}</SectionTitle>
          <p className="max-w-2xl text-muted-foreground">{t("modelsIntro")}</p>
        </div>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {activeModels(catalog).map((model) => (
            <li key={model.id} className="flex">
              <ModelCard
                model={model}
                locale={locale}
                fromUsdCents={modelReferenceEstimate(model.id, rules)?.totalUsdCents ?? null}
                usdToHnl={catalog.exchangeRate.usdToHnl}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* Cierre */}
      <section aria-labelledby="final-title" className="on-brand bg-brand text-brand-foreground">
        <div className="container-page flex flex-col items-start gap-5 py-12 md:py-16">
          <h2 id="final-title" className="text-3xl md:text-4xl">
            {t("finalTitle")}
          </h2>
          <p className="max-w-xl text-lg text-brand-muted">{t("finalBody")}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" variant="outline-on-brand">
              <Link href="/build/new">{t("cta")}</Link>
            </Button>
            {whatsapp ? (
              <Button asChild size="lg" variant="outline-on-brand">
                <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden="true" />
                  {tc("whatsapp.label")}
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
