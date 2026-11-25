import { describe, expect, it } from "vitest";

import { pricingRulesFrom } from "@/features/catalog/catalog";
import { SAMPLE_CATALOG } from "@/features/catalog/sample";

import {
  calculateQuote,
  customDesignWeeks,
  estimatePerimeterM,
  modelPriceRange,
  QuoteInputError,
} from "./engine";
import type { QuoteInput } from "./types";

const rules = pricingRulesFrom(SAMPLE_CATALOG);
const COPAN = "c3000000-0000-4000-8000-000000000002";
const LEMPIRA = "c3000000-0000-4000-8000-000000000001";
const BASIC = "d4000000-0000-4000-8000-000000000001";
const STANDARD = "d4000000-0000-4000-8000-000000000002";
const PREMIUM = "d4000000-0000-4000-8000-000000000003";
const WALL = "e5000000-0000-4000-8000-000000000001";
const CISTERN = "e5000000-0000-4000-8000-000000000002";
const SOLAR = "e5000000-0000-4000-8000-000000000004";
const AC = "e5000000-0000-4000-8000-000000000006";
const CHOLOMA_LOT = "b2000000-0000-4000-8000-000000000001";
const RESERVED_LOT = "b2000000-0000-4000-8000-000000000006";

const base: QuoteInput = {
  landStatus: "own",
  lotId: null,
  departmentId: 5, // Cortés, factor 1.0
  municipalityId: 1,
  landAreaM2: 200,
  design: { kind: "model", modelId: COPAN },
  finishLevelId: STANDARD,
  extras: [],
};

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe("calculateQuote", () => {
  it("modelo con acabado estándar en Cortés = precio base", () => {
    const result = calculateQuote(base, rules);
    expect(result.constructionUsdCents).toBe(4_380_000);
    expect(result.totalUsdCents).toBe(4_380_000);
    expect(result.durationWeeks).toBe(22);
    expect(result.lotPriceUsdCents).toBeNull();
  });

  it("aplica el acabado y el factor del departamento, redondeando a $100", () => {
    // 43,800 × 1.32 × 1.07 = 61,861.68 → 61,900
    const result = calculateQuote(
      { ...base, departmentId: 1, municipalityId: null, finishLevelId: PREMIUM },
      rules,
    );
    expect(result.constructionUsdCents).toBe(6_190_000);
    expect(result.regionFactor).toBe(1.07);
    expect(result.finishMultiplier).toBe(1.32);
  });

  it("el acabado básico es más barato que el estándar y este que el premium", () => {
    const price = (finishLevelId: string) => calculateQuote({ ...base, finishLevelId }, rules).totalUsdCents;
    expect(price(BASIC)).toBeLessThan(price(STANDARD));
    expect(price(STANDARD)).toBeLessThan(price(PREMIUM));
  });

  it("diseño personalizado: m² × precio por m² del acabado", () => {
    const result = calculateQuote({ ...base, design: { kind: "custom", areaM2: 90 } }, rules);
    expect(result.constructionUsdCents).toBe(90 * 52_000); // $46,800
    expect(result.durationWeeks).toBe(customDesignWeeks(90));
  });

  it("suma los extras con su factor y los asigna a su etapa", () => {
    const result = calculateQuote(
      {
        ...base,
        departmentId: 8, // FM 1.04
        municipalityId: null,
        extras: [
          { extraId: WALL, quantity: 56 },
          { extraId: SOLAR, quantity: 1 }, // sin factor
          { extraId: AC, quantity: 2 }, // sin factor
        ],
      },
      rules,
    );
    const wall = result.extras.find((e) => e.key === "perimeter_wall")!;
    expect(wall.unitPriceUsdCents).toBe(9_900); // 95 × 1.04 = 98.8 → 99
    expect(wall.totalUsdCents).toBe(9_900 * 56);
    expect(result.extras.find((e) => e.key === "solar_panels")!.totalUsdCents).toBe(390_000);
    expect(result.extrasUsdCents).toBe(9_900 * 56 + 390_000 + 2 * 78_000);
    expect(result.totalUsdCents).toBe(result.constructionUsdCents + result.extrasUsdCents);

    const installations = result.stages.find((s) => s.key === "installations")!;
    const withoutExtras = calculateQuote(
      { ...base, departmentId: 8, municipalityId: null },
      rules,
    ).stages.find((s) => s.key === "installations")!;
    expect(installations.costUsdCents - withoutExtras.costUsdCents).toBe(390_000 + 156_000);
  });

  it("las etapas suman el total y el tiempo total, sin huecos", () => {
    const result = calculateQuote({ ...base, extras: [{ extraId: CISTERN, quantity: 1 }] }, rules);
    expect(sum(result.stages.map((s) => s.costUsdCents))).toBe(result.totalUsdCents);
    expect(sum(result.stages.map((s) => s.weeks))).toBe(result.durationWeeks);
    result.stages.forEach((stage, index) => {
      expect(stage.endWeek - stage.startWeek).toBe(stage.weeks);
      if (index > 0) expect(stage.startWeek).toBe(result.stages[index - 1]!.endWeek);
    });
  });

  it("plan de pagos: 20 % al firmar y el resto por etapa, sumando el total exacto", () => {
    const result = calculateQuote({ ...base, extras: [{ extraId: WALL, quantity: 57 }] }, rules);
    const [initial, ...stagePayments] = result.payments;
    expect(initial).toMatchObject({
      kind: "initial",
      amountUsdCents: Math.round((result.totalUsdCents * 0.2) / 100) * 100,
    });
    expect(sum(result.payments.map((p) => p.amountUsdCents))).toBe(result.totalUsdCents);
    // Trámites se cubren con el pago inicial: no tienen pago propio.
    expect(stagePayments.map((p) => p.stageKey)).toEqual([
      "foundation",
      "walls",
      "roof",
      "installations",
      "finishes",
      "delivery",
    ]);
    // Cada pago se hace al ver terminada la etapa anterior.
    expect(stagePayments.map((p) => p.afterStageKey)).toEqual([
      "permits",
      "foundation",
      "walls",
      "roof",
      "installations",
      "finishes",
    ]);
    for (const payment of result.payments) expect(payment.amountUsdCents % 100).toBe(0);
  });

  it("comprar uno de nuestros terrenos toma su departamento, su área y su precio aparte", () => {
    const result = calculateQuote(
      { ...base, landStatus: "buying_from_us", lotId: CHOLOMA_LOT, departmentId: 8, landAreaM2: null },
      rules,
    );
    expect(result.regionFactor).toBe(1); // Choloma está en Cortés
    expect(result.lotPriceUsdCents).toBe(1_280_000);
    expect(result.grandTotalUsdCents).toBe(result.totalUsdCents + 1_280_000);
    // El terreno no entra en el plan de pagos por etapas.
    expect(sum(result.payments.map((p) => p.amountUsdCents))).toBe(result.totalUsdCents);
  });

  it("guarda la ubicación del terreno comprado, no la que mandó el navegador", () => {
    const lot = SAMPLE_CATALOG.lots.find((l) => l.id === CHOLOMA_LOT)!;
    const result = calculateQuote(
      { ...base, landStatus: "buying_from_us", lotId: CHOLOMA_LOT, departmentId: 1, landAreaM2: 9_999_999 },
      rules,
    );
    expect(result.location).toEqual({
      departmentId: lot.departmentId,
      municipalityId: lot.municipalityId,
      landAreaM2: lot.areaM2,
    });
  });

  it("rechaza un municipio que no es del departamento elegido", () => {
    const otherDepartment = SAMPLE_CATALOG.municipalities.find((m) => m.departmentId !== base.departmentId)!;
    expect(() => calculateQuote({ ...base, municipalityId: otherDepartment.id }, rules)).toThrow(
      expect.objectContaining({ code: "municipality_mismatch" }),
    );
    expect(calculateQuote({ ...base, municipalityId: null }, rules).location.municipalityId).toBeNull();
  });

  it("avisa si el terreno es más chico que el mínimo del modelo, sin bloquear", () => {
    const result = calculateQuote({ ...base, landAreaM2: 120 }, rules);
    expect(result.warnings).toEqual(["lot_smaller_than_model_minimum"]);
    expect(
      calculateQuote({ ...base, design: { kind: "model", modelId: LEMPIRA }, landAreaM2: 120 }, rules)
        .warnings,
    ).toEqual([]);
  });

  it.each<[string, Partial<QuoteInput>, string]>([
    ["departamento donde no operamos", { departmentId: 2 }, "department_unavailable"],
    [
      "modelo que no existe",
      { design: { kind: "model", modelId: "c3000000-0000-4000-8000-000000000099" } },
      "model_unavailable",
    ],
    ["diseño de 10 m²", { design: { kind: "custom", areaM2: 10 } }, "custom_area_out_of_range"],
    ["acabado que no existe", { finishLevelId: "x" }, "finish_unavailable"],
    ["extra que no existe", { extras: [{ extraId: "x", quantity: 1 }] }, "extra_unavailable"],
    ["cantidad fuera de rango", { extras: [{ extraId: AC, quantity: 9 }] }, "extra_quantity_out_of_range"],
    [
      "cantidad con decimales",
      { extras: [{ extraId: WALL, quantity: 12.5 }] },
      "extra_quantity_out_of_range",
    ],
    [
      "extra repetido",
      {
        extras: [
          { extraId: AC, quantity: 1 },
          { extraId: AC, quantity: 1 },
        ],
      },
      "duplicate_extra",
    ],
    ["terreno apartado", { landStatus: "buying_from_us", lotId: RESERVED_LOT }, "lot_unavailable"],
    ["comprar terreno sin elegirlo", { landStatus: "buying_from_us", lotId: null }, "lot_required"],
    ["área de terreno negativa", { landAreaM2: -5 }, "land_area_invalid"],
  ])("rechaza %s", (_, patch, code) => {
    expect(() => calculateQuote({ ...base, ...patch }, rules)).toThrow(QuoteInputError);
    try {
      calculateQuote({ ...base, ...patch }, rules);
    } catch (error) {
      expect((error as QuoteInputError).code).toBe(code);
    }
  });

  it("modelos inactivos no se cotizan", () => {
    const inactive = {
      ...rules,
      models: rules.models.map((m) => (m.id === COPAN ? { ...m, isActive: false } : m)),
    };
    expect(() => calculateQuote(base, inactive)).toThrow(QuoteInputError);
  });
});

describe("modelPriceRange", () => {
  it("va del acabado básico en el departamento más barato al premium en el más caro", () => {
    const range = modelPriceRange(COPAN, rules)!;
    expect(range.minUsdCents).toBe(Math.round((4_380_000 * 0.86 * 0.97) / 10_000) * 10_000);
    expect(range.maxUsdCents).toBe(Math.round((4_380_000 * 1.32 * 1.07) / 10_000) * 10_000);
  });
});

describe("estimatePerimeterM", () => {
  it("aproxima el perímetro de un terreno cuadrado", () => {
    expect(estimatePerimeterM(400)).toBe(80);
    expect(estimatePerimeterM(200)).toBe(57);
  });
});
