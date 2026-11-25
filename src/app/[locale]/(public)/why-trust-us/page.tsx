import { Building2, CheckCircle2, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { ExampleBadge } from "@/components/shared/example-badge";
import { PageIntro, SectionTitle } from "@/components/shared/page-intro";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("content.trust");
  return pageMetadata({
    locale,
    href: "/why-trust-us",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

const PROMISES = ["contract", "stages", "photos", "documents", "receipts"] as const;
const NEVER = ["personal", "upfront", "permits", "hidden"] as const;
const TEAM = ["ana", "luis", "karla", "roberto"] as const;

export default async function WhyTrustUsPage() {
  const t = await getTranslations("content.trust");
  return (
    <>
      <PageIntro title={t("title")} intro={t("intro")} />
      <div className="container-page flex flex-col gap-14 pb-16">
        <div className="grid gap-6 md:grid-cols-2">
          <section
            aria-labelledby="promises-title"
            className="flex flex-col gap-4 rounded-2xl border bg-card p-6"
          >
            <h2 id="promises-title" className="text-2xl">
              {t("promisesTitle")}
            </h2>
            <ul className="flex flex-col gap-3">
              {PROMISES.map((key) => (
                <li key={key} className="flex items-start gap-3">
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-success" />
                  {t(`promises.${key}`)}
                </li>
              ))}
            </ul>
          </section>
          <section
            aria-labelledby="never-title"
            className="flex flex-col gap-4 rounded-2xl border bg-card p-6"
          >
            <h2 id="never-title" className="text-2xl">
              {t("neverTitle")}
            </h2>
            <ul className="flex flex-col gap-3">
              {NEVER.map((key) => (
                <li key={key} className="flex items-start gap-3">
                  <XCircle aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-destructive" />
                  {t(`never.${key}`)}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section aria-labelledby="company-title" className="flex flex-col gap-3 rounded-2xl bg-muted/50 p-6">
          <Building2 aria-hidden="true" className="size-8 text-brand" />
          <h2 id="company-title" className="text-2xl">
            {t("companyTitle")}
          </h2>
          <p className="text-muted-foreground">{t("companyBody")}</p>
        </section>

        <section aria-labelledby="team-title" className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <SectionTitle id="team-title">{t("teamTitle")}</SectionTitle>
            <ExampleBadge />
          </div>
          <p className="text-sm text-muted-foreground">{t("teamNote")}</p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((key) => {
              const name = t(`team.${key}.name`);
              const initials = name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2);
              return (
                <li key={key} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
                  <span
                    aria-hidden="true"
                    className="flex size-16 items-center justify-center rounded-full bg-accent font-display text-xl font-semibold text-brand"
                  >
                    {initials}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-lg font-bold">{name}</span>
                    <span className="text-sm font-bold text-brand">{t(`team.${key}.role`)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{t(`team.${key}.bio`)}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <Button asChild size="lg" className="self-start">
          <Link href="/contact">{t("cta")}</Link>
        </Button>
      </div>
    </>
  );
}
