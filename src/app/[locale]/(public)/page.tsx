import {
  ArrowRight,
  Check,
  FileCheck2,
  Hammer,
  Home,
  Landmark,
  MessageCircle,
  Receipt,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import { ExampleBadge } from "@/components/shared/example-badge";
import { SectionTitle } from "@/components/shared/page-intro";
import { whatsappHref } from "@/components/shared/whatsapp";
import { Button } from "@/components/ui/button";
import { getCatalog } from "@/features/catalog/data/load";
import { HouseIllustration, LotIllustration } from "@/features/catalog/components/illustrations";
import { FaqList, HOME_FAQ } from "@/features/content/faq";
import { RemittanceCalculator } from "@/features/remittance-calculator/components/remittance-calculator";
import type { OptionStage } from "@/features/projects/types";
import { toCalculatorData } from "@/features/remittance-calculator/data";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("home");
  return pageMetadata({ locale, href: "/", title: t("metaTitle"), description: t("metaDescription") });
}

/** Los dos caminos: comprar una casa lista o construir (con o sin terreno). */
const PATHS = [
  { key: "readyHome", icon: Home, href: "/homes" },
  { key: "build", icon: Hammer, href: "/build" },
] as const satisfies ReadonlyArray<{ key: string; icon: LucideIcon; href: string }>;

const HOW_STEPS = ["quote", "call", "build", "pay"] as const;

const TRUST_POINTS = [
  { key: "stages", icon: ShieldCheck },
  { key: "contract", icon: Landmark },
  { key: "documents", icon: FileCheck2 },
  { key: "accounts", icon: Receipt },
] as const;

const TESTIMONIALS = ["carlos", "wendy", "jose"] as const;

export default async function HomePage() {
  const [t, tc, tp, catalog, messages] = await Promise.all([
    getTranslations("home"),
    getTranslations("common"),
    getTranslations("projects"),
    getCatalog(),
    getMessages(),
  ]);
  const whatsapp = whatsappHref(tc("whatsapp.defaultMessage"));

  return (
    <>
      {/* Hero: el 30 % azul noche, con una sola acción teja */}
      <section className="on-brand bg-brand text-brand-foreground">
        <div className="container-page flex flex-col gap-6 py-12 md:py-20">
          <h1 className="max-w-3xl text-4xl md:text-6xl">{t("hero.title")}</h1>
          <p className="max-w-xl text-lg text-brand-muted md:text-xl">{t("hero.subtitle")}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Button asChild size="lg">
              <Link href="/build">{t("hero.cta")}</Link>
            </Button>
            <Link
              href="/homes"
              className="inline-flex min-h-11 items-center gap-2 font-bold underline underline-offset-4"
            >
              {t("hero.secondary")}
              <ArrowRight aria-hidden="true" className="size-5" />
            </Link>
          </div>
          <ul className="flex flex-col gap-2 text-brand-muted sm:flex-row sm:flex-wrap sm:gap-x-8">
            {(["stages", "photos", "documents"] as const).map((point) => (
              <li key={point} className="flex items-center gap-2">
                <Check aria-hidden="true" className="size-5 shrink-0 text-brand-foreground" />
                {t(`hero.points.${point}`)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Los dos caminos */}
      <section aria-labelledby="paths-title" className="container-page flex flex-col gap-6 py-12 md:py-16">
        <SectionTitle id="paths-title">{t("paths.title")}</SectionTitle>
        <ul className="grid gap-4 sm:grid-cols-2">
          {PATHS.map(({ key, icon: Icon, href }) => (
            <li key={key} className="flex">
              <Link
                href={href}
                className="flex flex-1 flex-col gap-3 rounded-2xl border-2 bg-card p-5 transition-colors hover:border-brand"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent text-brand">
                    <Icon aria-hidden="true" className="size-6" />
                  </span>
                  <ArrowRight aria-hidden="true" className="size-5 text-brand" />
                </span>
                <span className="font-display text-xl font-semibold">{t(`paths.${key}.title`)}</span>
                <span className="text-muted-foreground">{t(`paths.${key}.description`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Cómo funciona */}
      <section aria-labelledby="how-title" className="bg-muted/50">
        <div className="container-page flex flex-col gap-6 py-12 md:py-16">
          <SectionTitle id="how-title">{t("how.title")}</SectionTitle>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_STEPS.map((step, index) => (
              <li key={step} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
                <span className="flex size-10 items-center justify-center rounded-full bg-brand font-bold text-brand-foreground">
                  {index + 1}
                </span>
                <h3 className="text-xl">{t(`how.steps.${step}.title`)}</h3>
                <p className="text-muted-foreground">{t(`how.steps.${step}.body`)}</p>
              </li>
            ))}
          </ol>
          <Link
            href="/how-it-works"
            className="inline-flex min-h-11 items-center gap-2 self-start font-bold text-brand underline underline-offset-4"
          >
            {t("how.link")}
            <ArrowRight aria-hidden="true" className="size-5" />
          </Link>
        </div>
      </section>

      {/* Calculadora de remesa a patrimonio */}
      <section
        id="calculadora"
        aria-labelledby="calc-title"
        className="container-page flex scroll-mt-24 flex-col gap-6 py-12 md:py-16"
      >
        <div className="flex flex-col gap-2">
          <SectionTitle id="calc-title">{t("calculator.title")}</SectionTitle>
          <p className="max-w-2xl text-muted-foreground">
            {(messages.calculator as { intro: string }).intro}
          </p>
        </div>
        <NextIntlClientProvider messages={{ common: messages.common, calculator: messages.calculator }}>
          <RemittanceCalculator
            data={toCalculatorData(catalog, (key) => tp(`stages.${key as OptionStage}.name`))}
          />
        </NextIntlClientProvider>
      </section>

      {/* Confianza */}
      <section aria-labelledby="trust-title" className="bg-muted/50">
        <div className="container-page flex flex-col gap-8 py-12 md:py-16">
          <div className="flex flex-col gap-2">
            <SectionTitle id="trust-title">{t("trust.title")}</SectionTitle>
            <p className="max-w-2xl text-muted-foreground">{t("trust.intro")}</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {TRUST_POINTS.map(({ key, icon: Icon }) => (
              <li key={key} className="flex gap-4 rounded-2xl border bg-card p-5">
                <Icon aria-hidden="true" className="size-8 shrink-0 text-brand" />
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg">{t(`trust.points.${key}.title`)}</h3>
                  <p className="text-muted-foreground">{t(`trust.points.${key}.body`)}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl">{t("trust.showcaseTitle")}</h3>
              <ExampleBadge />
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">{t("trust.showcaseNote")}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <figure className="flex flex-col gap-2">
                <LotIllustration
                  seed="antes-ejemplo"
                  className="aspect-[16/10] w-full overflow-hidden rounded-2xl border"
                />
                <figcaption className="font-bold">{t("trust.before")}</figcaption>
              </figure>
              <figure className="flex flex-col gap-2">
                <HouseIllustration
                  seed="despues-ejemplo"
                  className="aspect-[16/10] w-full overflow-hidden rounded-2xl border"
                />
                <figcaption className="font-bold">{t("trust.after")}</figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonios de ejemplo, marcados como tales */}
      <section
        aria-labelledby="testimonials-title"
        className="container-page flex flex-col gap-6 py-12 md:py-16"
      >
        <div className="flex flex-wrap items-center gap-3">
          <SectionTitle id="testimonials-title">{t("testimonials.title")}</SectionTitle>
          <ExampleBadge />
        </div>
        <p className="text-sm text-muted-foreground">{t("testimonials.note")}</p>
        <ul className="grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((key) => (
            <li key={key} className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
              <blockquote className="text-lg">{t(`testimonials.items.${key}.quote`)}</blockquote>
              <p className="mt-auto flex flex-col">
                <span className="font-bold">{t(`testimonials.items.${key}.name`)}</span>
                <span className="text-sm text-muted-foreground">{t(`testimonials.items.${key}.place`)}</span>
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Preguntas frecuentes */}
      <section aria-labelledby="faq-title" className="container-page flex flex-col gap-6 pb-12 md:pb-16">
        <SectionTitle id="faq-title">{t("faq.title")}</SectionTitle>
        <FaqList keys={HOME_FAQ} />
        <Link
          href="/faq"
          className="inline-flex min-h-11 items-center gap-2 self-start font-bold text-brand underline underline-offset-4"
        >
          {t("faq.more")}
          <ArrowRight aria-hidden="true" className="size-5" />
        </Link>
      </section>

      {/* Llamada final */}
      <section aria-labelledby="final-title" className="on-brand bg-brand text-brand-foreground">
        <div className="container-page flex flex-col items-start gap-5 py-12 md:py-16">
          <h2 id="final-title" className="text-3xl md:text-4xl">
            {t("finalCta.title")}
          </h2>
          <p className="max-w-xl text-lg text-brand-muted">{t("finalCta.body")}</p>
          <div className="flex flex-wrap gap-3">
            {whatsapp ? (
              <Button asChild size="lg" variant="outline-on-brand">
                <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden="true" />
                  {tc("whatsapp.label")}
                </a>
              </Button>
            ) : null}
            <Button asChild size="lg" variant="outline-on-brand">
              <Link href="/schedule">{t("finalCta.schedule")}</Link>
            </Button>
          </div>
          <Link
            href="/build"
            className="inline-flex min-h-11 items-center gap-2 font-bold underline underline-offset-4"
          >
            {t("finalCta.quote")}
            <ArrowRight aria-hidden="true" className="size-5" />
          </Link>
        </div>
      </section>
    </>
  );
}
