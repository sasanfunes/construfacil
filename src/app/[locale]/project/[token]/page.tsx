import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { whatsappHref } from "@/components/shared/whatsapp";
import { Badge } from "@/components/ui/badge";
import { getCatalog } from "@/features/catalog/data/load";
import { hashAccessToken, isWellFormedAccessToken } from "@/features/leads/token";
import { ProjectPanel } from "@/features/projects/components/project-panel";
import { getProjectStore } from "@/features/projects/store";
import { OPTION_CATEGORIES } from "@/features/projects/types";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { formatDate, formatNumber } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projects.panel");
  return { title: t("metaTitle") };
}

/**
 * Panel del proyecto. Se abre solo con el token del enlace privado: el token no se guarda,
 * solo su SHA-256. Muestra la foto guardada del proyecto y deja cambiar los materiales
 * mientras es un borrador.
 */
export default async function ProjectPanelPage({ params }: PageProps<"/[locale]/project/[token]">) {
  await connection();
  const { token } = await params;
  if (!isWellFormedAccessToken(token)) notFound();

  const [project, catalog, t, tp, tc, messages, locale] = await Promise.all([
    getProjectStore().findByTokenHash(hashAccessToken(token)),
    getCatalog(),
    getTranslations("projects.panel"),
    getTranslations("projects"),
    getTranslations("catalog"),
    getMessages(),
    getLocale() as Promise<AppLocale>,
  ]);
  if (!project) notFound();

  const { input, estimate } = project;
  const lot = input.lotId ? catalog.lots.find((l) => l.id === input.lotId) : undefined;
  const model = estimate.design.houseModelId
    ? catalog.models.find((m) => m.id === estimate.design.houseModelId)
    : undefined;
  const department = catalog.departments.find((d) => d.id === estimate.location.departmentId);
  const municipality = catalog.municipalities.find((m) => m.id === estimate.location.municipalityId);
  const place = department
    ? municipality
      ? tc("place", { municipality: municipality.name, department: department.name })
      : department.name
    : null;
  const landText =
    input.landStatus === "buying_from_us"
      ? t("land.buying_from_us", { code: lot?.code ?? "" })
      : input.landStatus === "own"
        ? place
          ? t("land.own", { place })
          : t("land.ownNoPlace")
        : t("land.skipped");
  const designText =
    estimate.design.source === "catalog"
      ? t("design.catalog", { name: model?.name[locale] ?? "" })
      : t(`design.${estimate.design.source}`);
  const help = whatsappHref(t("whatsappMessage", { code: project.code }));
  const contribute = whatsappHref(t("contributeMessage", { code: project.code }));
  const editable = project.status === "draft";
  // Las opciones que eligió el cliente (no las incluidas ni la de diseño).
  const optionIds = estimate.lines
    .filter((line) => OPTION_CATEGORIES[line.category].choice === "user")
    .map((line) => line.optionId);

  // El encabezado se arma aquí (servidor); el panel le pone al lado el total del proyecto.
  const header = (
    <>
      <p className="flex flex-wrap items-center gap-3 text-sm font-bold text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Lock aria-hidden="true" className="size-4" />
          {t("code", { code: project.code })}
        </span>
        <Badge variant={editable ? "neutral" : "brand"}>{t(`status.${project.status}`)}</Badge>
      </p>
      <p className="text-lg font-bold">
        {project.firstName ? t("greeting", { name: project.firstName }) : t("greetingNoName")}
      </p>
      <h1 className="text-3xl md:text-4xl lg:text-5xl">{project.name}</h1>
      <p className="text-muted-foreground">
        {t("recap", {
          land: landText,
          design: designText,
          facts: tp("summary.designFacts", {
            area: formatNumber(estimate.design.areaM2, locale),
            floors: estimate.design.floors,
            bedrooms: estimate.design.bedrooms,
            bathrooms: estimate.design.bathrooms,
          }),
        })}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("created", { date: formatDate(project.createdAt, locale) })}
      </p>
    </>
  );

  return (
    <div className="container-page flex flex-col gap-10 py-8 md:py-12">
      <NextIntlClientProvider
        messages={{
          common: messages.common,
          calculator: messages.calculator,
          projects: {
            stages: messages.projects.stages,
            categories: messages.projects.categories,
            pricing: messages.projects.pricing,
            wizard: { stage: messages.projects.wizard.stage },
            summary: messages.projects.summary,
            panel: messages.projects.panel,
          },
        }}
      >
        <ProjectPanel
          header={header}
          token={token}
          initialEstimate={estimate}
          initialOptionIds={optionIds}
          options={catalog.constructionOptions.filter((o) => o.isActive)}
          usdToHnl={project.usdToHnl}
          editable={editable}
          contributeHref={contribute}
          helpHref={help}
        />
      </NextIntlClientProvider>

      <footer className="flex flex-col gap-3 border-t pt-6">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("privateNote")}
        </p>
        <Link
          href="/build/new"
          className="inline-flex min-h-11 items-center font-bold text-brand underline underline-offset-4"
        >
          {t("newProject")}
        </Link>
      </footer>
    </div>
  );
}
