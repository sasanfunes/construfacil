import { describe, expect, it } from "vitest";

import { dollarsToCents, formatHnlApprox, formatUsd, roundHnlForDisplay, usdCentsToHnl } from "./index";

describe("formatUsd", () => {
  it("escribe dólares cerrados sin decimales y con coma de miles, en ambos idiomas", () => {
    expect(formatUsd(4_850_000, "es")).toBe("$48,500");
    expect(formatUsd(4_850_000, "en")).toBe("$48,500");
    expect(formatUsd(120_000, "es")).toBe("$1,200");
  });

  it("muestra los centavos cuando existen", () => {
    expect(formatUsd(123_450, "es")).toBe("$1,234.50");
    expect(formatUsd(99, "en")).toBe("$0.99");
  });

  it("maneja cero y negativos (reembolsos)", () => {
    expect(formatUsd(0)).toBe("$0");
    expect(formatUsd(-50_000)).toBe("-$500");
  });

  it("rechaza montos que no son centavos enteros", () => {
    expect(() => formatUsd(48_500.5)).toThrow(TypeError);
    expect(() => formatUsd(Number.NaN)).toThrow(TypeError);
  });
});

describe("lempiras", () => {
  it("convierte con la tasa de referencia", () => {
    expect(usdCentsToHnl(4_850_000, 26.5)).toBe(1_285_250);
    expect(usdCentsToHnl(100, 26.5)).toBe(27);
  });

  it("rechaza tasas inválidas", () => {
    expect(() => usdCentsToHnl(100, 0)).toThrow(RangeError);
    expect(() => usdCentsToHnl(100, Number.NaN)).toThrow(RangeError);
  });

  it("redondea para no dar una precisión falsa", () => {
    expect(roundHnlForDisplay(1_285_250)).toBe(1_285_000);
    expect(roundHnlForDisplay(31_827)).toBe(31_800);
    expect(roundHnlForDisplay(2_653)).toBe(2_650);
    expect(roundHnlForDisplay(27)).toBe(27);
  });

  it("formatea el equivalente aproximado", () => {
    expect(formatHnlApprox(4_850_000, 26.5, "es")).toBe("L 1,285,000");
    expect(formatHnlApprox(4_850_000, 26.5, "en")).toBe("L 1,285,000");
  });
});

describe("dollarsToCents", () => {
  it("evita errores de punto flotante", () => {
    expect(dollarsToCents(19.99)).toBe(1999);
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
  });
});
