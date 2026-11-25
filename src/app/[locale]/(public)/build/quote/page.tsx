import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PageIntro } from "@/components/shared/page-intro";
import { whatsappHref } from "@/components/shared/whatsapp";
import { getCatalog } from "@/features/catalog/data/load";
import { QuoteWizard } from "@/features/quote/components/quote-wizard";
import { toWizardData } from "@/features/quote/wizard-data";
import type { AppLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("quote.page");
  return pageMetadata({
    locale,
    href: "/build/quote",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function QuotePage({ searchParams }: PageProps<"/[locale]/build/quote">) {
  const t = await getTranslations("quote.page");
  const whatsapp = whatsappHref(t("whatsappMessage"));
  return (
    <>
      <PageIntro title={t("title")} intro={t("intro")} />
      <div className="container-page pb-16">
        <noscript>
          <p className="rounded-2xl bg-accent p-4">
            {t("noscript")}{" "}
            {whatsapp ? (
              <a href={whatsapp} className="font-bold underline">
                {whatsapp}
              </a>
            ) : null}
          </p>
        </noscript>
        <Suspense fallback={<p className="text-muted-foreground">{t("loading")}</p>}>
          <WizardLoader searchParams={searchParams} whatsappHref={whatsapp} />
        </Suspense>
      </div>
    </>
  );
}

async function WizardLoader({
  searchParams,
  whatsappHref,
}: {
  searchParams: PageProps<"/[locale]/build/quote">["searchParams"];
  whatsappHref: string | null;
}) {
  const [catalog, params, messages] = await Promise.all([getCatalog(), searchParams, getMessages()]);
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const slug = (value: string | undefined) => (value && /^[a-z0-9-]{1,80}$/.test(value) ? value : undefined);
  return (
    <NextIntlClientProvider
      messages={{
        common: messages.common,
        forms: messages.forms,
        quote: messages.quote,
        catalog: { facts: messages.catalog.facts },
      }}
    >
      <QuoteWizard
        data={toWizardData(catalog)}
        preset={{ lotSlug: slug(first(params.lot)), modelSlug: slug(first(params.model)) }}
        whatsappHref={whatsappHref}
      />
    </NextIntlClientProvider>
  );
}
