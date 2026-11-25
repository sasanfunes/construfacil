import { describe, expect, it } from "vitest";

import { pricingRulesFrom } from "@/features/catalog/catalog";
import { SAMPLE_CATALOG } from "@/features/catalog/sample";
import { calculateQuote } from "@/features/quote/engine";

import { monthlyToNeverPause, planBuild, planPurchase, splitMonths } from "./engine";

const rules = pricingRulesFrom(SAMPLE_CATALOG);
const covered = new Set(rules.stages.filter((s) => s.coveredByInitialPayment).map((s) => s.key));
const copan = calculateQuote(
  {
    landStatus: "own",
    lotId: null,
    departmentId: 5,
    municipalityId: null,
    landAreaM2: 200,
    design: { kind: "model", modelId: "c3000000-0000-4000-8000-000000000002" },
    finishLevelId: "d4000000-0000-4000-8000-000000000002",
    extras: [],
  },
  rules,
); // $43,800; pago inicial $8,760; 22 semanas

const usd = (dollars: number) => dollars * 100;

describe("planBuild", () => {
  it("con ahorro de sobra, la obra empieza ya y no espera", () => {
    const plan = planBuild(copan, covered, {
      monthlyUsdCents: usd(10_000),
      initialSavingsUsdCents: usd(50_000),
    })!;
    expect(plan.startMonth).toBe(0);
    expect(plan.waitingMonths).toBe(0);
    expect(plan.finishMonth).toBe(Math.ceil((22 * 12) / 52)); // 5.08 → 6
  });

  it("con $500 al mes, empieza cuando junta el pago inicial", () => {
    const plan = planBuild(copan, covered, { monthlyUsdCents: usd(500), initialSavingsUsdCents: 0 })!;
    expect(plan.startMonth).toBe(Math.ceil(8_760 / 500)); // 18
    // Sin financiamiento, termina cuando junta el total.
    expect(plan.finishMonth).toBeGreaterThanOrEqual(Math.ceil(43_800 / 500));
    expect(plan.waitingMonths).toBeGreaterThan(0);
  });

  it("el ahorro inicial adelanta el arranque", () => {
    const without = planBuild(copan, covered, { monthlyUsdCents: usd(800), initialSavingsUsdCents: 0 })!;
    const withSavings = planBuild(copan, covered, {
      monthlyUsdCents: usd(800),
      initialSavingsUsdCents: usd(5_000),
    })!;
    expect(withSavings.startMonth).toBeLessThan(without.startMonth);
    expect(withSavings.finishMonth).toBeLessThan(without.finishMonth);
  });

  it("más ahorro mensual nunca hace que termine más tarde", () => {
    let previous = Infinity;
    for (const monthly of [300, 500, 800, 1_200, 2_000, 5_000]) {
      const plan = planBuild(copan, covered, { monthlyUsdCents: usd(monthly), initialSavingsUsdCents: 0 })!;
      expect(plan.finishMonth).toBeLessThanOrEqual(previous);
      previous = plan.finishMonth;
    }
  });

  it("las etapas van en orden y ninguna empieza antes de que termine la anterior", () => {
    const plan = planBuild(copan, covered, { monthlyUsdCents: usd(700), initialSavingsUsdCents: 0 })!;
    plan.stages.forEach((stage, index) => {
      expect(stage.endMonth).toBeGreaterThan(stage.startMonth);
      if (index > 0) expect(stage.startMonth).toBeGreaterThanOrEqual(plan.stages[index - 1]!.endMonth);
    });
  });

  it("sin ahorro mensual ni inicial, no hay plan", () => {
    expect(planBuild(copan, covered, { monthlyUsdCents: 0, initialSavingsUsdCents: 0 })).toBeNull();
  });

  it("más de 50 años no es un plan", () => {
    expect(planBuild(copan, covered, { monthlyUsdCents: usd(5), initialSavingsUsdCents: 0 })).toBeNull();
  });

  it("rechaza montos negativos", () => {
    expect(() => planBuild(copan, covered, { monthlyUsdCents: -1, initialSavingsUsdCents: 0 })).toThrow(
      RangeError,
    );
  });
});

describe("planPurchase", () => {
  it("cuenta los meses para juntar el precio", () => {
    expect(planPurchase(usd(12_800), { monthlyUsdCents: usd(500), initialSavingsUsdCents: 0 })).toEqual({
      kind: "purchase",
      months: 26,
    });
    expect(
      planPurchase(usd(12_800), { monthlyUsdCents: usd(500), initialSavingsUsdCents: usd(13_000) }),
    ).toEqual({
      kind: "purchase",
      months: 0,
    });
    expect(planPurchase(usd(12_800), { monthlyUsdCents: 0, initialSavingsUsdCents: 0 })).toBeNull();
  });
});

describe("splitMonths", () => {
  it("separa años y meses", () => {
    expect(splitMonths(26)).toEqual({ years: 2, months: 2 });
    expect(splitMonths(11)).toEqual({ years: 0, months: 11 });
    expect(splitMonths(24)).toEqual({ years: 2, months: 0 });
  });
});

describe("monthlyToNeverPause", () => {
  it("con ese monto la obra no se detiene, y con $10 menos sí", () => {
    const amount = monthlyToNeverPause(copan, covered, 0)!;
    expect(amount % 1000).toBe(0);
    expect(
      planBuild(copan, covered, { monthlyUsdCents: amount, initialSavingsUsdCents: 0 })!.waitingMonths,
    ).toBeLessThanOrEqual(0.01);
    expect(
      planBuild(copan, covered, { monthlyUsdCents: amount - 2_000, initialSavingsUsdCents: 0 })!
        .waitingMonths,
    ).toBeGreaterThan(0.01);
  });

  it("con ahorro suficiente no hace falta casi nada", () => {
    expect(monthlyToNeverPause(copan, covered, usd(50_000))).toBe(1_000);
  });
});
