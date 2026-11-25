import { FileText, Gavel, Landmark, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { PageIntro, SectionTitle } from "@/components/shared/page-intro";
import { Term } from "@/components/shared/term";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("content.how");
  return pageMetadata({
    locale,
    href: "/how-it-works",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

const STEPS = ["quote", "call", "contract", "permits", "build", "delivery"] as const;
const LEGAL = [
  { key: "title", term: "escritura" },
  { key: "power", term: "poderNotarial" },
  { key: "registry", term: "institutoPropiedad" },
] as const;

export default async function HowItWorksPage() {
  const t = await getTranslations("content.how");
  return (
    <>
      <PageIntro title={t("title")} intro={t("intro")} />
      <div className="container-page flex flex-col gap-14 pb-16">
        <section aria-labelledby="steps-title" className="flex flex-col gap-6">
          <SectionTitle id="steps-title">{t("stepsTitle")}</SectionTitle>
          <ol className="relative flex flex-col gap-6 border-l-2 pl-8">
            {STEPS.map((step, index) => (
              <li key={step} className="relative flex flex-col gap-1">
                <span className="absolute top-0 -left-[3.05rem] flex size-9 items-center justify-center rounded-full bg-brand font-bold text-brand-foreground">
                  {index + 1}
                </span>
                <h3 className="text-xl">{t(`steps.${step}.title`)}</h3>
                <p className="max-w-prose text-muted-foreground">{t(`steps.${step}.body`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="payments-title"
          className="flex flex-col gap-4 rounded-3xl bg-accent p-6 md:p-10"
        >
          <SectionTitle id="payments-title">{t("paymentsTitle")}</SectionTitle>
          <p className="max-w-prose text-lg">{t("paymentsBody")}</p>
          <p className="max-w-prose rounded-2xl bg-card p-4">{t("paymentsExample")}</p>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <section aria-labelledby="contract-title" className="flex flex-col gap-3">
            <FileText aria-hidden="true" className="size-8 text-brand" />
            <h2 id="contract-title" className="text-2xl">
              {t("contractTitle")}
            </h2>
            <p className="text-muted-foreground">{t("contractBody")}</p>
          </section>
          <section aria-labelledby="guarantees-title" className="flex flex-col gap-3">
            <ShieldCheck aria-hidden="true" className="size-8 text-brand" />
            <h2 id="guarantees-title" className="text-2xl">
              {t("guaranteesTitle")}
            </h2>
            <p className="text-muted-foreground">{t("guaranteesBody")}</p>
          </section>
        </div>

        <section aria-labelledby="legal-title" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <SectionTitle id="legal-title">{t("legalTitle")}</SectionTitle>
            <p className="max-w-2xl text-muted-foreground">{t("legalIntro")}</p>
          </div>
          <ul className="grid gap-4 md:grid-cols-3">
            {LEGAL.map(({ key, term }) => (
              <li key={key} className="flex flex-col gap-2 rounded-2xl border bg-card p-5">
                <Gavel aria-hidden="true" className="size-6 text-brand" />
                <h3 className="text-lg">{t(`legal.${key}.title`)}</h3>
                <p className="text-muted-foreground">{t(`legal.${key}.body`)}</p>
                <span className="text-sm">
                  <Term term={term} />
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="family-title" className="flex flex-col gap-3">
          <Users aria-hidden="true" className="size-8 text-brand" />
          <h2 id="family-title" className="text-2xl">
            {t("familyTitle")}
          </h2>
          <p className="max-w-prose text-muted-foreground">{t("familyBody")}</p>
        </section>

        <section
          aria-labelledby="cta-title"
          className="on-brand flex flex-col items-start gap-4 rounded-3xl bg-brand p-6 text-brand-foreground md:p-10"
        >
          <Landmark aria-hidden="true" className="size-8" />
          <h2 id="cta-title" className="text-2xl md:text-3xl">
            {t("ctaTitle")}
          </h2>
          <Button asChild size="lg">
            <Link href="/build">{t("cta")}</Link>
          </Button>
        </section>
      </div>
    </>
  );
}
