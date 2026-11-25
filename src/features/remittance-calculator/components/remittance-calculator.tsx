"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { trackFunnelEvent } from "@/features/funnel/actions";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

import type { CalculatorData } from "../data";
import { monthlyToNeverPause, planBuild, planPurchase } from "../engine";

import { BuildPlanResult, SavingsFields, useTimeText } from "./build-plan";

type Goal = "build" | "land" | "home";

/**
 * Calculadora "De remesa a patrimonio". Funciona en el navegador con datos que el
 * servidor ya calculó con las reglas de la base, así responde al instante.
 */
export function RemittanceCalculator({ data, className }: { data: CalculatorData; className?: string }) {
  const t = useTranslations("calculator");
  const locale = useLocale() as AppLocale;
  const id = useId().replace(/:/g, "");
  const [monthly, setMonthly] = useState(500);
  const [savings, setSavings] = useState(0);
  const [goal, setGoal] = useState<Goal>("build");
  const [modelId, setModelId] = useState(data.models[1]?.id ?? data.models[0]?.id ?? "");
  const tracked = useRef(false);

  const touch = () => {
    if (tracked.current) return;
    tracked.current = true;
    let sessionId: string;
    try {
      sessionId = sessionStorage.getItem("construfacil.funnel-session") ?? crypto.randomUUID();
      sessionStorage.setItem("construfacil.funnel-session", sessionId);
    } catch {
      sessionId = crypto.randomUUID();
    }
    void trackFunnelEvent({ event: "calculator_used", step: null, sessionId, locale });
  };

  const time = useTimeText();

  const model = data.models.find((m) => m.id === modelId) ?? data.models[0];
  const savingsInput = { monthlyUsdCents: monthly * 100, initialSavingsUsdCents: savings * 100 };

  const outcome = useMemo(() => {
    if (goal === "build" && model) {
      return {
        kind: "build" as const,
        plan: planBuild(model.quote, new Set(data.coveredByInitial), savingsInput),
      };
    }
    const price = goal === "land" ? data.typicalLotUsdCents : data.typicalHomeUsdCents;
    return { kind: "purchase" as const, price, plan: price ? planPurchase(price, savingsInput) : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, model, monthly, savings, data]);

  const noPause = useMemo(
    () =>
      goal === "build" && model
        ? monthlyToNeverPause(model.quote, new Set<string>(data.coveredByInitial), savings * 100)
        : null,
    [goal, model, savings, data],
  );

  return (
    <div className={cn("grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]", className)}>
      <form
        className="flex flex-col gap-5 rounded-2xl border bg-card p-5"
        onSubmit={(e) => e.preventDefault()}
      >
        <SavingsFields
          id={id}
          monthly={monthly}
          savings={savings}
          onMonthly={(dollars) => {
            touch();
            setMonthly(dollars);
          }}
          onSavings={(dollars) => {
            touch();
            setSavings(dollars);
          }}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-bold">{t("goal")}</legend>
          {(["build", "land", "home"] as const).map((option) => (
            <label
              key={option}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 font-bold has-[:checked]:border-brand has-[:checked]:bg-accent"
            >
              <input
                type="radio"
                name={`${id}-goal`}
                checked={goal === option}
                onChange={() => {
                  touch();
                  setGoal(option);
                }}
                className="size-5 accent-[var(--brand)]"
              />
              {t(`goals.${option}`)}
            </label>
          ))}
        </fieldset>
        {goal === "build" && data.models.length > 0 ? (
          <Field id={`${id}-model`} label={t("model")}>
            <Select id={`${id}-model`} value={modelId} onChange={(e) => setModelId(e.currentTarget.value)}>
              {data.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {t("modelOption", {
                    name: m.name[locale],
                    price: formatUsd(m.quote.totalUsdCents, locale),
                  })}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </form>

      <div className="flex min-w-0 flex-col gap-5" aria-live="polite">
        {outcome.kind === "build" ? (
          outcome.plan ? (
            <>
              <BuildPlanResult plan={outcome.plan} noPause={noPause} stageNames={data.stageNames} />
              {model ? (
                <Button asChild size="lg" className="self-start">
                  <Link href={{ pathname: "/build/new", query: { model: model.slug } }}>
                    {t("result.ctaBuild")}
                  </Link>
                </Button>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {t("referenceNote", { department: data.referenceDepartment })}
              </p>
            </>
          ) : (
            <p className="rounded-2xl bg-accent p-4">{t("result.tooLong")}</p>
          )
        ) : outcome.plan ? (
          <>
            <p className="font-display text-2xl leading-snug font-semibold md:text-3xl">
              {outcome.plan.months === 0
                ? t("result.purchaseNow")
                : t("result.purchaseIn", { time: time(outcome.plan.months) })}
            </p>
            {outcome.price ? (
              <p className="text-muted-foreground">
                {goal === "land"
                  ? t("landNote", { price: formatUsd(outcome.price, locale) })
                  : t("homeNote", { price: formatUsd(outcome.price, locale) })}
              </p>
            ) : null}
            <Button asChild size="lg" className="self-start">
              <Link href={goal === "land" ? { pathname: "/build/new", query: { land: "buy" } } : "/homes"}>
                {goal === "land" ? t("result.ctaLand") : t("result.ctaHome")}
              </Link>
            </Button>
          </>
        ) : (
          <p className="rounded-2xl bg-accent p-4">{t("result.tooLong")}</p>
        )}
        <p className="border-t pt-4 text-sm text-muted-foreground">{t("disclaimer")}</p>
      </div>
    </div>
  );
}
