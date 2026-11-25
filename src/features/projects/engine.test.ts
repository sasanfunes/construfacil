import { describe, expect, it } from "vitest";

import { projectRulesFrom } from "@/features/catalog/catalog";
import { SAMPLE_CATALOG } from "@/features/catalog/sample";

import {
  defaultOptionIds,
  estimateProject,
  modelReferenceEstimate,
  normalizeOptionIds,
  ProjectInputError,
  userCategoriesOf,
} from "./engine";
import type { ProjectInput } from "./types";

const rules = projectRulesFrom(SAMPLE_CATALOG);
const COPAN = "c3000000-0000-4000-8000-000000000002"; // 86 m², 1 planta, 2 baños
const TWO_FLOOR_MODEL = "c3000000-0000-4000-8000-000000000004";
const CHOLOMA_LOT = "b2000000-0000-4000-8000-000000000001";
const RESERVED_LOT = "b2000000-0000-4000-8000-000000000006";
const CORTES = 5; // factor 1.0
const FRANCISCO_MORAZAN = 8; // factor 1.04

const optionId = (category: string, key: string) =>
  SAMPLE_CATALOG.constructionOptions.find((o) => o.category === category && o.key === key)!.id;

const base: ProjectInput = {
  landStatus: "own",
  lotId: null,
  departmentId: CORTES,
  municipalityId: null,
  landAreaM2: 300,
  designSource: "catalog",
  houseModelId: COPAN,
  areaM2: null,
  floors: 1,
  bedrooms: 3,
  bathrooms: 2,
  optionIds: defaultOptionIds(SAMPLE_CATALOG.constructionOptions, 1),
};

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

function expectError(input: ProjectInput, code: string) {
  try {
    estimateProject(input, rules);
  } catch (error) {
    expect(error).toBeInstanceOf(ProjectInputError);
    expect((error as ProjectInputError).code).toBe(code);
    return;
  }
  throw new Error(`Se esperaba el error ${code}`);
}

describe("estimateProject", () => {
  it("modelo del catálogo con las opciones por defecto: 4 etapas más diseño y trámites", () => {
    const result = estimateProject(base, rules);
    expect(result.stages.map((s) => s.key)).toEqual([
      "preliminary",
      "foundation",
      "grey_work",
      "roof",
      "finishes",
    ]);
    expect(result.design).toMatchObject({ source: "catalog", areaM2: 86, floors: 1, bathrooms: 2 });
    // Precios de ejemplo: unos USD 450 por m² con diseño y trámites.
    expect(result.totalUsdCents / 100 / 86).toBeGreaterThan(400);
    expect(result.totalUsdCents / 100 / 86).toBeLessThan(500);
    expect(result.totalUsdCents).toBe(result.preliminaryUsdCents + result.constructionUsdCents);
    expect(result.grandTotalUsdCents).toBe(result.totalUsdCents);
    for (const line of result.lines) expect(line.totalUsdCents % 100).toBe(0);
  });

  it("cada etapa separa materiales y mano de obra, y el plan de pagos suma el total", () => {
    const result = estimateProject(base, rules);
    for (const stage of result.stages) {
      expect(stage.materialsUsdCents + stage.laborUsdCents).toBe(stage.costUsdCents);
      expect(stage.weeks).toBeGreaterThanOrEqual(1);
    }
    // Diseño y trámites no tienen materiales; las etapas de obra sí.
    expect(result.stages[0]!.materialsUsdCents).toBe(0);
    expect(result.stages[1]!.materialsUsdCents).toBeGreaterThan(0);
    expect(sum(result.payments.map((p) => p.amountUsdCents))).toBe(result.totalUsdCents);
    expect(result.payments.map((p) => [p.kind, p.stageKey, p.afterStageKey])).toEqual([
      ["initial", "preliminary", null],
      ["stage", "foundation", "preliminary"],
      ["stage", "grey_work", "foundation"],
      ["stage", "roof", "grey_work"],
      ["stage", "finishes", "roof"],
    ]);
    expect(result.durationWeeks).toBe(result.stages.at(-1)!.endWeek);
  });

  it("aplica el factor del departamento a todo", () => {
    const cortes = estimateProject(base, rules);
    const fm = estimateProject({ ...base, departmentId: FRANCISCO_MORAZAN }, rules);
    expect(fm.regionFactor).toBe(1.04);
    expect(fm.totalUsdCents).toBeGreaterThan(cortes.totalUsdCents);
    expect(Math.abs(fm.totalUsdCents / cortes.totalUsdCents - 1.04)).toBeLessThan(0.002);
  });

  it("cambiar materiales cambia el costo y el tiempo de su etapa", () => {
    const steel = normalizeOptionIds(
      SAMPLE_CATALOG.constructionOptions,
      [...base.optionIds, optionId("structure", "steel_framing")].filter(
        (id) => id !== optionId("structure", "reinforced_concrete"),
      ),
      1,
    );
    const concrete = estimateProject(base, rules);
    const steelFrame = estimateProject({ ...base, optionIds: steel }, rules);
    const foundation = (r: typeof concrete) => r.stages.find((s) => s.key === "foundation")!;
    expect(foundation(steelFrame).costUsdCents).toBeGreaterThan(foundation(concrete).costUsdCents);
    expect(foundation(steelFrame).weeks).toBeLessThanOrEqual(foundation(concrete).weeks);
  });

  it("comprar uno de nuestros terrenos toma su ubicación y su precio aparte", () => {
    const lot = SAMPLE_CATALOG.lots.find((l) => l.id === CHOLOMA_LOT)!;
    const result = estimateProject(
      { ...base, landStatus: "buying_from_us", lotId: CHOLOMA_LOT, departmentId: 1, landAreaM2: 9_999_999 },
      rules,
    );
    expect(result.location).toEqual({
      departmentId: lot.departmentId,
      municipalityId: lot.municipalityId,
      landAreaM2: lot.areaM2,
    });
    expect(result.lotPriceUsdCents).toBe(lot.priceUsdCents);
    expect(result.grandTotalUsdCents).toBe(result.totalUsdCents + lot.priceUsdCents);
    // El terreno no entra en el plan de pagos de la obra.
    expect(sum(result.payments.map((p) => p.amountUsdCents))).toBe(result.totalUsdCents);
  });

  it("sin terreno (saltado) calcula con factor 1 o con el departamento que eligió", () => {
    const skipped = estimateProject(
      { ...base, landStatus: "skipped", departmentId: null, landAreaM2: 500 },
      rules,
    );
    expect(skipped.regionFactor).toBe(1);
    expect(skipped.location.landAreaM2).toBeNull();
    const withDepartment = estimateProject(
      { ...base, landStatus: "skipped", departmentId: FRANCISCO_MORAZAN },
      rules,
    );
    expect(withDepartment.regionFactor).toBe(1.04);
  });

  it("diseño a la medida de dos plantas: entrepiso y cimentación sobre la planta baja", () => {
    const optionIds = defaultOptionIds(SAMPLE_CATALOG.constructionOptions, 2);
    const result = estimateProject(
      {
        ...base,
        designSource: "custom",
        houseModelId: null,
        areaM2: 160,
        floors: 2,
        bathrooms: 3,
        optionIds,
      },
      rules,
    );
    const slab = result.lines.find((l) => l.category === "upper_slab")!;
    const structure = result.lines.find((l) => l.category === "structure")!;
    expect(slab.quantity).toBe(80);
    expect(structure.quantity).toBe(80);
    expect(result.lines.find((l) => l.category === "bathrooms")!.quantity).toBe(3);
    expect(result.lines.find((l) => l.category === "design")!.optionId).toBe(
      optionId("design", "custom_design"),
    );
  });

  it("avisa si el terreno es más chico que el mínimo del modelo, sin bloquear", () => {
    expect(estimateProject({ ...base, landAreaM2: 100 }, rules).warnings).toEqual([
      "lot_smaller_than_model_minimum",
    ]);
  });

  it.each([
    ["terreno apartado", { landStatus: "buying_from_us", lotId: RESERVED_LOT }, "lot_unavailable"],
    ["comprar terreno sin elegirlo", { landStatus: "buying_from_us", lotId: null }, "lot_required"],
    ["terreno propio sin departamento", { departmentId: null }, "department_required"],
    ["departamento donde no operamos", { departmentId: 2 }, "department_unavailable"],
    ["municipio de otro departamento", { municipalityId: 999_999 }, "municipality_mismatch"],
    ["modelo que no existe", { houseModelId: "x" }, "model_unavailable"],
    ["diseño del catálogo sin modelo", { houseModelId: null }, "model_required"],
    ["casa a la medida demasiado chica", { designSource: "custom", areaM2: 10 }, "area_out_of_range"],
    ["casa sin baños", { designSource: "own_plans", areaM2: 90, bathrooms: 0 }, "rooms_out_of_range"],
    ["opción que no existe", { optionIds: [...base.optionIds, "x"] }, "option_unavailable"],
    [
      "una opción incluida mandada como elección",
      { optionIds: [...base.optionIds, optionId("ground_slab", "concrete_ground_slab")] },
      "option_unavailable",
    ],
    [
      "entrepiso en una casa de una planta",
      { optionIds: [...base.optionIds, optionId("upper_slab", "solid_slab")] },
      "option_not_applicable",
    ],
    [
      "dos opciones de la misma categoría",
      { optionIds: [...base.optionIds, optionId("walls", "polystyrene_panel")] },
      "duplicate_category",
    ],
    ["falta una categoría", { optionIds: base.optionIds.slice(1) }, "missing_category"],
  ] as const)("rechaza %s", (_, patch, code) => {
    expectError({ ...base, ...(patch as Partial<ProjectInput>) }, code);
  });

  it("una opción desactivada ya no se puede elegir", () => {
    const walls = optionId("walls", "concrete_block");
    const inactive = {
      ...rules,
      options: rules.options.map((o) => (o.id === walls ? { ...o, isActive: false } : o)),
    };
    expect(() => estimateProject(base, inactive)).toThrow(ProjectInputError);
  });
});

describe("recalcular un proyecto guardado", () => {
  const lot = SAMPLE_CATALOG.lots.find((l) => l.id === CHOLOMA_LOT)!;
  const saved = estimateProject({ ...base, landStatus: "buying_from_us", lotId: CHOLOMA_LOT }, rules);
  const storedInput: ProjectInput = {
    ...base,
    landStatus: "buying_from_us",
    lotId: CHOLOMA_LOT,
    ...saved.location,
    areaM2: saved.design.areaM2,
  };

  it("conserva el terreno apartado y su precio, aunque hoy ya no esté publicado o cambie de precio", () => {
    const today = {
      ...rules,
      lots: rules.lots.map((l) =>
        l.id === CHOLOMA_LOT ? { ...l, listingStatus: "reserved" as const, priceUsdCents: 1 } : l,
      ),
    };
    expect(() => estimateProject(storedInput, today)).toThrow(ProjectInputError);
    const result = estimateProject(storedInput, today, { lotPriceUsdCents: lot.priceUsdCents });
    expect(result.lotPriceUsdCents).toBe(lot.priceUsdCents);
    expect(result.totalUsdCents).toBe(saved.totalUsdCents);
  });

  it("conserva el diseño guardado aunque el modelo cambie o se retire del catálogo", () => {
    const today = {
      ...rules,
      models: rules.models.map((m) => (m.id === COPAN ? { ...m, areaM2: 200, isActive: false } : m)),
    };
    const result = estimateProject(storedInput, today, { lotPriceUsdCents: lot.priceUsdCents });
    expect(result.design.areaM2).toBe(saved.design.areaM2);
    expect(result.totalUsdCents).toBe(saved.totalUsdCents);
  });

  it("los materiales sí se calculan con los precios de hoy", () => {
    const walls = optionId("walls", "concrete_block");
    const today = {
      ...rules,
      options: rules.options.map((o) =>
        o.id === walls ? { ...o, unitPriceUsdCents: o.unitPriceUsdCents + 1_000 } : o,
      ),
    };
    const result = estimateProject(storedInput, today, { lotPriceUsdCents: lot.priceUsdCents });
    expect(result.totalUsdCents).toBeGreaterThan(saved.totalUsdCents);
  });
});

describe("selección de opciones", () => {
  it("las categorías de la etapa cambian con las plantas", () => {
    expect(userCategoriesOf("grey_work", 1)).toEqual(["walls"]);
    expect(userCategoriesOf("grey_work", 2)).toEqual(["walls", "upper_slab"]);
  });

  it("normalizar quita lo que no aplica y completa con los valores por defecto", () => {
    const two = normalizeOptionIds(SAMPLE_CATALOG.constructionOptions, base.optionIds, 2);
    expect(two).toContain(optionId("upper_slab", "solid_slab"));
    const backToOne = normalizeOptionIds(SAMPLE_CATALOG.constructionOptions, two, 1);
    expect(backToOne).not.toContain(optionId("upper_slab", "solid_slab"));
    expect(backToOne.sort()).toEqual([...base.optionIds].sort());
  });

  it("el precio de referencia de un modelo usa las opciones por defecto y factor 1", () => {
    const reference = modelReferenceEstimate(COPAN, rules)!;
    expect(reference.regionFactor).toBe(1);
    expect(reference.totalUsdCents).toBe(estimateProject(base, rules).totalUsdCents);
    expect(modelReferenceEstimate(TWO_FLOOR_MODEL, rules)!.design.floors).toBe(2);
    expect(modelReferenceEstimate("no-existe", rules)).toBeNull();
  });
});
