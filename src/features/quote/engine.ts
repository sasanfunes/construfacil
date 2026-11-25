import { allocate } from "@/lib/allocate";

import type {
  PricingRules,
  QuoteExtraLine,
  QuoteInput,
  QuotePayment,
  QuoteResult,
  QuoteStage,
  QuoteWarning,
  StageTemplate,
} from "./types";

/**
 * Motor del cotizador. Función pura: la usan el navegador (estimado al instante) y el
 * servidor (que recalcula todo antes de guardar; nunca confía en montos del navegador).
 *
 * Reglas:
 * - Obra con modelo: precio base × multiplicador del acabado × factor del departamento.
 * - Diseño personalizado: m² × precio por m² del acabado × factor del departamento.
 * - La obra se redondea a $100: es un estimado y no debe aparentar más precisión.
 * - Extras: precio unitario × cantidad (× factor si aplica), redondeado a $1.
 * - Pago inicial: porcentaje del total, al firmar. Cubre las etapas marcadas como
 *   `coveredByInitialPayment` (trámites y diseño).
 * - El resto se reparte entre las demás etapas según su costo. Cada pago se hace antes de
 *   empezar la etapa, cuando el cliente ya vio terminada la anterior.
 */

export const CUSTOM_DESIGN_MIN_M2 = 20;
export const CUSTOM_DESIGN_MAX_M2 = 2000;

export type QuoteErrorCode =
  | "department_unavailable"
  | "municipality_mismatch"
  | "lot_unavailable"
  | "lot_required"
  | "model_unavailable"
  | "custom_area_out_of_range"
  | "finish_unavailable"
  | "extra_unavailable"
  | "extra_quantity_out_of_range"
  | "duplicate_extra"
  | "land_area_invalid"
  | "no_stages";

export class QuoteInputError extends Error {
  constructor(readonly code: QuoteErrorCode) {
    super(`Cotización inválida: ${code}`);
    this.name = "QuoteInputError";
  }
}

const DOLLAR = 100;
const HUNDRED_DOLLARS = 100 * DOLLAR;

function roundTo(cents: number, step: number): number {
  return Math.round(cents / step) * step;
}

/** Semanas de obra de un diseño personalizado: diseño y permisos más el tamaño. */
export function customDesignWeeks(areaM2: number): number {
  return 16 + Math.round(areaM2 / 8);
}

/** Perímetro aproximado de un terreno cuadrado, para sugerir los metros de muro perimetral. */
export function estimatePerimeterM(landAreaM2: number): number {
  return Math.round(4 * Math.sqrt(landAreaM2));
}

export function sortedStages(stages: readonly StageTemplate[]): StageTemplate[] {
  return [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function calculateQuote(input: QuoteInput, rules: PricingRules): QuoteResult {
  // --- Ubicación y terreno -----------------------------------------------------------
  let departmentId = input.departmentId;
  let municipalityId = input.municipalityId;
  let landAreaM2 = input.landAreaM2;
  let lotPriceUsdCents: number | null = null;

  if (input.landStatus === "buying_from_us") {
    if (!input.lotId) throw new QuoteInputError("lot_required");
    const lot = rules.lots.find((l) => l.id === input.lotId);
    if (!lot || lot.listingStatus !== "published") throw new QuoteInputError("lot_unavailable");
    departmentId = lot.departmentId;
    municipalityId = lot.municipalityId;
    landAreaM2 = lot.areaM2;
    lotPriceUsdCents = lot.priceUsdCents;
  }

  const department = rules.departments.find((d) => d.id === departmentId);
  if (!department?.isActive) throw new QuoteInputError("department_unavailable");
  if (municipalityId !== null) {
    const municipality = rules.municipalities.find((m) => m.id === municipalityId);
    if (municipality?.departmentId !== departmentId) throw new QuoteInputError("municipality_mismatch");
  }
  if (landAreaM2 !== null && !(landAreaM2 > 0 && landAreaM2 < 10_000_000)) {
    throw new QuoteInputError("land_area_invalid");
  }

  const regionFactor = rules.regionFactors.find((r) => r.departmentId === departmentId)?.factor ?? 1;

  // --- Acabado y obra ----------------------------------------------------------------
  const finish = rules.finishLevels.find((f) => f.id === input.finishLevelId);
  if (!finish) throw new QuoteInputError("finish_unavailable");

  let constructionUsdCents: number;
  let durationWeeks: number;
  const warnings: QuoteWarning[] = [];

  if (input.design.kind === "model") {
    const { modelId } = input.design;
    const model = rules.models.find((m) => m.id === modelId && m.isActive);
    if (!model) throw new QuoteInputError("model_unavailable");
    constructionUsdCents = roundTo(
      model.basePriceUsdCents * finish.priceMultiplier * regionFactor,
      HUNDRED_DOLLARS,
    );
    durationWeeks = model.buildWeeks;
    if (landAreaM2 !== null && landAreaM2 < model.minLotAreaM2)
      warnings.push("lot_smaller_than_model_minimum");
  } else {
    const { areaM2 } = input.design;
    if (!(areaM2 >= CUSTOM_DESIGN_MIN_M2 && areaM2 <= CUSTOM_DESIGN_MAX_M2)) {
      throw new QuoteInputError("custom_area_out_of_range");
    }
    constructionUsdCents = roundTo(areaM2 * finish.customPricePerM2UsdCents * regionFactor, HUNDRED_DOLLARS);
    durationWeeks = customDesignWeeks(areaM2);
  }

  // --- Extras ------------------------------------------------------------------------
  const seen = new Set<string>();
  const extras: QuoteExtraLine[] = input.extras.map(({ extraId, quantity }) => {
    if (seen.has(extraId)) throw new QuoteInputError("duplicate_extra");
    seen.add(extraId);
    const extra = rules.extras.find((e) => e.id === extraId);
    if (!extra) throw new QuoteInputError("extra_unavailable");
    if (!Number.isInteger(quantity) || quantity < extra.minQuantity || quantity > extra.maxQuantity) {
      throw new QuoteInputError("extra_quantity_out_of_range");
    }
    const factor = extra.appliesRegionFactor ? regionFactor : 1;
    const unitPriceUsdCents = roundTo(extra.unitPriceUsdCents * factor, DOLLAR);
    return {
      extraId,
      key: extra.key,
      stageKey: extra.stageKey,
      quantity,
      unitPriceUsdCents,
      totalUsdCents: unitPriceUsdCents * quantity,
    };
  });
  const extrasUsdCents = extras.reduce((sum, line) => sum + line.totalUsdCents, 0);
  const totalUsdCents = constructionUsdCents + extrasUsdCents;

  // --- Etapas: costo y tiempo --------------------------------------------------------
  const stages = sortedStages(rules.stages);
  if (stages.length === 0) throw new QuoteInputError("no_stages");

  const stageConstruction = allocate(
    constructionUsdCents / DOLLAR,
    stages.map((s) => s.costShareBp),
  ).map((dollars) => dollars * DOLLAR);
  const stageWeeks = allocate(
    durationWeeks,
    stages.map((s) => s.durationShareBp),
  );

  let cursor = 0;
  const quoteStages: QuoteStage[] = stages.map((stage, index) => {
    const extrasForStage = extras
      .filter((line) => line.stageKey === stage.key)
      .reduce((sum, line) => sum + line.totalUsdCents, 0);
    const weeks = stageWeeks[index] ?? 0;
    const result: QuoteStage = {
      key: stage.key,
      costUsdCents: (stageConstruction[index] ?? 0) + extrasForStage,
      weeks,
      startWeek: cursor,
      endWeek: cursor + weeks,
    };
    cursor += weeks;
    return result;
  });

  // Extras de etapas que no existen: se suman a la última, para que no se pierda dinero.
  const orphanExtras = extras
    .filter((line) => !stages.some((s) => s.key === line.stageKey))
    .reduce((sum, line) => sum + line.totalUsdCents, 0);
  if (orphanExtras > 0) quoteStages[quoteStages.length - 1]!.costUsdCents += orphanExtras;

  // --- Plan de pagos -----------------------------------------------------------------
  const initialPaymentUsdCents = roundTo((totalUsdCents * rules.initialPaymentPercent) / 100, DOLLAR);
  const remaining = totalUsdCents - initialPaymentUsdCents;
  const payable = quoteStages
    .map((stage, index) => ({ stage, index, template: stages[index]! }))
    .filter(({ stage, template }) => !template.coveredByInitialPayment && stage.costUsdCents > 0);

  const payments: QuotePayment[] = [
    { kind: "initial", stageKey: null, afterStageKey: null, amountUsdCents: initialPaymentUsdCents },
  ];

  if (remaining > 0 && payable.length > 0) {
    const amounts = allocate(
      remaining / DOLLAR,
      payable.map(({ stage }) => stage.costUsdCents),
    );
    payable.forEach(({ stage, index }, i) => {
      payments.push({
        kind: "stage",
        stageKey: stage.key,
        afterStageKey: index > 0 ? quoteStages[index - 1]!.key : null,
        amountUsdCents: (amounts[i] ?? 0) * DOLLAR,
      });
    });
  } else if (remaining > 0) {
    payments[0]!.amountUsdCents = totalUsdCents;
  }

  return {
    location: { departmentId, municipalityId, landAreaM2 },
    constructionUsdCents,
    extrasUsdCents,
    totalUsdCents,
    lotPriceUsdCents,
    grandTotalUsdCents: totalUsdCents + (lotPriceUsdCents ?? 0),
    initialPaymentPercent: rules.initialPaymentPercent,
    durationWeeks: quoteStages.reduce((sum, s) => sum + s.weeks, 0),
    regionFactor,
    finishMultiplier: finish.priceMultiplier,
    stages: quoteStages,
    payments,
    extras,
    warnings,
  };
}

/** Rango de precio de un modelo (acabado más económico y más caro, en todos los departamentos activos). */
export function modelPriceRange(
  modelId: string,
  rules: PricingRules,
): { minUsdCents: number; maxUsdCents: number } | null {
  const model = rules.models.find((m) => m.id === modelId);
  if (!model || rules.finishLevels.length === 0) return null;
  const activeFactors = rules.departments
    .filter((d) => d.isActive)
    .map((d) => rules.regionFactors.find((r) => r.departmentId === d.id)?.factor ?? 1);
  const factors = activeFactors.length > 0 ? activeFactors : [1];
  const multipliers = rules.finishLevels.map((f) => f.priceMultiplier);
  const price = (m: number, f: number) => roundTo(model.basePriceUsdCents * m * f, HUNDRED_DOLLARS);
  return {
    minUsdCents: price(Math.min(...multipliers), Math.min(...factors)),
    maxUsdCents: price(Math.max(...multipliers), Math.max(...factors)),
  };
}
