import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

import type { Catalog } from "../catalog";
import { SAMPLE_CATALOG } from "../sample";

import {
  COLUMNS,
  mapConstructionOption,
  mapDepartment,
  mapExchangeRate,
  mapHome,
  mapLot,
  mapModel,
  mapMunicipality,
  mapRegionFactor,
  parseInitialPaymentPercent,
} from "./mappers";

export const CATALOG_CACHE_TAG = "catalog";

/**
 * Catálogo completo y reglas de precio. Se cachea unos minutos y se comparte entre todas
 * las páginas. Cuando el admin cambie algo (Fase 2) se invalida con
 * `revalidateTag(CATALOG_CACHE_TAG)`.
 *
 * Se lee como visitante (llave pública, sin sesión): el RLS decide qué es público.
 */
export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_CACHE_TAG);

  if (!isSupabaseConfigured()) return SAMPLE_CATALOG;
  return loadFromSupabase();
}

function unwrap<T>(label: string, result: { data: T | null; error: { message: string } | null }): T {
  if (result.error || result.data === null) {
    throw new Error(`No se pudo leer ${label} del catálogo: ${result.error?.message ?? "sin datos"}`);
  }
  return result.data;
}

async function loadFromSupabase(): Promise<Catalog> {
  const db = createSupabaseAnonClient();

  const [departments, municipalities, homes, lots, models, regionFactors, options, rates, setting] =
    await Promise.all([
      db.from("departments").select(COLUMNS.departments).order("id"),
      db.from("municipalities").select(COLUMNS.municipalities).order("id"),
      db.from("homes").select(COLUMNS.homes),
      db.from("lots").select(COLUMNS.lots),
      db.from("house_models").select(COLUMNS.models),
      db.from("region_price_factors").select(COLUMNS.regionFactors),
      db.from("construction_options").select(COLUMNS.constructionOptions).order("sort_order"),
      db
        .from("exchange_rates")
        .select(COLUMNS.exchangeRates)
        .order("effective_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1),
      db
        .from("app_settings")
        .select("key, value")
        .eq("key", "payments.initial_payment_percent")
        .maybeSingle(),
    ]);

  const rate = unwrap("el tipo de cambio", rates)[0];
  if (!rate) throw new Error("No hay tipo de cambio cargado en exchange_rates.");

  return {
    source: "supabase",
    departments: unwrap("departamentos", departments).map(mapDepartment),
    municipalities: unwrap("municipios", municipalities).map(mapMunicipality),
    homes: unwrap("casas", homes).map(mapHome),
    lots: unwrap("terrenos", lots).map(mapLot),
    models: unwrap("modelos", models).map(mapModel),
    regionFactors: unwrap("factores por departamento", regionFactors).map(mapRegionFactor),
    constructionOptions: unwrap("opciones de construcción", options).map(mapConstructionOption),
    initialPaymentPercent: parseInitialPaymentPercent(setting.data?.value, 20),
    exchangeRate: mapExchangeRate(rate),
  };
}
