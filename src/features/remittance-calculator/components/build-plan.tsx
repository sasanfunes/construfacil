"use client";

import { useLocale, useTranslations } from "next-intl";

import { Field, Input } from "@/components/ui/field";
import type { AppLocale } from "@/i18n/routing";
import { formatUsd } from "@/lib/money";

import { splitMonths, type BuildPlan } from "../engine";

/**
 * Piezas que comparten la calculadora pública y la del panel del proyecto: los campos de
 * ahorro y el resultado de una obra por etapas.
 */

export const MIN_MONTHLY = 50;
export const MAX_MONTHLY = 5_000;

/** Meses en palabras: "2 años y 3 meses". */
export function useTimeText() {
  const t = useTranslations("calculator");
  return (months: number) => {
    const { years, months: rest } = splitMonths(months);
    if (years === 0) return t("time.months", { count: rest });
    if (rest === 0) return t("time.years", { count: years });
    return t("time.yearsMonths", { years, months: rest });
  };
}

/** Cuánto aparta cada mes (número y barra) y cuánto tiene ahorrado. */
export function SavingsFields({
  id,
  monthly,
  savings,
  onMonthly,
  onSavings,
}: {
  id: string;
  monthly: number;
  savings: number;
  onMonthly: (dollars: number) => void;
  onSavings: (dollars: number) => void;
}) {
  const t = useTranslations("calculator");
  return (
    <>
      <Field id={`${id}-monthly`} label={t("monthly")} hint={t("monthlyHint")}>
        <Input
          id={`${id}-monthly`}
          type="number"
          inputMode="numeric"
          min={MIN_MONTHLY}
          max={MAX_MONTHLY}
          step={50}
          value={monthly}
          aria-describedby={`${id}-monthly-hint`}
          onChange={(e) => onMonthly(Math.min(MAX_MONTHLY, Math.max(0, Number(e.currentTarget.value) || 0)))}
        />
        <input
          type="range"
          min={MIN_MONTHLY}
          max={2_000}
          step={50}
          value={Math.min(monthly, 2_000)}
          aria-label={t("monthly")}
          onChange={(e) => onMonthly(Number(e.currentTarget.value))}
          className="h-11 w-full accent-[var(--primary)]"
        />
      </Field>
      <Field id={`${id}-savings`} label={t("savings")}>
        <Input
          id={`${id}-savings`}
          type="number"
          inputMode="numeric"
          min={0}
          step={500}
          value={savings || ""}
          onChange={(e) => onSavings(Math.max(0, Number(e.currentTarget.value) || 0))}
        />
      </Field>
    </>
  );
}

/** Cuándo empieza y termina la obra, si se detiene, y la línea de tiempo de cada etapa. */
export function BuildPlanResult({
  plan,
  noPause,
  stageNames,
}: {
  plan: BuildPlan;
  /** Lo mínimo al mes para que la obra no se detenga, en centavos. */
  noPause: number | null;
  stageNames: Record<string, string>;
}) {
  const t = useTranslations("calculator");
  const locale = useLocale() as AppLocale;
  const time = useTimeText();
  const finish = Math.max(plan.finishMonth, 1);

  return (
    <>
      <p className="font-display text-2xl leading-snug font-semibold md:text-3xl">
        {plan.startMonth === 0 ? t("result.startNow") : t("result.startIn", { time: time(plan.startMonth) })}{" "}
        {t("result.finishIn", { time: time(plan.finishMonth) })}
      </p>
      <p className="text-muted-foreground">
        {plan.waitingMonths >= 1
          ? t("result.waiting", { time: time(Math.round(plan.waitingMonths)) })
          : t("result.noWaiting")}
      </p>
      {plan.waitingMonths >= 1 && noPause ? (
        <p className="rounded-xl bg-accent p-3 font-bold">
          {t("result.noPauseWith", { amount: formatUsd(noPause, locale) })}
        </p>
      ) : null}
      <div className="flex flex-col gap-3">
        <p className="font-bold">{t("result.timelineTitle")}</p>
        <ol className="flex flex-col gap-2">
          {plan.stages.map((stage) => {
            const left = (stage.startMonth / finish) * 100;
            const width = Math.max(((stage.endMonth - stage.startMonth) / finish) * 100, 2);
            return (
              <li key={stage.key} className="flex flex-col gap-1">
                <span className="text-sm">
                  {t("result.timelineStage", {
                    stage: stageNames[stage.key] ?? stage.key,
                    start: Math.floor(stage.startMonth) + 1,
                    end: Math.max(Math.ceil(stage.endMonth), Math.floor(stage.startMonth) + 1),
                  })}
                </span>
                <span className="relative block h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <span
                    className="absolute inset-y-0 rounded-full bg-brand"
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
