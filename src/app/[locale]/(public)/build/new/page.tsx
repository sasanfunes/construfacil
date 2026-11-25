import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PageIntro } from "@/components/shared/page-intro";
import { whatsappHref } from "@/components/shared/whatsapp";
import { getCatalog } from "@/features/catalog/data/load";
import { ProjectWizard } from "@/features/projects/components/project-wizard";
import { toProjectWizardData } from "@/features/projects/wizard-data";
import type { AppLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("projects.wizard");
  return pageMetadata({
    locale,
    href: "/build/new",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/**
 * Página estática: el onboarding sale en el HTML prerenderizado. El terreno o modelo que
 * llega en la URL (`?lot=`, `?model=`, `?land=buy`) lo aplica el propio onboarding.
 */
export default async function NewProjectPage() {
  const t = await getTranslations("projects.wizard");
  const whatsapp = whatsappHref(t("noscript"));
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

/** Reserva el espacio del primer paso para que el pie de página no salte (CLS). */
function WizardSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="flex min-h-[28rem] flex-col gap-6">
      <p className="text-sm font-bold text-muted-foreground">{label}</p>
      <div className="h-2 rounded-full bg-muted" />
      <div className="h-8 w-2/3 rounded-xl bg-muted" />
      <div className="h-14 max-w-xl rounded-2xl bg-muted/70" />
    </div>
  );
}

async function WizardLoader({ whatsappHref }: { whatsappHref: string | null }) {
  const [catalog, messages] = await Promise.all([getCatalog(), getMessages()]);
  const catalogMessages = messages.catalog;
  return (
    <NextIntlClientProvider
      messages={{
        common: messages.common,
        forms: messages.forms,
        projects: {
          stages: messages.projects.stages,
          categories: messages.projects.categories,
          pricing: messages.projects.pricing,
          wizard: messages.projects.wizard,
          summary: messages.projects.summary,
        },
        catalog: { facts: catalogMessages.facts, legal: catalogMessages.legal, place: catalogMessages.place },
      }}
    >
      <ProjectWizard data={toProjectWizardData(catalog)} whatsappHref={whatsappHref} />
    </NextIntlClientProvider>
  );
}
