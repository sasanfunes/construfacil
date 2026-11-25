"use client";

import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { Usd } from "@/components/shared/price";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import type { AppLocale } from "@/i18n/routing";
import { formatUsd } from "@/lib/money";

import { requestProjectHelp, updateProjectSelections } from "../actions";
import { PROJECT_REQUEST_KINDS } from "../schemas";
import { BUILD_STAGES, type ConstructionOption, type OptionCategory, type ProjectEstimate } from "../types";

import { EstimateSummary } from "./estimate-summary";
import { StageOptions } from "./stage-options";

/**
 * Materiales del proyecto, editables mientras es un borrador. Cada cambio se manda al
 * servidor, que recalcula con las reglas de la base, guarda y devuelve el nuevo estimado.
 */
export function MaterialsEditor({
  token,
  initialEstimate,
  initialOptionIds,
  options,
  usdToHnl,
  editable,
  whatsappHref,
}: {
  token: string;
  initialEstimate: ProjectEstimate;
  initialOptionIds: string[];
  options: ConstructionOption[];
  usdToHnl: number;
  editable: boolean;
  whatsappHref: string | null;
}) {
  const t = useTranslations("projects");
  const locale = useLocale() as AppLocale;
  const id = useId().replace(/:/g, "");
  const [estimate, setEstimate] = useState(initialEstimate);
  const [optionIds, setOptionIds] = useState(initialOptionIds);
  const [status, setStatus] = useState<"idle" | "saved" | { error: string }>("idle");
  const [pending, startTransition] = useTransition();
  const floors = estimate.design.floors;

  function choose(category: OptionCategory, optionId: string) {
    const previous = optionIds;
    const next = [
      ...optionIds.filter((existing) => options.find((o) => o.id === existing)?.category !== category),
      optionId,
    ];
    setOptionIds(next);
    setStatus("idle");
    startTransition(async () => {
      const response = await updateProjectSelections({ locale, token, optionIds: next });
      if (response.status === "success") {
        setEstimate(response.estimate);
        setStatus("saved");
      } else {
        setOptionIds(previous);
        setStatus({ error: t(`panel.saveErrors.${response.error}`) });
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section
        id="materiales"
        aria-labelledby={`${id}-materials`}
        className="flex min-w-0 scroll-mt-24 flex-col gap-8"
      >
        <div className="flex flex-col gap-2">
          <h2 id={`${id}-materials`} className="text-2xl md:text-3xl">
            {t("panel.materialsTitle")}
          </h2>
          <p className="text-muted-foreground">
            {editable ? t("panel.materialsIntro") : t("panel.materialsLocked")}
          </p>
          <p aria-live="polite" className="min-h-6 text-sm font-bold">
            {pending ? (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                {t("panel.saving")}
              </span>
            ) : status === "saved" ? (
              <span className="inline-flex items-center gap-2 text-success">
                <CheckCircle2 aria-hidden="true" className="size-4" />
                {t("panel.saved")}
              </span>
            ) : typeof status === "object" ? (
              <span role="alert" className="text-destructive">
                {status.error}
              </span>
            ) : null}
          </p>
        </div>
        {BUILD_STAGES.map((stage, index) => (
          <section
            key={stage}
            aria-labelledby={`${id}-${stage}`}
            className="flex flex-col gap-4 rounded-2xl border p-4 md:p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 id={`${id}-${stage}`} className="text-xl">
                {t("panel.stageHeading", { number: index + 1, stage: t(`stages.${stage}.name`) })}
              </h3>
              <Usd
                usdCents={estimate.stages.find((s) => s.key === stage)?.costUsdCents ?? 0}
                className="text-lg font-bold"
              />
            </div>
            <StageOptions
              idPrefix={`${id}-${stage}`}
              stage={stage}
              floors={floors}
              options={options}
              selectedIds={optionIds}
              regionFactor={estimate.regionFactor}
              onSelect={choose}
              disabled={!editable || pending}
            />
          </section>
        ))}
      </section>

      <aside className="flex flex-col gap-8 lg:sticky lg:top-6 lg:self-start">
        <EstimateSummary estimate={estimate} usdToHnl={usdToHnl} />
        <MaterialPackages estimate={estimate} whatsappHref={whatsappHref} locale={locale} />
      </aside>
    </div>
  );
}

/** Paquetes de materiales por etapa, a los que el cliente podrá abonar. */
function MaterialPackages({
  estimate,
  whatsappHref,
  locale,
}: {
  estimate: ProjectEstimate;
  whatsappHref: string | null;
  locale: AppLocale;
}) {
  const t = useTranslations("projects");
  return (
    <section id="abonos" className="flex scroll-mt-24 flex-col gap-3">
      <h3 className="text-xl">{t("panel.abonos.title")}</h3>
      <p className="text-muted-foreground">{t("panel.abonos.intro")}</p>
      <ul className="flex flex-col gap-2">
        {estimate.stages
          .filter((stage) => stage.materialsUsdCents > 0)
          .map((stage) => (
            <li key={stage.key} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-bold">{t(`stages.${stage.key}.name`)}</span>
                <Usd usdCents={stage.materialsUsdCents} className="font-bold" />
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span className="block h-full w-0 rounded-full bg-success" />
              </span>
              <span className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
                <span>{t("panel.abonos.paid", { amount: formatUsd(0, locale) })}</span>
                <span>
                  {t("panel.abonos.remaining", { amount: formatUsd(stage.materialsUsdCents, locale) })}
                </span>
              </span>
            </li>
          ))}
      </ul>
      <p className="text-sm font-bold">{t("panel.abonos.soon")}</p>
      {whatsappHref ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 font-bold text-brand underline underline-offset-4"
        >
          <MessageCircle aria-hidden="true" className="size-5" />
          {t("panel.actions.contribute.cta")}
        </a>
      ) : null}
    </section>
  );
}

/** Solicitud al equipo desde el panel: servicios, prueba de avance o soporte. */
export function ProjectRequestForm({ token }: { token: string }) {
  const t = useTranslations("projects.panel.request");
  const locale = useLocale() as AppLocale;
  const id = useId().replace(/:/g, "");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<"sent" | { error: string } | null>(null);

  if (result === "sent") {
    return (
      <p role="status" className="flex items-start gap-3 rounded-2xl border bg-card p-5 font-bold">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-success" />
        {t("sent")}
      </p>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        setResult(null);
        startTransition(async () => {
          const response = await requestProjectHelp({
            locale,
            token,
            kind: values.get("kind"),
            message: values.get("message"),
          });
          setResult(response.status === "success" ? "sent" : { error: t(`errors.${response.error}`) });
        });
      }}
    >
      {result && typeof result === "object" ? (
        <p role="alert" className="rounded-xl bg-destructive/10 p-4 font-bold text-destructive">
          {result.error}
        </p>
      ) : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-bold">{t("kind")}</legend>
        <div className="flex flex-wrap gap-2">
          {PROJECT_REQUEST_KINDS.map((kind) => (
            <label
              key={kind}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-4 font-bold has-[:checked]:border-brand has-[:checked]:bg-accent"
            >
              <input
                type="radio"
                name="kind"
                value={kind}
                defaultChecked={kind === "service"}
                className="size-5 accent-[var(--brand)]"
              />
              {t(`kinds.${kind}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <Field id={`${id}-message`} label={t("message")}>
        <Textarea id={`${id}-message`} name="message" maxLength={1000} />
      </Field>
      <Button type="submit" variant="brand" size="lg" disabled={pending} className="self-start">
        {pending ? t("pending") : t("submit")}
      </Button>
    </form>
  );
}
