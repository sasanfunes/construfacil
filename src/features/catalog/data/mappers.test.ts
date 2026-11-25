import { describe, expect, it } from "vitest";

import { SAMPLE_CATALOG } from "../sample";

import { COLUMNS, mapExtra, mapHome, mapLot, mapModel, parseInitialPaymentPercent } from "./mappers";

const home = SAMPLE_CATALOG.homes[0]!;
const lot = SAMPLE_CATALOG.lots[0]!;
const model = SAMPLE_CATALOG.models[1]!;

/** Así llega una casa desde PostgREST (los `numeric` a veces como texto). */
const homeRow = {
  id: home.id,
  slug: home.slug,
  code: home.code,
  title_es: home.title.es,
  title_en: home.title.en,
  summary_es: home.summary.es,
  summary_en: home.summary.en,
  description_es: home.description.es,
  description_en: home.description.en,
  department_id: home.departmentId,
  municipality_id: home.municipalityId,
  neighborhood: home.neighborhood,
  latitude: home.latitude,
  longitude: home.longitude,
  construction_status: home.constructionStatus,
  listing_status: home.listingStatus,
  price_usd_cents: home.priceUsdCents,
  bedrooms: home.bedrooms,
  bathrooms: home.bathrooms,
  construction_area_m2: String(home.constructionAreaM2) as unknown as number,
  lot_area_m2: home.lotAreaM2,
  floors: home.floors,
  parking_spaces: home.parkingSpaces,
  features: [...home.features],
  house_model_id: home.houseModelId,
  video_url: home.videoUrl,
  tour_url: home.tourUrl,
  estimated_delivery: home.estimatedDelivery,
  is_example: home.isExample,
  sort_order: home.sortOrder,
};

describe("mapeo de filas de Supabase", () => {
  it("una casa vuelve idéntica, aunque un numeric llegue como texto", () => {
    expect(mapHome(homeRow)).toEqual(home);
  });

  it("descarta características desconocidas en vez de fallar", () => {
    expect(mapHome({ ...homeRow, features: ["patio", "helipuerto"] }).features).toEqual(["patio"]);
  });

  it("un terreno vuelve idéntico", () => {
    expect(
      mapLot({
        id: lot.id,
        slug: lot.slug,
        code: lot.code,
        title_es: lot.title.es,
        title_en: lot.title.en,
        summary_es: lot.summary.es,
        summary_en: lot.summary.en,
        description_es: lot.description.es,
        description_en: lot.description.en,
        department_id: lot.departmentId,
        municipality_id: lot.municipalityId,
        neighborhood: lot.neighborhood,
        latitude: lot.latitude,
        longitude: lot.longitude,
        listing_status: lot.listingStatus,
        price_usd_cents: lot.priceUsdCents,
        area_m2: lot.areaM2,
        front_m: lot.frontM,
        depth_m: lot.depthM,
        has_water: lot.hasWater,
        has_electricity: lot.hasElectricity,
        has_sewer: lot.hasSewer,
        road_access: lot.roadAccess,
        legal_status: lot.legalStatus,
        topography: lot.topography,
        is_example: lot.isExample,
        sort_order: lot.sortOrder,
      }),
    ).toEqual(lot);
  });

  const modelRow = {
    id: model.id,
    slug: model.slug,
    name_es: model.name.es,
    name_en: model.name.en,
    summary_es: model.summary.es,
    summary_en: model.summary.en,
    description_es: model.description.es,
    description_en: model.description.en,
    area_m2: model.areaM2,
    bedrooms: model.bedrooms,
    bathrooms: model.bathrooms,
    floors: model.floors,
    min_lot_area_m2: model.minLotAreaM2,
    min_lot_front_m: model.minLotFrontM,
    build_weeks: model.buildWeeks,
    base_price_usd_cents: model.basePriceUsdCents,
    floor_plan: model.floorPlan,
    is_active: model.isActive,
    is_example: model.isExample,
    sort_order: model.sortOrder,
  };

  it("un modelo vuelve idéntico, y un plano corrupto se descarta sin romper la página", () => {
    expect(mapModel(modelRow)).toEqual(model);
    expect(mapModel({ ...modelRow, floor_plan: [{ room: "sotano_secreto", areaM2: -1 }] }).floorPlan).toEqual(
      [],
    );
  });

  it("rechaza unidades de precio desconocidas y números que no son números", () => {
    const extra = SAMPLE_CATALOG.extras[0]!;
    const row = {
      id: extra.id,
      key: extra.key,
      name_es: extra.name.es,
      name_en: extra.name.en,
      description_es: extra.description.es,
      description_en: extra.description.en,
      pricing_unit: extra.pricingUnit,
      unit_price_usd_cents: extra.unitPriceUsdCents,
      min_quantity: extra.minQuantity,
      max_quantity: extra.maxQuantity,
      default_quantity: extra.defaultQuantity,
      applies_region_factor: extra.appliesRegionFactor,
      stage_key: extra.stageKey,
      is_active: true,
      sort_order: extra.sortOrder,
    };
    expect(mapExtra(row)).toEqual(extra);
    expect(() => mapExtra({ ...row, pricing_unit: "por_saco" as never })).toThrow(TypeError);
    expect(() => mapExtra({ ...row, unit_price_usd_cents: "mucho" as unknown as number })).toThrow(TypeError);
  });

  it("el porcentaje de pago inicial cae al valor por defecto si el ajuste es raro", () => {
    expect(parseInitialPaymentPercent(25, 20)).toBe(25);
    expect(parseInitialPaymentPercent("25", 20)).toBe(20);
    expect(parseInitialPaymentPercent(150, 20)).toBe(20);
    expect(parseInitialPaymentPercent(undefined, 20)).toBe(20);
  });

  it("nunca se piden columnas internas ni select *", () => {
    for (const columns of Object.values(COLUMNS)) {
      expect(columns).not.toContain("*");
      expect(columns).not.toMatch(/created_by|updated_by|assigned_by|stripe|token/);
    }
  });
});
