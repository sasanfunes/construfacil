import { describe, expect, it } from "vitest";

import { OPTION_CATEGORIES, OPTION_CATEGORY_KEYS } from "@/features/projects/types";

import { HOME_FEATURES } from "../types";

import { SAMPLE_CATALOG } from "./index";
import { LEGACY_SAMPLE_EXTRAS, LEGACY_SAMPLE_FINISH_LEVELS, LEGACY_SAMPLE_STAGES } from "./pricing";

/** Los datos de ejemplo terminan en la base: tienen que cumplir sus restricciones. */
describe("datos de ejemplo", () => {
  const { homes, lots, models, constructionOptions, regionFactors, departments, municipalities } =
    SAMPLE_CATALOG;
  const extras = LEGACY_SAMPLE_EXTRAS;
  const stages = LEGACY_SAMPLE_STAGES;
  const finishLevels = LEGACY_SAMPLE_FINISH_LEVELS;

  it("todo está marcado como ejemplo", () => {
    expect([...homes, ...lots, ...models, ...constructionOptions].every((item) => item.isExample)).toBe(true);
    expect(SAMPLE_CATALOG.exchangeRate.isExample).toBe(true);
  });

  it("slugs, códigos e ids son únicos y con formato válido", () => {
    for (const list of [homes, lots, models]) {
      const slugs = list.map((item) => item.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(new Set(homes.map((h) => h.code)).size).toBe(homes.length);
    for (const h of homes) expect(h.code).toMatch(/^CF-C-\d{3,5}$/);
    for (const l of lots) expect(l.code).toMatch(/^CF-T-\d{3,5}$/);
    const ids = [...homes, ...lots, ...models, ...extras, ...finishLevels, ...constructionOptions].map(
      (item) => item.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids)
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("cada casa y terreno está en un municipio de su departamento, en un departamento activo", () => {
    for (const item of [...homes, ...lots]) {
      const municipality = municipalities.find((m) => m.id === item.municipalityId);
      expect(municipality?.departmentId, item.slug).toBe(item.departmentId);
      expect(departments.find((d) => d.id === item.departmentId)?.isActive, item.slug).toBe(true);
    }
  });

  it("textos dentro de los límites de la base", () => {
    for (const item of [...homes, ...lots]) {
      for (const locale of ["es", "en"] as const) {
        expect(item.title[locale].length, item.slug).toBeLessThanOrEqual(120);
        expect(item.summary[locale].length, item.slug).toBeLessThanOrEqual(300);
        expect(item.description[locale].length, item.slug).toBeLessThanOrEqual(4000);
      }
    }
  });

  it("las características de las casas son conocidas", () => {
    for (const home of homes) {
      for (const feature of home.features) expect(HOME_FEATURES, home.slug).toContain(feature);
    }
  });

  it("los planos suman la superficie del modelo", () => {
    for (const model of models) {
      const total = model.floorPlan.reduce((sum, room) => sum + room.areaM2, 0);
      expect(total, model.slug).toBeCloseTo(model.areaM2, 5);
      expect(Math.max(...model.floorPlan.map((r) => r.floor)), model.slug).toBe(model.floors);
    }
  });

  it("cada casa hecha con un modelo apunta a un modelo que existe", () => {
    for (const home of homes.filter((h) => h.houseModelId)) {
      expect(
        models.some((m) => m.id === home.houseModelId),
        home.slug,
      ).toBe(true);
    }
  });

  it("cada departamento activo tiene factor de precio y cada extra una etapa", () => {
    for (const department of departments.filter((d) => d.isActive)) {
      expect(
        regionFactors.some((r) => r.departmentId === department.id),
        department.name,
      ).toBe(true);
    }
    for (const extra of extras)
      expect(
        stages.some((s) => s.key === extra.stageKey),
        extra.key,
      ).toBe(true);
  });

  it("cada categoría de opciones tiene al menos una opción y, si la elige el cliente, una por defecto", () => {
    for (const category of OPTION_CATEGORY_KEYS) {
      const options = constructionOptions.filter((o) => o.category === category);
      expect(options.length, category).toBeGreaterThan(0);
      for (const option of options) expect(option.stage, option.key).toBe(OPTION_CATEGORIES[category].stage);
      if (OPTION_CATEGORIES[category].choice === "user") {
        expect(options.filter((o) => o.isDefault).length, category).toBe(1);
      } else {
        expect(options.filter((o) => o.isDefault).length, category).toBe(0);
      }
    }
    const keys = constructionOptions.map((o) => `${o.category}/${o.key}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const option of constructionOptions) {
      expect(option.key).toMatch(/^[a-z][a-z_]{1,39}$/);
      expect(option.materialsShareBp).toBeGreaterThanOrEqual(0);
      expect(option.materialsShareBp).toBeLessThanOrEqual(10_000);
      for (const locale of ["es", "en"] as const) {
        expect(option.name[locale].length, option.key).toBeLessThanOrEqual(80);
        expect(option.description[locale].length, option.key).toBeLessThanOrEqual(300);
      }
    }
  });

  it("legado: las etapas del cotizador anterior suman 100 % de costo y de tiempo", () => {
    expect(stages.reduce((sum, s) => sum + s.costShareBp, 0)).toBe(10_000);
    expect(stages.reduce((sum, s) => sum + s.durationShareBp, 0)).toBe(10_000);
  });
});
