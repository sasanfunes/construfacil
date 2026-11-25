import type { HouseModel, Localized, Lot } from "@/features/catalog/types";
import type { Department } from "@/features/geo/data";

export const PRICING_UNITS = ["fixed", "per_m2", "per_linear_m", "per_unit"] as const;
export type PricingUnit = (typeof PRICING_UNITS)[number];

export type FinishLevel = {
  id: string;
  key: string;
  name: Localized;
  description: Localized;
  includes: Readonly<Record<"es" | "en", readonly string[]>>;
  priceMultiplier: number;
  customPricePerM2UsdCents: number;
  sortOrder: number;
};

export type RegionFactor = { departmentId: number; factor: number };

export type QuoteExtra = {
  id: string;
  key: string;
  name: Localized;
  description: Localized;
  pricingUnit: PricingUnit;
  unitPriceUsdCents: number;
  minQuantity: number;
  maxQuantity: number;
  defaultQuantity: number;
  appliesRegionFactor: boolean;
  stageKey: string;
  sortOrder: number;
};

export type StageTemplate = {
  key: string;
  name: Localized;
  description: Localized;
  sortOrder: number;
  costShareBp: number;
  durationShareBp: number;
  coveredByInitialPayment: boolean;
};

/** Todo lo que necesita el cálculo. Sale de la base (o de los datos de ejemplo). */
export type PricingRules = {
  departments: readonly Department[];
  models: readonly HouseModel[];
  lots: readonly Lot[];
  finishLevels: readonly FinishLevel[];
  regionFactors: readonly RegionFactor[];
  extras: readonly QuoteExtra[];
  stages: readonly StageTemplate[];
  initialPaymentPercent: number;
};

export const LAND_STATUSES = ["own", "buying_from_us", "not_yet"] as const;
export type LandStatus = (typeof LAND_STATUSES)[number];

export type QuoteDesign = { kind: "model"; modelId: string } | { kind: "custom"; areaM2: number };

export type QuoteInput = {
  landStatus: LandStatus;
  lotId: string | null;
  departmentId: number;
  municipalityId: number | null;
  landAreaM2: number | null;
  design: QuoteDesign;
  finishLevelId: string;
  extras: ReadonlyArray<{ extraId: string; quantity: number }>;
};

export type QuoteStage = {
  key: string;
  costUsdCents: number;
  weeks: number;
  startWeek: number;
  endWeek: number;
};

export type QuotePayment = {
  /** `initial` se paga al firmar; las demás antes de empezar la etapa, al ver terminada la anterior. */
  kind: "initial" | "stage";
  stageKey: string | null;
  /** Etapa que debe verse terminada antes de este pago. */
  afterStageKey: string | null;
  amountUsdCents: number;
};

export type QuoteExtraLine = {
  extraId: string;
  key: string;
  stageKey: string;
  quantity: number;
  unitPriceUsdCents: number;
  totalUsdCents: number;
};

export type QuoteWarning = "lot_smaller_than_model_minimum";

export type QuoteResult = {
  constructionUsdCents: number;
  extrasUsdCents: number;
  /** Construcción + extras: lo que cubre el plan de pagos por etapas. */
  totalUsdCents: number;
  /** Precio del terreno si lo compra con nosotros. Se paga aparte. */
  lotPriceUsdCents: number | null;
  grandTotalUsdCents: number;
  initialPaymentPercent: number;
  durationWeeks: number;
  regionFactor: number;
  finishMultiplier: number;
  stages: QuoteStage[];
  payments: QuotePayment[];
  extras: QuoteExtraLine[];
  warnings: QuoteWarning[];
};
