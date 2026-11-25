import { z } from "@/lib/zod";

import type { Department, Municipality } from "@/features/geo/data";
import {
  OPTION_CATEGORIES,
  OPTION_CATEGORY_KEYS,
  PRICING_BASES,
  type ConstructionOption,
  type OptionCategory,
} from "@/features/projects/types";
import type { Tables } from "@/lib/supabase/database.types";

import {
  HOME_FEATURES,
  ROOM_TYPES,
  type ExchangeRate,
  type FloorPlanRoom,
  type Home,
  type HomeFeature,
  type HouseModel,
  type Lot,
  type RegionFactor,
} from "../types";

/**
 * Filas de Supabase → objetos del dominio. Funciones puras: se prueban sin base de datos.
 * Las columnas que se piden están en COLUMNS: la base da permisos por columna, así que
 * `select("*")` sería rechazado.
 */

export const COLUMNS = {
  departments: "id, iso_code, name, is_active, latitude, longitude",
  municipalities: "id, department_id, name, latitude, longitude",
  homes:
    "id, slug, code, title_es, title_en, summary_es, summary_en, description_es, description_en, department_id, municipality_id, neighborhood, latitude, longitude, construction_status, listing_status, price_usd_cents, bedrooms, bathrooms, construction_area_m2, lot_area_m2, floors, parking_spaces, features, house_model_id, video_url, tour_url, estimated_delivery, is_example, sort_order",
  lots: "id, slug, code, title_es, title_en, summary_es, summary_en, description_es, description_en, department_id, municipality_id, neighborhood, latitude, longitude, listing_status, price_usd_cents, area_m2, front_m, depth_m, has_water, has_electricity, has_sewer, road_access, legal_status, topography, is_example, sort_order",
  models:
    "id, slug, name_es, name_en, summary_es, summary_en, description_es, description_en, area_m2, bedrooms, bathrooms, floors, min_lot_area_m2, min_lot_front_m, build_weeks, base_price_usd_cents, floor_plan, is_active, is_example, sort_order",
  regionFactors: "department_id, factor",
  constructionOptions:
    "id, stage, category, key, name_es, name_en, description_es, description_en, pricing_basis, unit_price_usd_cents, materials_share_bp, weeks_factor, is_default, is_active, is_example, sort_order",
  exchangeRates: "usd_to_hnl, effective_date, is_example",
} as const;

/** Lo que se selecciona de cada tabla: todo menos las marcas de tiempo. */
type Row<T extends keyof TableOf> = Omit<Tables<TableOf[T]>, "created_at" | "updated_at">;
type TableOf = typeof TABLE_OF;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- solo se usa su tipo
const TABLE_OF = {
  departments: "departments",
  municipalities: "municipalities",
  homes: "homes",
  lots: "lots",
  models: "house_models",
  regionFactors: "region_price_factors",
  constructionOptions: "construction_options",
} as const;

/** PostgREST devuelve `numeric` como número, pero algunos proxies lo pasan como texto. */
const num = (value: number | string): number => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new TypeError(`Número inválido desde la base: ${value}`);
  return n;
};
const numOrNull = (value: number | string | null): number | null => (value === null ? null : num(value));

const floorPlanSchema = z.array(
  z.object({
    room: z.enum(ROOM_TYPES),
    areaM2: z.number().positive(),
    floor: z.number().int().min(1).max(5),
  }),
);

export function mapDepartment(row: Row<"departments">): Department {
  return {
    id: row.id,
    isoCode: row.iso_code,
    name: row.name,
    isActive: row.is_active,
    latitude: num(row.latitude),
    longitude: num(row.longitude),
  };
}

export function mapMunicipality(
  row: Pick<Row<"municipalities">, "id" | "department_id" | "name" | "latitude" | "longitude">,
): Municipality {
  return {
    id: row.id,
    departmentId: row.department_id,
    name: row.name,
    latitude: numOrNull(row.latitude),
    longitude: numOrNull(row.longitude),
  };
}

export function mapHome(row: Row<"homes">): Home {
  return {
    id: row.id,
    slug: row.slug,
    code: row.code,
    title: { es: row.title_es, en: row.title_en },
    summary: { es: row.summary_es, en: row.summary_en },
    description: { es: row.description_es, en: row.description_en },
    departmentId: row.department_id,
    municipalityId: row.municipality_id,
    neighborhood: row.neighborhood,
    latitude: numOrNull(row.latitude),
    longitude: numOrNull(row.longitude),
    listingStatus: row.listing_status,
    priceUsdCents: num(row.price_usd_cents),
    isExample: row.is_example,
    sortOrder: row.sort_order,
    constructionStatus: row.construction_status,
    bedrooms: row.bedrooms,
    bathrooms: num(row.bathrooms),
    constructionAreaM2: num(row.construction_area_m2),
    lotAreaM2: num(row.lot_area_m2),
    floors: row.floors,
    parkingSpaces: row.parking_spaces,
    // La base ya valida la lista; esto descarta lo desconocido si alguna vez cambia sin código.
    features: row.features.filter((f): f is HomeFeature => (HOME_FEATURES as readonly string[]).includes(f)),
    houseModelId: row.house_model_id,
    videoUrl: row.video_url,
    tourUrl: row.tour_url,
    estimatedDelivery: row.estimated_delivery,
  };
}

export function mapLot(row: Row<"lots">): Lot {
  return {
    id: row.id,
    slug: row.slug,
    code: row.code,
    title: { es: row.title_es, en: row.title_en },
    summary: { es: row.summary_es, en: row.summary_en },
    description: { es: row.description_es, en: row.description_en },
    departmentId: row.department_id,
    municipalityId: row.municipality_id,
    neighborhood: row.neighborhood,
    latitude: numOrNull(row.latitude),
    longitude: numOrNull(row.longitude),
    listingStatus: row.listing_status,
    priceUsdCents: num(row.price_usd_cents),
    isExample: row.is_example,
    sortOrder: row.sort_order,
    areaM2: num(row.area_m2),
    frontM: numOrNull(row.front_m),
    depthM: numOrNull(row.depth_m),
    hasWater: row.has_water,
    hasElectricity: row.has_electricity,
    hasSewer: row.has_sewer,
    roadAccess: row.road_access,
    legalStatus: row.legal_status,
    topography: row.topography,
  };
}

export function mapModel(row: Row<"models">): HouseModel {
  const plan = floorPlanSchema.safeParse(row.floor_plan);
  return {
    id: row.id,
    slug: row.slug,
    name: { es: row.name_es, en: row.name_en },
    summary: { es: row.summary_es, en: row.summary_en },
    description: { es: row.description_es, en: row.description_en },
    areaM2: num(row.area_m2),
    bedrooms: row.bedrooms,
    bathrooms: num(row.bathrooms),
    floors: row.floors,
    minLotAreaM2: num(row.min_lot_area_m2),
    minLotFrontM: numOrNull(row.min_lot_front_m),
    buildWeeks: row.build_weeks,
    basePriceUsdCents: num(row.base_price_usd_cents),
    // Un plano mal guardado no debe tumbar la página: se muestra sin plano.
    floorPlan: plan.success ? (plan.data as FloorPlanRoom[]) : [],
    isActive: row.is_active,
    isExample: row.is_example,
    sortOrder: row.sort_order,
  };
}

export function mapRegionFactor(row: Pick<Row<"regionFactors">, "department_id" | "factor">): RegionFactor {
  return { departmentId: row.department_id, factor: num(row.factor) };
}

/**
 * Opción de construcción. Una categoría desconocida (por ejemplo, agregada en la base sin
 * su traducción) se rechaza: el onboarding no sabría dónde mostrarla.
 */
export function mapConstructionOption(row: Row<"constructionOptions">): ConstructionOption {
  if (!(OPTION_CATEGORY_KEYS as readonly string[]).includes(row.category)) {
    throw new TypeError(`Categoría de opción desconocida: ${row.category}`);
  }
  const category = row.category as OptionCategory;
  if (OPTION_CATEGORIES[category].stage !== row.stage) {
    throw new TypeError(`La categoría ${row.category} no pertenece a la etapa ${row.stage}`);
  }
  if (!(PRICING_BASES as readonly string[]).includes(row.pricing_basis)) {
    throw new TypeError(`Base de precio desconocida: ${row.pricing_basis}`);
  }
  return {
    id: row.id,
    stage: row.stage,
    category,
    key: row.key,
    name: { es: row.name_es, en: row.name_en },
    description: { es: row.description_es, en: row.description_en },
    pricingBasis: row.pricing_basis,
    unitPriceUsdCents: num(row.unit_price_usd_cents),
    materialsShareBp: row.materials_share_bp,
    weeksFactor: num(row.weeks_factor),
    isDefault: row.is_default,
    isActive: row.is_active,
    isExample: row.is_example,
    sortOrder: row.sort_order,
  };
}

export function mapExchangeRate(
  row: Pick<Tables<"exchange_rates">, "usd_to_hnl" | "effective_date" | "is_example">,
): ExchangeRate {
  return { usdToHnl: num(row.usd_to_hnl), effectiveDate: row.effective_date, isExample: row.is_example };
}

/** Lee el porcentaje del pago inicial desde `app_settings` (un número entre 0 y 100). */
export function parseInitialPaymentPercent(value: unknown, fallback: number): number {
  const parsed = z.number().min(0).max(100).safeParse(value);
  return parsed.success ? parsed.data : fallback;
}
