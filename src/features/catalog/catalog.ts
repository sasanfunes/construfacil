import type { Department, Municipality } from "@/features/geo/data";
import type {
  FinishLevel,
  PricingRules,
  QuoteExtra,
  RegionFactor,
  StageTemplate,
} from "@/features/quote/types";

import type { ExchangeRate, Home, HouseModel, Lot } from "./types";

/**
 * Todo lo público del catálogo en un solo objeto. Es pequeño (decenas de registros), así
 * que se carga completo, se cachea y se filtra en memoria con funciones puras.
 */
export type Catalog = {
  /** De dónde salen los datos. `sample` = datos de ejemplo, sin Supabase. */
  source: "supabase" | "sample";
  departments: Department[];
  municipalities: Municipality[];
  homes: Home[];
  lots: Lot[];
  models: HouseModel[];
  finishLevels: FinishLevel[];
  regionFactors: RegionFactor[];
  extras: QuoteExtra[];
  stages: StageTemplate[];
  initialPaymentPercent: number;
  exchangeRate: ExchangeRate;
};

export function pricingRulesFrom(catalog: Catalog): PricingRules {
  return {
    departments: catalog.departments,
    models: catalog.models,
    lots: catalog.lots,
    finishLevels: catalog.finishLevels,
    regionFactors: catalog.regionFactors,
    extras: catalog.extras,
    stages: catalog.stages,
    initialPaymentPercent: catalog.initialPaymentPercent,
  };
}

export function activeDepartments(catalog: Pick<Catalog, "departments">): Department[] {
  return catalog.departments.filter((d) => d.isActive);
}

export function municipalitiesOf(
  catalog: Pick<Catalog, "municipalities">,
  departmentId: number,
): Municipality[] {
  return catalog.municipalities.filter((m) => m.departmentId === departmentId);
}

/** Casas y terrenos que se muestran en el catálogo público, en su orden. */
export function listedHomes(catalog: Pick<Catalog, "homes">): Home[] {
  return catalog.homes
    .filter((h) => h.listingStatus === "published" || h.listingStatus === "reserved")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.priceUsdCents - b.priceUsdCents);
}

export function listedLots(catalog: Pick<Catalog, "lots">): Lot[] {
  return catalog.lots
    .filter((l) => l.listingStatus === "published" || l.listingStatus === "reserved")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.priceUsdCents - b.priceUsdCents);
}

export function activeModels(catalog: Pick<Catalog, "models">): HouseModel[] {
  return catalog.models.filter((m) => m.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
}
