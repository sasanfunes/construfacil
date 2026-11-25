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

/**
 * Página estática: el cotizador sale en el HTML prerenderizado. El terreno o modelo que llega
 * en la URL (`?lot=`, `?model=`) lo aplica el propio cotizador en el navegador.
 */
export default async function QuotePage() {
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
        <Suspense fallback={<WizardSkeleton label={t("loading")} />}>
          <WizardLoader whatsappHref={whatsapp} />
        </Suspense>
      </div>
    </>
  );
}

/**
 * Mientras llega el cotizador se reserva su espacio (primer paso: unos 760 px en el celular y
 * 600 px en escritorio). Si no, el pie de página salta hacia abajo al aparecer (CLS).
 */
function WizardSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="flex min-h-[47.5rem] flex-col gap-6 md:min-h-[38rem]">
      <p className="text-sm font-bold text-muted-foreground">{label}</p>
      <div className="h-2 rounded-full bg-muted" />
      <div className="h-8 w-2/3 rounded-xl bg-muted" />
      <div className="flex flex-col gap-3">
        <div className="h-24 rounded-2xl bg-muted/70" />
        <div className="h-24 rounded-2xl bg-muted/70" />
        <div className="h-24 rounded-2xl bg-muted/70" />
      </div>
    </div>
  );
}

async function WizardLoader({ whatsappHref }: { whatsappHref: string | null }) {
  const [catalog, messages] = await Promise.all([getCatalog(), getMessages()]);
  return (
    <NextIntlClientProvider
      messages={{
        common: messages.common,
        forms: messages.forms,
        quote: messages.quote,
        catalog: { facts: messages.catalog.facts },
      }}
    >
      <QuoteWizard data={toWizardData(catalog)} whatsappHref={whatsappHref} />
    </NextIntlClientProvider>
  );
}
