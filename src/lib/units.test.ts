import { describe, expect, it } from "vitest";

import { squareMetersToVaras, squareVarasToMeters, weeksToMonths } from "./units";

describe("unidades", () => {
  it("convierte metros cuadrados a varas cuadradas (1 m² ≈ 1.431 v²)", () => {
    expect(squareMetersToVaras(1)).toBeCloseTo(1.4312, 3);
    expect(Math.round(squareMetersToVaras(209.6))).toBe(300);
  });

  it("ida y vuelta", () => {
    expect(squareVarasToMeters(squareMetersToVaras(450))).toBeCloseTo(450, 8);
  });

  it("semanas a meses", () => {
    expect(weeksToMonths(52)).toBe(12);
    expect(weeksToMonths(26)).toBe(6);
  });
});
