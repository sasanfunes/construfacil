import { describe, expect, it } from "vitest";

import { formatDate, formatLongDate, formatMonthYear, formatNumber } from "./format";

describe("formatos", () => {
  it("fechas en ambos idiomas, sin correrse de día", () => {
    expect(formatLongDate("2026-11-27", "es")).toBe("viernes 27 de noviembre de 2026");
    expect(formatLongDate("2026-11-27", "en")).toBe("Friday, November 27, 2026");
    expect(formatDate("2027-01-01", "es")).toBe("1 de enero de 2027");
    expect(formatMonthYear("2027-04-30", "en")).toBe("April 2027");
  });

  it("números con coma de miles", () => {
    expect(formatNumber(1285000, "es")).toBe("1,285,000");
    expect(formatNumber(286.2, "en", 1)).toBe("286.2");
  });
});
