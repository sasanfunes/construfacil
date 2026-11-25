import {
  BUILD_STAGES,
  CUSTOM_AREA_MAX_M2,
  CUSTOM_AREA_MIN_M2,
  DESIGN_OPTION_KEY,
  MAX_BATHROOMS,
  MAX_BEDROOMS,
  OPTION_CATEGORIES,
  OPTION_CATEGORY_KEYS,
  PRELIMINARY_STAGE,
  type BuildStage,
  type ConstructionOption,
  type OptionCategory,
  type OptionStage,
  type ProjectEstimate,
  type ProjectInput,
  type ProjectLine,
  type ProjectPayment,
  type ProjectRules,
  type ProjectStageCost,
  type ProjectWarning,
  type ResolvedDesign,
} from "./types";

/**
 * Motor del proyecto de construcción. Funciones puras: el navegador lo usa para mostrar el
 * costo en vivo y el servidor lo vuelve a correr al guardar, con las reglas de la base.
 *
 * Costo de cada opción = cantidad (según su base) × precio unitario × factor del departamento,
 * redondeado a dólares. Cada etapa suma sus opciones; su tiempo también sale de las opciones.
 */

export type ProjectInputErrorCode =
  | "lot_required"
  | "lot_unavailable"
  | "department_required"
  | "department_unavailable"
  | "municipality_mismatch"
  | "land_area_invalid"
  | "model_required"
  | "model_unavailable"
  | "area_out_of_range"
  | "rooms_out_of_range"
  | "option_unavailable"
  | "option_not_applicable"
  | "duplicate_category"
  | "missing_category"
  | "rules_incomplete";

export class ProjectInputError extends Error {
  constructor(readonly code: ProjectInputErrorCode) {
    super(`Proyecto inválido: ${code}`);
    this.name = "ProjectInputError";
  }
}

const DOLLAR = 100;
const roundToDollar = (cents: number) => Math.round(cents / DOLLAR) * DOLLAR;

/** ¿La categoría aplica a una casa de tantas plantas? */
export function categoryApplies(category: OptionCategory, floors: number): boolean {
  const rule = OPTION_CATEGORIES[category];
  return !("twoFloorsOnly" in rule && rule.twoFloorsOnly) || floors >= 2;
}

/** Opciones activas de una categoría, en orden. */
export function optionsOf(
  options: readonly ConstructionOption[],
  category: OptionCategory,
): ConstructionOption[] {
  return options
    .filter((o) => o.category === category && o.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Categorías que elige el cliente en una etapa, para una casa de tantas plantas. */
export function userCategoriesOf(stage: BuildStage, floors: number): OptionCategory[] {
  return OPTION_CATEGORY_KEYS.filter((category) => {
    const rule = OPTION_CATEGORIES[category];
    return rule.stage === stage && rule.choice === "user" && categoryApplies(category, floors);
  });
}

/** Categorías que van siempre en una etapa (se muestran como incluidas). */
export function includedCategoriesOf(stage: OptionStage): OptionCategory[] {
  return OPTION_CATEGORY_KEYS.filter(
    (category) =>
      OPTION_CATEGORIES[category].stage === stage && OPTION_CATEGORIES[category].choice === "included",
  );
}

/** La opción por defecto de cada categoría que elige el cliente: la marcada, o la primera. */
export function defaultOptionIds(options: readonly ConstructionOption[], floors: number): string[] {
  return BUILD_STAGES.flatMap((stage) =>
    userCategoriesOf(stage, floors).flatMap((category) => {
      const available = optionsOf(options, category);
      const chosen = available.find((o) => o.isDefault) ?? available[0];
      return chosen ? [chosen.id] : [];
    }),
  );
}

/**
 * Ajusta una selección a un número de plantas: quita lo que ya no aplica y completa con
 * los valores por defecto lo que falte. Sirve cuando el cliente cambia de 1 a 2 plantas.
 */
export function normalizeOptionIds(
  options: readonly ConstructionOption[],
  optionIds: readonly string[],
  floors: number,
): string[] {
  const byId = new Map(options.map((o) => [o.id, o]));
  const chosen = new Map<OptionCategory, string>();
  for (const id of optionIds) {
    const option = byId.get(id);
    if (!option?.isActive || OPTION_CATEGORIES[option.category].choice !== "user") continue;
    if (!categoryApplies(option.category, floors) || chosen.has(option.category)) continue;
    chosen.set(option.category, option.id);
  }
  const defaults = defaultOptionIds(options, floors);
  for (const id of defaults) {
    const option = byId.get(id)!;
    if (!chosen.has(option.category)) chosen.set(option.category, id);
  }
  // Orden estable: el de las categorías.
  return OPTION_CATEGORY_KEYS.flatMap((category) => (chosen.has(category) ? [chosen.get(category)!] : []));
}

function resolveDesign(input: ProjectInput, rules: ProjectRules): ResolvedDesign {
  if (input.designSource === "catalog") {
    if (!input.houseModelId) throw new ProjectInputError("model_required");
    const model = rules.models.find((m) => m.id === input.houseModelId && m.isActive);
    if (!model) throw new ProjectInputError("model_unavailable");
    return {
      source: "catalog",
      houseModelId: model.id,
      areaM2: model.areaM2,
      floors: model.floors >= 2 ? 2 : 1,
      bedrooms: model.bedrooms,
      bathrooms: Math.max(1, Math.ceil(model.bathrooms)),
    };
  }
  const { areaM2, floors, bedrooms, bathrooms } = input;
  if (areaM2 === null || !(areaM2 >= CUSTOM_AREA_MIN_M2 && areaM2 <= CUSTOM_AREA_MAX_M2)) {
    throw new ProjectInputError("area_out_of_range");
  }
  if (
    !Number.isInteger(bedrooms) ||
    !Number.isInteger(bathrooms) ||
    bedrooms < 0 ||
    bedrooms > MAX_BEDROOMS ||
    bathrooms < 1 ||
    bathrooms > MAX_BATHROOMS ||
    (floors !== 1 && floors !== 2)
  ) {
    throw new ProjectInputError("rooms_out_of_range");
  }
  return { source: input.designSource, houseModelId: null, areaM2, floors, bedrooms, bathrooms };
}

function resolveLocation(input: ProjectInput, rules: ProjectRules) {
  let departmentId = input.departmentId;
  let municipalityId = input.municipalityId;
  let landAreaM2 = input.landAreaM2;
  let lotPriceUsdCents: number | null = null;

  if (input.landStatus === "buying_from_us") {
    if (!input.lotId) throw new ProjectInputError("lot_required");
    const lot = rules.lots.find((l) => l.id === input.lotId);
    if (!lot || lot.listingStatus !== "published") throw new ProjectInputError("lot_unavailable");
    departmentId = lot.departmentId;
    municipalityId = lot.municipalityId;
    landAreaM2 = lot.areaM2;
    lotPriceUsdCents = lot.priceUsdCents;
  } else if (input.landStatus === "own" && departmentId === null) {
    throw new ProjectInputError("department_required");
  }

  if (departmentId !== null) {
    const department = rules.departments.find((d) => d.id === departmentId);
    if (!department?.isActive) throw new ProjectInputError("department_unavailable");
  }
  if (municipalityId !== null) {
    const municipality = rules.municipalities.find((m) => m.id === municipalityId);
    if (departmentId === null || municipality?.departmentId !== departmentId) {
      throw new ProjectInputError("municipality_mismatch");
    }
  }
  if (input.landStatus === "skipped") landAreaM2 = null;
  if (landAreaM2 !== null && !(landAreaM2 > 0 && landAreaM2 < 10_000_000)) {
    throw new ProjectInputError("land_area_invalid");
  }
  return { departmentId, municipalityId, landAreaM2, lotPriceUsdCents };
}

/** Opciones con las que se calcula: las del cliente, las incluidas y la de diseño. */
function resolveOptions(
  input: ProjectInput,
  design: ResolvedDesign,
  rules: ProjectRules,
): ConstructionOption[] {
  const byId = new Map(rules.options.map((o) => [o.id, o]));
  const chosen = new Map<OptionCategory, ConstructionOption>();

  for (const id of input.optionIds) {
    const option = byId.get(id);
    if (!option?.isActive || OPTION_CATEGORIES[option.category].choice !== "user") {
      throw new ProjectInputError("option_unavailable");
    }
    if (!categoryApplies(option.category, design.floors))
      throw new ProjectInputError("option_not_applicable");
    if (chosen.has(option.category)) throw new ProjectInputError("duplicate_category");
    chosen.set(option.category, option);
  }

  for (const stage of BUILD_STAGES) {
    for (const category of userCategoriesOf(stage, design.floors)) {
      if (!chosen.has(category)) throw new ProjectInputError("missing_category");
    }
  }

  const included = OPTION_CATEGORY_KEYS.filter((c) => OPTION_CATEGORIES[c].choice === "included").map(
    (category) => {
      const option = optionsOf(rules.options, category)[0];
      if (!option) throw new ProjectInputError("rules_incomplete");
      return option;
    },
  );

  const designOption = optionsOf(rules.options, "design").find(
    (o) => o.key === DESIGN_OPTION_KEY[design.source],
  );
  if (!designOption) throw new ProjectInputError("rules_incomplete");

  return [designOption, ...included, ...chosen.values()];
}

function quantityOf(option: ConstructionOption, design: ResolvedDesign): number {
  const footprint = design.areaM2 / design.floors;
  switch (option.pricingBasis) {
    case "construction_m2":
      return design.areaM2;
    case "footprint_m2":
      return footprint;
    case "upper_floor_m2":
      return design.areaM2 - footprint;
    case "per_bathroom":
      return design.bathrooms;
    case "fixed":
      return 1;
  }
}

function weeksOf(option: ConstructionOption, quantity: number): number {
  return option.pricingBasis === "fixed" || option.pricingBasis === "per_bathroom"
    ? option.weeksFactor * quantity
    : (option.weeksFactor * quantity) / 100;
}

export function estimateProject(input: ProjectInput, rules: ProjectRules): ProjectEstimate {
  const location = resolveLocation(input, rules);
  const design = resolveDesign(input, rules);
  const options = resolveOptions(input, design, rules);
  const regionFactor =
    location.departmentId === null
      ? 1
      : (rules.regionFactors.find((r) => r.departmentId === location.departmentId)?.factor ?? 1);

  const warnings: ProjectWarning[] = [];
  const model = design.houseModelId ? rules.models.find((m) => m.id === design.houseModelId) : undefined;
  if (model && location.landAreaM2 !== null && location.landAreaM2 < model.minLotAreaM2) {
    warnings.push("lot_smaller_than_model_minimum");
  }

  const stageOrder: OptionStage[] = [PRELIMINARY_STAGE, ...BUILD_STAGES];
  const lines: ProjectLine[] = [];
  const weeksByStage = new Map<OptionStage, number>();

  for (const option of options) {
    const quantity = Math.round(quantityOf(option, design) * 100) / 100;
    const totalUsdCents = roundToDollar(quantity * option.unitPriceUsdCents * regionFactor);
    lines.push({
      optionId: option.id,
      category: option.category,
      stage: option.stage,
      quantity,
      unitPriceUsdCents: option.unitPriceUsdCents,
      totalUsdCents,
      materialsUsdCents: roundToDollar((totalUsdCents * option.materialsShareBp) / 10_000),
    });
    weeksByStage.set(option.stage, (weeksByStage.get(option.stage) ?? 0) + weeksOf(option, quantity));
  }
  lines.sort(
    (a, b) =>
      stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage) ||
      OPTION_CATEGORY_KEYS.indexOf(a.category) - OPTION_CATEGORY_KEYS.indexOf(b.category),
  );

  let week = 0;
  const stages: ProjectStageCost[] = stageOrder.map((key) => {
    const stageLines = lines.filter((l) => l.stage === key);
    const costUsdCents = stageLines.reduce((sum, l) => sum + l.totalUsdCents, 0);
    const materialsUsdCents = stageLines.reduce((sum, l) => sum + l.materialsUsdCents, 0);
    const weeks = Math.max(1, Math.round(weeksByStage.get(key) ?? 0));
    const stage = {
      key,
      costUsdCents,
      materialsUsdCents,
      laborUsdCents: costUsdCents - materialsUsdCents,
      weeks,
      startWeek: week,
      endWeek: week + weeks,
    };
    week += weeks;
    return stage;
  });

  // Cada etapa se paga antes de empezar, al ver terminada la anterior.
  const payments: ProjectPayment[] = stages.map((stage, index) => ({
    kind: index === 0 ? "initial" : "stage",
    stageKey: stage.key,
    afterStageKey: index === 0 ? null : stages[index - 1]!.key,
    amountUsdCents: stage.costUsdCents,
  }));

  const preliminaryUsdCents = stages[0]!.costUsdCents;
  const constructionUsdCents = stages.slice(1).reduce((sum, s) => sum + s.costUsdCents, 0);
  const totalUsdCents = preliminaryUsdCents + constructionUsdCents;

  return {
    location: {
      departmentId: location.departmentId,
      municipalityId: location.municipalityId,
      landAreaM2: location.landAreaM2,
    },
    design,
    regionFactor,
    lines,
    stages,
    payments,
    preliminaryUsdCents,
    constructionUsdCents,
    totalUsdCents,
    lotPriceUsdCents: location.lotPriceUsdCents,
    grandTotalUsdCents: totalUsdCents + (location.lotPriceUsdCents ?? 0),
    durationWeeks: week,
    warnings,
  };
}

/** Calcula sin lanzar error: para la vista en vivo del navegador. */
export function safeEstimate(input: ProjectInput | null, rules: ProjectRules): ProjectEstimate | null {
  if (!input) return null;
  try {
    return estimateProject(input, rules);
  } catch (error) {
    if (error instanceof ProjectInputError) return null;
    throw error;
  }
}

/**
 * Precio de referencia de un modelo del catálogo: con las opciones por defecto y factor 1
 * (sin terreno ni departamento). Es el "desde" de las fichas de modelo.
 */
export function modelReferenceEstimate(modelId: string, rules: ProjectRules): ProjectEstimate | null {
  const model = rules.models.find((m) => m.id === modelId && m.isActive);
  if (!model) return null;
  const floors = model.floors >= 2 ? 2 : 1;
  return safeEstimate(
    {
      landStatus: "skipped",
      lotId: null,
      departmentId: null,
      municipalityId: null,
      landAreaM2: null,
      designSource: "catalog",
      houseModelId: model.id,
      areaM2: null,
      floors,
      bedrooms: model.bedrooms,
      bathrooms: Math.max(1, Math.ceil(model.bathrooms)),
      optionIds: defaultOptionIds(rules.options, floors),
    },
    rules,
  );
}
