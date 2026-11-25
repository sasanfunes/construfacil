import { CalendarClock, Hammer, HandCoins, Info, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Price, Usd } from "@/components/shared/price";
import { Term } from "@/components/shared/term";
import type { AppLocale } from "@/i18n/routing";
import { formatUsd } from "@/lib/money";
import { weeksToMonths } from "@/lib/units";

import type { QuoteExtra, QuoteResult, StageTemplate } from "../types";

/**
 * Resultado de una cotización: total, desglose por etapas, tiempo y plan de pagos.
 * Lo usan el cotizador (en vivo) y el enlace privado (la foto guardada).
 */
export function QuoteResultView({
  result,
  stages,
  extras,
  usdToHnl,
}: {
  result: QuoteResult;
  stages: readonly StageTemplate[];
  extras: readonly QuoteExtra[];
  usdToHnl: number;
}) {
  const t = useTranslations("quote.result");
  const tu = useTranslations("common.units");
  const locale = useLocale() as AppLocale;
  const stageName = (key: string | null) =>
    key ? (stages.find((s) => s.key === key)?.name[locale] ?? key) : "";
  const months = Math.ceil(weeksToMonths(result.durationWeeks));
  const maxCost = Math.max(...result.stages.map((s) => s.costUsdCents), 1);

  return (
    <div className="flex flex-col gap-8">
      <section className="on-brand grid gap-6 rounded-3xl bg-brand p-6 text-brand-foreground sm:grid-cols-2 md:p-8">
        <div className="flex flex-col gap-1">
          <p className="font-bold text-brand-muted">{t("houseTotal")}</p>
          <Price usdCents={result.totalUsdCents} usdToHnl={usdToHnl} size="lg" onBrand />
        </div>
        <dl className="grid gap-4">
          <div className="flex items-start gap-3">
            <HandCoins aria-hidden="true" className="mt-1 size-6 shrink-0" />
            <div>
              <dt className="text-sm text-brand-muted">
                {t("initialPayment", { percent: result.initialPaymentPercent })}
              </dt>
              <dd className="text-xl font-bold">
                <Usd usdCents={result.payments[0]?.amountUsdCents ?? 0} />
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CalendarClock aria-hidden="true" className="mt-1 size-6 shrink-0" />
            <div>
              <dt className="text-sm text-brand-muted">{t("duration")}</dt>
              <dd className="text-xl font-bold">
                {tu("weeks", { count: result.durationWeeks })}
                <span className="ml-2 text-base font-normal text-brand-muted">
                  {t("approxMonths", { count: months })}
                </span>
              </dd>
            </div>
          </div>
          {result.lotPriceUsdCents !== null ? (
            <div className="flex items-start gap-3">
              <Hammer aria-hidden="true" className="mt-1 size-6 shrink-0" />
              <div>
                <dt className="text-sm text-brand-muted">{t("lotPrice")}</dt>
                <dd className="text-xl font-bold">
                  <Usd usdCents={result.lotPriceUsdCents} />
                </dd>
                <dd className="text-sm text-brand-muted">
                  {t("projectTotal", { amount: formatUsd(result.grandTotalUsdCents, locale) })}
                </dd>
              </div>
            </div>
          ) : null}
        </dl>
      </section>

      {result.warnings.includes("lot_smaller_than_model_minimum") ? (
        <p className="flex items-start gap-3 rounded-2xl bg-accent p-4">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
          {t("warnings.lotTooSmall")}
        </p>
      ) : null}

      <section aria-labelledby="quote-payments" className="flex flex-col gap-4">
        <h3 id="quote-payments" className="text-2xl">
          {t("paymentsTitle")}
        </h3>
        <p className="max-w-prose text-muted-foreground">
          {t.rich("paymentsIntro", { term: () => <Term term="pagoInicial" /> })}
        </p>
        <ol className="flex flex-col gap-3">
          {result.payments.map((payment, index) => (
            <li
              key={`${payment.kind}-${payment.stageKey ?? "initial"}`}
              className="flex items-start gap-4 rounded-xl border bg-card p-4"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-brand-foreground">
                {index + 1}
              </span>
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-bold">
                    {payment.kind === "initial"
                      ? t("paymentInitial")
                      : t("paymentStage", { stage: stageName(payment.stageKey) })}
                  </span>
                  <Usd usdCents={payment.amountUsdCents} className="text-lg font-bold" />
                </div>
                <span className="text-sm text-muted-foreground">
                  {payment.kind === "initial"
                    ? t("whenInitial")
                    : t("whenStage", { previous: stageName(payment.afterStageKey) })}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="quote-stages" className="flex flex-col gap-4">
        <h3 id="quote-stages" className="text-2xl">
          {t("stagesTitle")}
        </h3>
        <ul className="flex flex-col gap-3">
          {result.stages.map((stage) => (
            <li key={stage.key} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-bold">{stageName(stage.key)}</span>
                <span className="flex gap-3 text-sm text-muted-foreground tabular-nums">
                  <Usd usdCents={stage.costUsdCents} className="font-bold text-foreground" />
                  <span>{tu("weeks", { count: stage.weeks })}</span>
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${Math.max(4, (stage.costUsdCents / maxCost) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          {t.rich("stagesNote", { term: () => <Term term="obraGris" /> })}
        </p>
      </section>

      {result.extras.length > 0 ? (
        <section aria-labelledby="quote-extras" className="flex flex-col gap-3">
          <h3 id="quote-extras" className="text-2xl">
            {t("extrasTitle")}
          </h3>
          <ul className="flex flex-col gap-2">
            {result.extras.map((line) => (
              <li key={line.extraId} className="flex flex-wrap justify-between gap-2 border-b py-2">
                <span>
                  {extras.find((e) => e.id === line.extraId)?.name[locale] ?? line.key}
                  {line.quantity > 1 ? (
                    <span className="ml-2 text-muted-foreground">
                      {t("quantity", { count: line.quantity })}
                    </span>
                  ) : null}
                </span>
                <Usd usdCents={line.totalUsdCents} className="font-bold" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="flex items-start gap-3 rounded-2xl bg-muted/60 p-4 text-sm">
        <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand" />
        {t("disclaimer")}
      </p>
    </div>
  );
}
