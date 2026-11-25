import { CalendarClock, CircleAlert, HandCoins, Package } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Price, Usd } from "@/components/shared/price";
import { Term } from "@/components/shared/term";
import type { AppLocale } from "@/i18n/routing";
import { formatUsd } from "@/lib/money";
import { weeksToMonths } from "@/lib/units";
import { cn } from "@/lib/utils";

import type { ProjectEstimate } from "../types";

/**
 * Resumen del costo de un proyecto: total, tiempo, costo de cada etapa (materiales y mano
 * de obra) y plan de pagos. Sin estado propio. El onboarding lo usa entero; el panel pone el
 * total junto al nombre del proyecto y el detalle junto a los materiales.
 */
export function EstimateSummary({
  estimate,
  usdToHnl,
  className,
}: {
  estimate: ProjectEstimate;
  usdToHnl: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-8", className)}>
      <EstimateTotal estimate={estimate} usdToHnl={usdToHnl} />
      <EstimateWarnings estimate={estimate} />
      <EstimateDetails estimate={estimate} />
    </div>
  );
}

/** El cuadro azul: total, terreno aparte y tiempo. */
export function EstimateTotal({
  estimate,
  usdToHnl,
  className,
}: {
  estimate: ProjectEstimate;
  usdToHnl: number;
  className?: string;
}) {
  const t = useTranslations("projects");
  const locale = useLocale() as AppLocale;
  const months = Math.max(1, Math.round(weeksToMonths(estimate.durationWeeks)));

  return (
    <div
      className={cn("on-brand flex flex-col gap-5 rounded-2xl bg-brand p-6 text-brand-foreground", className)}
    >
      <div className="flex flex-col gap-1">
        <span className="font-bold text-brand-muted">{t("summary.total")}</span>
        <Price usdCents={estimate.totalUsdCents} usdToHnl={usdToHnl} size="lg" onBrand />
      </div>
      {estimate.lotPriceUsdCents ? (
        <div className="flex flex-col gap-1 border-t border-white/15 pt-4">
          <span className="font-bold text-brand-muted">{t("summary.lot")}</span>
          <Usd usdCents={estimate.lotPriceUsdCents} className="text-xl font-bold" />
          <span className="text-sm text-brand-muted">
            {t("summary.grandTotal", { amount: formatUsd(estimate.grandTotalUsdCents, locale) })}
          </span>
        </div>
      ) : null}
      <p className="flex items-center gap-3 border-t border-white/15 pt-4">
        <CalendarClock aria-hidden="true" className="size-6 shrink-0" />
        <span className="flex flex-col">
          <span className="text-sm text-brand-muted">{t("summary.duration")}</span>
          <span className="font-bold">
            {t("summary.durationValue", {
              weeks: t("summary.weeks", { count: estimate.durationWeeks }),
              months: t("summary.months", { count: months }),
            })}
          </span>
        </span>
      </p>
    </div>
  );
}

/** Avisos que no bloquean (p. ej. terreno más chico que el mínimo del modelo). */
export function EstimateWarnings({ estimate }: { estimate: ProjectEstimate }) {
  const t = useTranslations("projects");
  if (estimate.warnings.length === 0) return null;
  return (
    <>
      {estimate.warnings.map((warning) => (
        <p key={warning} className="flex gap-3 rounded-2xl bg-accent p-4">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
          {t(`summary.warnings.${warning}`)}
        </p>
      ))}
    </>
  );
}

/** Costo y tiempo de cada etapa, plan de pagos y la nota de que es un estimado. */
export function EstimateDetails({ estimate, className }: { estimate: ProjectEstimate; className?: string }) {
  const t = useTranslations("projects");
  const locale = useLocale() as AppLocale;
  const stageName = (key: ProjectEstimate["stages"][number]["key"]) => t(`stages.${key}.name`);

  return (
    <div className={cn("flex flex-col gap-8", className)}>
      <section className="flex flex-col gap-3">
        <h3 className="text-xl">{t("summary.stagesTitle")}</h3>
        <ol className="flex flex-col gap-3">
          {estimate.stages.map((stage) => (
            <li key={stage.key} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-lg font-bold">
                  {stage.key === "grey_work" ? (
                    <Term term="obraGris">{stageName(stage.key)}</Term>
                  ) : (
                    stageName(stage.key)
                  )}
                </span>
                <Usd usdCents={stage.costUsdCents} className="text-lg font-bold" />
              </div>
              <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span>{t("summary.stageWeeks", { count: stage.weeks })}</span>
                {stage.materialsUsdCents > 0 ? (
                  <>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Package aria-hidden="true" className="size-4" />
                      {t("summary.materialsAmount", { amount: formatUsd(stage.materialsUsdCents, locale) })}
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <HandCoins aria-hidden="true" className="size-4" />
                      {t("summary.laborAmount", { amount: formatUsd(stage.laborUsdCents, locale) })}
                    </span>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xl">{t("summary.paymentsTitle")}</h3>
        <p className="text-muted-foreground">{t("summary.paymentsIntro")}</p>
        <ol className="flex flex-col gap-2">
          {estimate.payments.map((payment, index) => (
            <li key={payment.stageKey} className="flex items-start gap-3 rounded-2xl border bg-card p-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-foreground">
                {index + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-bold">
                    {payment.kind === "initial" ? t("summary.paymentInitial") : stageName(payment.stageKey)}
                  </span>
                  <Usd usdCents={payment.amountUsdCents} className="font-bold" />
                </span>
                <span className="text-sm text-muted-foreground">
                  {payment.afterStageKey
                    ? t("summary.whenStage", { previous: stageName(payment.afterStageKey) })
                    : t("summary.whenInitial")}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <p className="text-sm text-muted-foreground">{t("summary.disclaimer")}</p>
    </div>
  );
}
