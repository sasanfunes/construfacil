import type { Department, Municipality } from "@/features/geo/data";
import type { ConstructionOption, ProjectRules } from "@/features/projects/types";

import type { ExchangeRate, Home, HouseModel, Lot, RegionFactor } from "./types";

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
  regionFactors: RegionFactor[];
  /** Sistemas y materiales por etapa de obra (proyectos de "Construir"). */
  constructionOptions: ConstructionOption[];
  /** Pago inicial al comprar una casa lista, en % del precio. */
  initialPaymentPercent: number;
  exchangeRate: ExchangeRate;
};

/** Reglas del cálculo de un proyecto de construcción. */
export function projectRulesFrom(catalog: Catalog): ProjectRules {
  return {
    departments: catalog.departments,
    municipalities: catalog.municipalities,
    lots: catalog.lots,
    models: catalog.models,
    regionFactors: catalog.regionFactors,
    options: catalog.constructionOptions,
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
