import { weeksToMonths } from "@/lib/units";

import type { ProjectEstimate } from "@/features/projects/types";

/** Plan por etapas: costo, tiempo y pagos de cada etapa (sale del motor de proyectos). */
export type StagedPlan = Pick<ProjectEstimate, "payments" | "stages">;

/**
 * Calculadora "De remesa a patrimonio".
 *
 * Con el modelo por etapas no hay financiamiento: el cliente paga con lo que ahorra. La
 * pregunta es: con lo que puedo apartar cada mes, ¿cuándo empiezo y cuándo termino?
 *
 * - Construir: la obra empieza cuando el ahorro cubre el pago inicial. Cada etapa empieza
 *   cuando terminó la anterior Y el ahorro ya cubre su pago. Si el dinero no alcanza, la
 *   obra espera (y eso se muestra).
 * - Comprar una casa lista o un terreno: sin financiamiento, hay que juntar el precio.
 *
 * El tiempo es continuo y en meses; el resultado se redondea hacia arriba.
 */

export const MAX_MONTHS = 600; // 50 años: más que eso no es un plan.

export type BuildPlanStage = { key: string; startMonth: number; endMonth: number; waitedMonths: number };

export type BuildPlan = {
  kind: "build";
  /** Mes en que empieza la obra (pago inicial cubierto). */
  startMonth: number;
  /** Mes en que se entrega la casa. */
  finishMonth: number;
  /** Meses de obra si el dinero nunca faltara. */
  constructionMonths: number;
  /** Meses en que la obra estuvo detenida esperando el ahorro. */
  waitingMonths: number;
  stages: BuildPlanStage[];
};

export type PurchasePlan = { kind: "purchase"; months: number };

export type SavingsInput = { monthlyUsdCents: number; initialSavingsUsdCents: number };

function assertSavings({ monthlyUsdCents, initialSavingsUsdCents }: SavingsInput) {
  if (!Number.isFinite(monthlyUsdCents) || monthlyUsdCents < 0)
    throw new RangeError("Ahorro mensual inválido");
  if (!Number.isFinite(initialSavingsUsdCents) || initialSavingsUsdCents < 0) {
    throw new RangeError("Ahorro inicial inválido");
  }
}

/** Mes (continuo) en que el ahorro acumulado llega a `neededUsdCents`. `null` si nunca. */
function monthWhenAffordable(
  neededUsdCents: number,
  { monthlyUsdCents, initialSavingsUsdCents }: SavingsInput,
) {
  if (initialSavingsUsdCents >= neededUsdCents) return 0;
  if (monthlyUsdCents === 0) return null;
  return (neededUsdCents - initialSavingsUsdCents) / monthlyUsdCents;
}

export function planPurchase(priceUsdCents: number, savings: SavingsInput): PurchasePlan | null {
  assertSavings(savings);
  const month = monthWhenAffordable(priceUsdCents, savings);
  if (month === null || month > MAX_MONTHS) return null;
  return { kind: "purchase", months: Math.ceil(month) };
}

export function planBuild(
  quote: StagedPlan,
  coveredByInitial: ReadonlySet<string>,
  savings: SavingsInput,
): BuildPlan | null {
  assertSavings(savings);

  const paymentForStage = new Map(
    quote.payments
      .filter((p) => p.kind === "stage" && p.stageKey)
      .map((p) => [p.stageKey!, p.amountUsdCents]),
  );
  const initial = quote.payments.find((p) => p.kind === "initial")?.amountUsdCents ?? 0;

  let needed = initial;
  const initialMonth = monthWhenAffordable(needed, savings);
  if (initialMonth === null) return null;

  let previousEnd = 0;
  let waitingMonths = 0;
  const stages: BuildPlanStage[] = [];

  for (const [index, stage] of quote.stages.entries()) {
    if (!coveredByInitial.has(stage.key)) needed += paymentForStage.get(stage.key) ?? 0;
    const affordable = monthWhenAffordable(needed, savings);
    if (affordable === null) return null;

    const ready = index === 0 ? initialMonth : previousEnd;
    const start = Math.max(ready, affordable, initialMonth);
    if (index > 0) waitingMonths += start - previousEnd;
    const end = start + weeksToMonths(stage.weeks);
    stages.push({
      key: stage.key,
      startMonth: start,
      endMonth: end,
      waitedMonths: index > 0 ? start - previousEnd : 0,
    });
    previousEnd = end;
  }

  if (previousEnd > MAX_MONTHS) return null;

  return {
    kind: "build",
    startMonth: Math.ceil(initialMonth),
    finishMonth: Math.ceil(previousEnd),
    constructionMonths: weeksToMonths(quote.stages.reduce((sum, s) => sum + s.weeks, 0)),
    waitingMonths,
    stages,
  };
}

/** "26 meses" → { years: 2, months: 2 } para mostrarlo en palabras. */
export function splitMonths(totalMonths: number): { years: number; months: number } {
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 };
}

/**
 * Lo mínimo que hay que apartar al mes (redondeado a $10) para que la obra, una vez
 * empezada, no se detenga nunca esperando el siguiente pago. `null` si ni con $20,000 al
 * mes se logra.
 */
export function monthlyToNeverPause(
  quote: StagedPlan,
  coveredByInitial: ReadonlySet<string>,
  initialSavingsUsdCents: number,
): number | null {
  const pauses = (dollars: number) =>
    (planBuild(quote, coveredByInitial, { monthlyUsdCents: dollars * 100, initialSavingsUsdCents })
      ?.waitingMonths ?? Infinity) > 0.01;
  let low = 10;
  let high = 20_000;
  if (pauses(high)) return null;
  if (!pauses(low)) return low * 100;
  while (high - low > 10) {
    const middle = Math.floor((low + high) / 2);
    if (pauses(middle)) low = middle;
    else high = middle;
  }
  return Math.ceil(high / 10) * 10 * 100;
}
