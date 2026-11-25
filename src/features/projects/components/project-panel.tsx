"use client";

import {
  Calculator,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  HardHat,
  Headset,
  Loader2,
  MessageCircle,
  Package,
  Wallet,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition, type ReactNode } from "react";

import { Usd } from "@/components/shared/price";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { ProjectCalculator } from "@/features/remittance-calculator/components/project-calculator";
import type { AppLocale } from "@/i18n/routing";
import { formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

import { requestProjectHelp, updateProjectSelections } from "../actions";
import {
  BUILD_STAGES,
  type ConstructionOption,
  type OptionCategory,
  type ProjectEstimate,
  type ProjectRequestKind,
} from "../types";

import { EstimateDetails, EstimateTotal, EstimateWarnings } from "./estimate-summary";
import { StageOptions } from "./stage-options";

/** Lo que se puede hacer desde el panel. Cada botón abre su opción debajo, en la misma página. */
const ACTIONS = [
  { key: "materials", icon: Package },
  { key: "calculate", icon: Calculator },
  { key: "contribute", icon: Wallet },
  { key: "services", icon: HardHat, kind: "service" },
  { key: "progress", icon: ClipboardList, kind: "progress_proof" },
  { key: "support", icon: Headset, kind: "support" },
] as const satisfies ReadonlyArray<{ key: string; icon: unknown; kind?: ProjectRequestKind }>;

type ActionKey = (typeof ACTIONS)[number]["key"];

/**
 * Panel del proyecto. El encabezado (nombre, estado, resumen en texto) llega ya armado del
 * servidor; aquí se agregan el total, que se actualiza al cambiar materiales, y las opciones.
 */
export function ProjectPanel({
  header,
  token,
  initialEstimate,
  initialOptionIds,
  options,
  usdToHnl,
  editable,
  contributeHref,
  helpHref,
}: {
  header: ReactNode;
  token: string;
  initialEstimate: ProjectEstimate;
  initialOptionIds: string[];
  options: ConstructionOption[];
  usdToHnl: number;
  editable: boolean;
  contributeHref: string | null;
  helpHref: string | null;
}) {
  const t = useTranslations("projects");
  const id = useId().replace(/:/g, "");
  const [estimate, setEstimate] = useState(initialEstimate);
  // Materiales abierto de entrada: es lo principal del panel.
  const [open, setOpen] = useState<ActionKey | null>("materials");
  const stageNames = Object.fromEntries(estimate.stages.map((s) => [s.key, t(`stages.${s.key}.name`)]));

  function panel(action: (typeof ACTIONS)[number]) {
    switch (action.key) {
      case "materials":
        return (
          <MaterialsEditor
            token={token}
            estimate={estimate}
            onEstimate={setEstimate}
            initialOptionIds={initialOptionIds}
            options={options}
            editable={editable}
          />
        );
      case "calculate":
        return (
          <div className="flex flex-col gap-5">
            <p className="text-muted-foreground">{t("panel.actions.calculate.body")}</p>
            <ProjectCalculator plan={estimate} stageNames={stageNames} />
          </div>
        );
      case "contribute":
        return <MaterialPackages estimate={estimate} whatsappHref={contributeHref} />;
      default:
        return (
          <div className="flex flex-col gap-5 rounded-2xl bg-muted/60 p-5 md:p-8">
            <p className="text-muted-foreground">{t(`panel.actions.${action.key}.body`)}</p>
            <ProjectRequestForm token={token} kind={action.kind} />
            {helpHref ? (
              <a
                href={helpHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 self-start font-bold text-brand underline underline-offset-4"
              >
                <MessageCircle aria-hidden="true" className="size-5" />
                {t("panel.actions.whatsapp")}
              </a>
            ) : null}
          </div>
        );
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_20rem] md:items-center lg:grid-cols-[minmax(0,1fr)_22rem]">
        <header className="flex min-w-0 flex-col gap-3">{header}</header>
        <div className="flex flex-col gap-4">
          <EstimateTotal estimate={estimate} usdToHnl={usdToHnl} />
          <EstimateWarnings estimate={estimate} />
        </div>
      </div>

      <section aria-labelledby={`${id}-actions`} className="flex flex-col gap-4">
        <h2 id={`${id}-actions`} className="text-2xl">
          {t("panel.actionsTitle")}
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACTIONS.map(({ key, icon: Icon }) => {
            const expanded = open === key;
            return (
              <li key={key} className="flex">
                <button
                  type="button"
                  id={`${id}-${key}-button`}
                  aria-expanded={expanded}
                  aria-controls={`${id}-${key}-panel`}
                  onClick={() => setOpen(expanded ? null : key)}
                  className={cn(
                    "flex min-h-12 flex-1 items-center gap-2.5 rounded-2xl border-2 bg-card px-3 py-2 text-left font-display text-sm font-semibold transition-colors hover:border-brand sm:text-base",
                    expanded && "border-brand bg-accent",
                  )}
                >
                  <Icon aria-hidden="true" className="size-5 shrink-0 text-brand" />
                  <span className="flex-1">{t(`panel.actions.${key}.title`)}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      expanded && "rotate-180",
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>
        {/* Todas las opciones quedan en la página (ocultas): así no se pierde lo escrito al cambiar. */}
        {ACTIONS.map((action) => (
          <div
            key={action.key}
            id={`${id}-${action.key}-panel`}
            role="region"
            aria-labelledby={`${id}-${action.key}-button`}
            hidden={open !== action.key}
            className="pt-2"
          >
            {panel(action)}
          </div>
        ))}
      </section>
    </div>
  );
}

/**
 * Materiales del proyecto, editables mientras es un borrador. Cada cambio se manda al
 * servidor, que recalcula con las reglas de la base, guarda y devuelve el nuevo estimado.
 */
function MaterialsEditor({
  token,
  estimate,
  onEstimate,
  initialOptionIds,
  options,
  editable,
}: {
  token: string;
  estimate: ProjectEstimate;
  onEstimate: (estimate: ProjectEstimate) => void;
  initialOptionIds: string[];
  options: ConstructionOption[];
  editable: boolean;
}) {
  const t = useTranslations("projects");
  const locale = useLocale() as AppLocale;
  const id = useId().replace(/:/g, "");
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
        onEstimate(response.estimate);
        setStatus("saved");
      } else {
        setOptionIds(previous);
        setStatus({ error: t(`panel.saveErrors.${response.error}`) });
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section id="materiales" aria-labelledby={`${id}-materials`} className="flex min-w-0 flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h3 id={`${id}-materials`} className="text-xl md:text-2xl">
            {t("panel.materialsTitle")}
          </h3>
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
              <h4 id={`${id}-${stage}`} className="text-xl">
                {t("panel.stageHeading", { number: index + 1, stage: t(`stages.${stage}.name`) })}
              </h4>
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

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <EstimateDetails estimate={estimate} />
      </aside>
    </div>
  );
}

/** Paquetes de materiales por etapa, a los que el cliente podrá abonar. */
function MaterialPackages({
  estimate,
  whatsappHref,
}: {
  estimate: ProjectEstimate;
  whatsappHref: string | null;
}) {
  const t = useTranslations("projects");
  const locale = useLocale() as AppLocale;
  return (
    <section id="abonos" className="flex max-w-3xl flex-col gap-3">
      <h3 className="text-xl md:text-2xl">{t("panel.abonos.title")}</h3>
      <p className="text-muted-foreground">{t("panel.abonos.intro")}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
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
          className="inline-flex min-h-11 items-center gap-2 self-start font-bold text-brand underline underline-offset-4"
        >
          <MessageCircle aria-hidden="true" className="size-5" />
          {t("panel.actions.contribute.cta")}
        </a>
      ) : null}
    </section>
  );
}

/** Solicitud al equipo: el botón que la abrió decide si es servicio, prueba de avance o soporte. */
function ProjectRequestForm({ token, kind }: { token: string; kind: ProjectRequestKind }) {
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
          const response = await requestProjectHelp({ locale, token, kind, message: values.get("message") });
          setResult(response.status === "success" ? "sent" : { error: t(`errors.${response.error}`) });
        });
      }}
    >
      {result && typeof result === "object" ? (
        <p role="alert" className="rounded-xl bg-destructive/10 p-4 font-bold text-destructive">
          {result.error}
        </p>
      ) : null}
      <Field id={`${id}-message`} label={t("message")}>
        <Textarea id={`${id}-message`} name="message" maxLength={1000} />
      </Field>
      <Button type="submit" variant="brand" size="lg" disabled={pending} className="self-start">
        {pending ? t("pending") : t("submit")}
      </Button>
    </form>
  );
}
