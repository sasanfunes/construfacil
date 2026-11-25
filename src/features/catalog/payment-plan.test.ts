import { describe, expect, it } from "vitest";

import { suggestedHomePlan } from "./payment-plan";

const sum = (plan: { amountUsdCents: number }[]) => plan.reduce((s, p) => s + p.amountUsdCents, 0);

describe("plan de pagos sugerido", () => {
  it("casa lista: apartado, pago inicial y saldo al firmar la escritura", () => {
    const plan = suggestedHomePlan({ priceUsdCents: 4_650_000, constructionStatus: "ready" }, 20);
    expect(plan.map((p) => p.key)).toEqual(["reservation", "initial", "deed"]);
    expect(plan[0]!.amountUsdCents).toBe(50_000);
    expect(plan[1]!.amountUsdCents).toBe(930_000 - 50_000);
    expect(sum(plan)).toBe(4_650_000);
  });

  it("preventa: agrega pagos durante la obra y siempre suma el precio", () => {
    const plan = suggestedHomePlan({ priceUsdCents: 9_612_345, constructionStatus: "presale" }, 20);
    expect(plan.map((p) => p.key)).toEqual(["reservation", "initial", "construction", "deed"]);
    expect(sum(plan)).toBe(9_612_345);
    for (const p of plan) expect(p.amountUsdCents).toBeGreaterThanOrEqual(0);
  });
});
