import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PageIntro } from "@/components/shared/page-intro";
import { whatsappHref } from "@/components/shared/whatsapp";
import { activeModels, listedHomes, listedLots } from "@/features/catalog/catalog";
import { getCatalog } from "@/features/catalog/data/load";
import { LeadForm } from "@/features/leads/components/lead-form";
import type { AppLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("content.schedule");
  return pageMetadata({
    locale,
    href: "/schedule",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

const POINTS = ["land", "quote", "documents"] as const;

export default async function SchedulePage({ searchParams }: PageProps<"/[locale]/schedule">) {
  const t = await getTranslations("content.schedule");
  return (
    <>
      <PageIntro title={t("title")} intro={t("intro")} />
      <div className="container-page grid grid-cols-1 gap-10 pb-16 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="schedule-form" className="flex min-w-0 flex-col gap-4">
          <h2 id="schedule-form" className="text-2xl">
            {t("formTitle")}
          </h2>
          <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
            <ScheduleForm searchParams={searchParams} />
          </Suspense>
        </section>
        <aside className="flex flex-col gap-3 self-start rounded-2xl border bg-card p-5">
          <h2 className="text-xl">{t("pointsTitle")}</h2>
          <ul className="flex flex-col gap-2">
            {POINTS.map((key) => (
              <li key={key} className="flex items-start gap-3">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
                {t(`points.${key}`)}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}

/** El contexto (casa, terreno o modelo) llega en la URL por su slug y se valida contra el catálogo. */
async function ScheduleForm({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/schedule">["searchParams"];
}) {
  const [params, catalog, t, tc, locale] = await Promise.all([
    searchParams,
    getCatalog(),
    getTranslations("content.schedule"),
    getTranslations("common"),
    getLocale() as Promise<AppLocale>,
  ]);
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const home = listedHomes(catalog).find((h) => h.slug === first(params.home));
  const lot = listedLots(catalog).find((l) => l.slug === first(params.lot));
  const model = activeModels(catalog).find((m) => m.slug === first(params.model));
  const context = home
    ? t("context.home", { title: home.title[locale] })
    : lot
      ? t("context.lot", { title: lot.title[locale] })
      : model
        ? t("context.model", { title: model.name[locale] })
        : null;

  return (
    <>
      {context ? <p className="rounded-xl bg-accent p-4 font-bold">{context}</p> : null}
      <LeadForm
        intent="video_call"
        homeId={home?.id}
        lotId={home ? undefined : lot?.id}
        modelId={home || lot ? undefined : model?.id}
        whatsappHref={whatsappHref(tc("whatsapp.defaultMessage"))}
      />
    </>
  );
}
