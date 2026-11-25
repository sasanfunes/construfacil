import type { HouseModel, Localized, Lot } from "@/features/catalog/types";
import type { Department, Municipality } from "@/features/geo/data";

/**
 * Proyecto de construcción: lo que el cliente arma en el onboarding de "Construir".
 *
 * La obra tiene 4 etapas y antes de ellas "diseño y trámites", que se paga con el pago
 * inicial. En cada etapa el cliente elige sistemas y materiales (opciones del catálogo);
 * el costo sale de esas opciones, del tamaño de la casa y del factor del departamento.
 */

/** Las 4 etapas de obra, en orden. */
export const BUILD_STAGES = ["foundation", "grey_work", "roof", "finishes"] as const;
export type BuildStage = (typeof BUILD_STAGES)[number];

/** Diseño y trámites: antes de la obra, se paga con el pago inicial. */
export const PRELIMINARY_STAGE = "preliminary";
export const OPTION_STAGES = [PRELIMINARY_STAGE, ...BUILD_STAGES] as const;
export type OptionStage = (typeof OPTION_STAGES)[number];

/**
 * Sobre qué cantidad se cobra una opción:
 * - `construction_m2`: metros de construcción (todas las plantas).
 * - `footprint_m2`: metros de la planta baja (cimentación y techo).
 * - `upper_floor_m2`: metros de la planta alta (entrepiso). 0 en casas de una planta.
 * - `per_bathroom`: por cada baño.
 * - `fixed`: una sola vez.
 */
export const PRICING_BASES = [
  "construction_m2",
  "footprint_m2",
  "upper_floor_m2",
  "per_bathroom",
  "fixed",
] as const;
export type PricingBasis = (typeof PRICING_BASES)[number];

/**
 * Cómo se elige una categoría:
 * - `user`: el cliente elige una opción.
 * - `included`: va siempre (una sola opción); se muestra como incluida.
 * - `design`: la elige el sistema según el origen del diseño (planos propios, a la medida o catálogo).
 */
export type CategoryChoice = "user" | "included" | "design";

export type CategoryRule = {
  stage: OptionStage;
  choice: CategoryChoice;
  /** Solo aplica a casas de dos plantas. */
  twoFloorsOnly?: boolean;
};

/**
 * Categorías de opciones, en el orden en que se muestran. La lista es cerrada porque cada
 * una tiene su nombre traducido (`messages/*\/projects.json`) y su lugar en el onboarding.
 * Debe coincidir con `private.is_valid_construction_category` en la migración.
 */
export const OPTION_CATEGORIES = {
  design: { stage: "preliminary", choice: "design" },
  permits: { stage: "preliminary", choice: "included" },
  structure: { stage: "foundation", choice: "user" },
  footing_waterproofing: { stage: "foundation", choice: "user" },
  ground_slab: { stage: "foundation", choice: "included" },
  walls: { stage: "grey_work", choice: "user" },
  upper_slab: { stage: "grey_work", choice: "user", twoFloorsOnly: true },
  rough_installations: { stage: "grey_work", choice: "included" },
  roof_structure: { stage: "roof", choice: "user" },
  roof_cover: { stage: "roof", choice: "user" },
  roof_insulation: { stage: "roof", choice: "user" },
  ceiling: { stage: "roof", choice: "user" },
  floors: { stage: "finishes", choice: "user" },
  doors: { stage: "finishes", choice: "user" },
  windows: { stage: "finishes", choice: "user" },
  bathrooms: { stage: "finishes", choice: "user" },
  kitchen: { stage: "finishes", choice: "user" },
  paint_lighting: { stage: "finishes", choice: "included" },
} as const satisfies Record<string, CategoryRule>;

export type OptionCategory = keyof typeof OPTION_CATEGORIES;
export const OPTION_CATEGORY_KEYS = Object.keys(OPTION_CATEGORIES) as OptionCategory[];

/** Opción de diseño que el sistema elige según de dónde sale el diseño. */
export const DESIGN_OPTION_KEY = {
  own_plans: "own_plans_review",
  custom: "custom_design",
  catalog: "catalog_plans",
} as const;

export type ConstructionOption = {
  id: string;
  stage: OptionStage;
  category: OptionCategory;
  key: string;
  name: Localized;
  description: Localized;
  pricingBasis: PricingBasis;
  unitPriceUsdCents: number;
  /** Parte del costo que son materiales (puntos básicos, 10000 = 100 %). El resto es mano de obra. */
  materialsShareBp: number;
  /**
   * Tiempo que aporta: semanas por cada 100 m² (bases por área), semanas por baño
   * (`per_bathroom`) o semanas fijas (`fixed`).
   */
  weeksFactor: number;
  isDefault: boolean;
  isActive: boolean;
  isExample: boolean;
  sortOrder: number;
};

export const LAND_STATUSES = ["own", "buying_from_us", "skipped"] as const;
export type LandStatus = (typeof LAND_STATUSES)[number];

export const DESIGN_SOURCES = ["own_plans", "custom", "catalog"] as const;
export type DesignSource = (typeof DESIGN_SOURCES)[number];

/** Límites de una casa a la medida o con planos propios. */
export const CUSTOM_AREA_MIN_M2 = 30;
export const CUSTOM_AREA_MAX_M2 = 600;
export const MAX_BEDROOMS = 8;
export const MAX_BATHROOMS = 6;

/** Lo que manda el navegador: solo elecciones e identificadores, nunca montos. */
export type ProjectInput = {
  landStatus: LandStatus;
  lotId: string | null;
  departmentId: number | null;
  municipalityId: number | null;
  landAreaM2: number | null;
  designSource: DesignSource;
  houseModelId: string | null;
  /** Ignorados si el diseño es del catálogo: salen del modelo. */
  areaM2: number | null;
  floors: 1 | 2;
  bedrooms: number;
  bathrooms: number;
  /** Una opción por cada categoría que elige el cliente. */
  optionIds: string[];
};

/** Todo lo que necesita el cálculo. Sale de la base (o de los datos de ejemplo). */
export type ProjectRules = {
  departments: readonly Department[];
  municipalities: readonly Pick<Municipality, "id" | "departmentId">[];
  lots: readonly Lot[];
  models: readonly HouseModel[];
  regionFactors: readonly { departmentId: number; factor: number }[];
  options: readonly ConstructionOption[];
};

export type ProjectLine = {
  optionId: string;
  category: OptionCategory;
  stage: OptionStage;
  quantity: number;
  unitPriceUsdCents: number;
  totalUsdCents: number;
  materialsUsdCents: number;
};

export type ProjectStageCost = {
  key: OptionStage;
  costUsdCents: number;
  /** Paquete de materiales de la etapa: es lo que se puede abonar. */
  materialsUsdCents: number;
  laborUsdCents: number;
  weeks: number;
  startWeek: number;
  endWeek: number;
};

export type ProjectPayment = {
  /** `initial` se paga al firmar (diseño y trámites); las demás antes de empezar cada etapa. */
  kind: "initial" | "stage";
  stageKey: OptionStage;
  /** Etapa que debe verse terminada antes de este pago. */
  afterStageKey: OptionStage | null;
  amountUsdCents: number;
};

export type ProjectWarning = "lot_smaller_than_model_minimum";

/** Diseño ya resuelto: si es del catálogo, con los datos del modelo. */
export type ResolvedDesign = {
  source: DesignSource;
  houseModelId: string | null;
  areaM2: number;
  floors: 1 | 2;
  bedrooms: number;
  bathrooms: number;
};

export type ProjectEstimate = {
  /** Ubicación con la que se calculó (la del terreno, si compra uno nuestro). */
  location: Pick<ProjectInput, "departmentId" | "municipalityId" | "landAreaM2">;
  design: ResolvedDesign;
  regionFactor: number;
  lines: ProjectLine[];
  stages: ProjectStageCost[];
  payments: ProjectPayment[];
  /** Diseño y trámites (pago inicial). */
  preliminaryUsdCents: number;
  /** Las 4 etapas de obra. */
  constructionUsdCents: number;
  /** Diseño, trámites y obra: lo que cubre el plan de pagos. */
  totalUsdCents: number;
  /** Precio del terreno si lo compra con nosotros. Se paga aparte. */
  lotPriceUsdCents: number | null;
  grandTotalUsdCents: number;
  durationWeeks: number;
  warnings: ProjectWarning[];
};
