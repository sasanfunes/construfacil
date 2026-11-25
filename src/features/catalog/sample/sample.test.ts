import { describe, expect, it } from "vitest";

import { HOME_FEATURES } from "../types";

import { SAMPLE_CATALOG } from "./index";

/** Los datos de ejemplo terminan en la base: tienen que cumplir sus restricciones. */
describe("datos de ejemplo", () => {
  const { homes, lots, models, extras, stages, finishLevels, regionFactors, departments, municipalities } =
    SAMPLE_CATALOG;

  it("todo está marcado como ejemplo", () => {
    expect([...homes, ...lots, ...models].every((item) => item.isExample)).toBe(true);
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
    const ids = [...homes, ...lots, ...models, ...extras, ...finishLevels].map((item) => item.id);
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

  it("las etapas suman 100 % de costo y de tiempo", () => {
    expect(stages.reduce((sum, s) => sum + s.costShareBp, 0)).toBe(10_000);
    expect(stages.reduce((sum, s) => sum + s.durationShareBp, 0)).toBe(10_000);
  });
});
