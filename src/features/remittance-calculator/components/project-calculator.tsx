"use client";

import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";

import { PRELIMINARY_STAGE } from "@/features/projects/types";
import { cn } from "@/lib/utils";

import { monthlyToNeverPause, planBuild, type StagedPlan } from "../engine";

import { BuildPlanResult, SavingsFields } from "./build-plan";

/** El pago inicial cubre diseño y trámites. */
const COVERED_BY_INITIAL: ReadonlySet<string> = new Set([PRELIMINARY_STAGE]);

/**
 * Calculadora dentro del panel: con lo que el cliente aparta cada mes, cuándo empieza y
 * cuándo termina SU proyecto (sus etapas y su plan de pagos, no un modelo de referencia).
 */
export function ProjectCalculator({
  plan,
  stageNames,
  className,
}: {
  plan: StagedPlan;
  stageNames: Record<string, string>;
  className?: string;
}) {
  const t = useTranslations("calculator");
  const id = useId().replace(/:/g, "");
  const [monthly, setMonthly] = useState(500);
  const [savings, setSavings] = useState(0);

  const result = useMemo(
    () =>
      planBuild(plan, COVERED_BY_INITIAL, {
        monthlyUsdCents: monthly * 100,
        initialSavingsUsdCents: savings * 100,
      }),
    [plan, monthly, savings],
  );
  const noPause = useMemo(
    () => monthlyToNeverPause(plan, COVERED_BY_INITIAL, savings * 100),
    [plan, savings],
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
          onMonthly={setMonthly}
          onSavings={setSavings}
        />
      </form>
      <div className="flex min-w-0 flex-col gap-5" aria-live="polite">
        {result ? (
          <BuildPlanResult plan={result} noPause={noPause} stageNames={stageNames} />
        ) : (
          <p className="rounded-2xl bg-accent p-4">{t("result.tooLong")}</p>
        )}
        <p className="border-t pt-4 text-sm text-muted-foreground">{t("disclaimer")}</p>
      </div>
    </div>
  );
}
