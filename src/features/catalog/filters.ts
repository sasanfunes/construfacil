import { z } from "zod";

import { CONSTRUCTION_STATUSES, type Home, type Lot } from "./types";

/**
 * Filtros del catálogo. Llegan en la URL (formularios GET: funcionan sin JavaScript y se
 * pueden compartir por WhatsApp). Un valor inválido se ignora en vez de dar error: un
 * enlace viejo o mal copiado debe seguir mostrando casas.
 */

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function pick<T>(schema: z.ZodType<T>, value: string | undefined): T | undefined {
  if (value === undefined) return undefined;
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

const id = z.coerce.number().int().positive().max(100_000);
const dollars = z.coerce.number().int().nonnegative().max(10_000_000);
const count = z.coerce.number().int().min(1).max(10);
const area = z.coerce.number().positive().max(1_000_000);
const flag = z.enum(["1", "true", "on"]).transform(() => true as const);

export const CATALOG_VIEWS = ["list", "map"] as const;
export type CatalogView = (typeof CATALOG_VIEWS)[number];

export type HomeFilters = {
  department?: number;
  city?: number;
  minPrice?: number;
  maxPrice?: number;
  beds?: number;
  baths?: number;
  status?: Home["constructionStatus"];
  minArea?: number;
  view: CatalogView;
};

export type LotFilters = {
  department?: number;
  city?: number;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  water?: true;
  electricity?: true;
  sewer?: true;
  paved?: true;
  clearTitle?: true;
  view: CatalogView;
};

export function parseHomeFilters(params: SearchParams): HomeFilters {
  return {
    department: pick(id, first(params.department)),
    city: pick(id, first(params.city)),
    minPrice: pick(dollars, first(params.minPrice)),
    maxPrice: pick(dollars, first(params.maxPrice)),
    beds: pick(count, first(params.beds)),
    baths: pick(count, first(params.baths)),
    status: pick(z.enum(CONSTRUCTION_STATUSES), first(params.status)),
    minArea: pick(area, first(params.minArea)),
    view: pick(z.enum(CATALOG_VIEWS), first(params.view)) ?? "list",
  };
}

export function parseLotFilters(params: SearchParams): LotFilters {
  return {
    department: pick(id, first(params.department)),
    city: pick(id, first(params.city)),
    minPrice: pick(dollars, first(params.minPrice)),
    maxPrice: pick(dollars, first(params.maxPrice)),
    minArea: pick(area, first(params.minArea)),
    water: pick(flag, first(params.water)),
    electricity: pick(flag, first(params.electricity)),
    sewer: pick(flag, first(params.sewer)),
    paved: pick(flag, first(params.paved)),
    clearTitle: pick(flag, first(params.clearTitle)),
    view: pick(z.enum(CATALOG_VIEWS), first(params.view)) ?? "list",
  };
}

function inPriceRange(priceUsdCents: number, min?: number, max?: number): boolean {
  if (min !== undefined && priceUsdCents < min * 100) return false;
  if (max !== undefined && max > 0 && priceUsdCents > max * 100) return false;
  return true;
}

function inLocation(
  item: { departmentId: number; municipalityId: number },
  department?: number,
  city?: number,
) {
  if (department !== undefined && item.departmentId !== department) return false;
  if (city !== undefined && item.municipalityId !== city) return false;
  return true;
}

export function filterHomes(homes: readonly Home[], filters: HomeFilters): Home[] {
  return homes.filter(
    (home) =>
      inLocation(home, filters.department, filters.city) &&
      inPriceRange(home.priceUsdCents, filters.minPrice, filters.maxPrice) &&
      (filters.beds === undefined || home.bedrooms >= filters.beds) &&
      (filters.baths === undefined || home.bathrooms >= filters.baths) &&
      (filters.status === undefined || home.constructionStatus === filters.status) &&
      (filters.minArea === undefined || home.constructionAreaM2 >= filters.minArea),
  );
}

export function filterLots(lots: readonly Lot[], filters: LotFilters): Lot[] {
  return lots.filter(
    (lot) =>
      inLocation(lot, filters.department, filters.city) &&
      inPriceRange(lot.priceUsdCents, filters.minPrice, filters.maxPrice) &&
      (filters.minArea === undefined || lot.areaM2 >= filters.minArea) &&
      (!filters.water || lot.hasWater) &&
      (!filters.electricity || lot.hasElectricity) &&
      (!filters.sewer || lot.hasSewer) &&
      (!filters.paved || lot.roadAccess === "paved") &&
      (!filters.clearTitle || lot.legalStatus === "full_title"),
  );
}

/** Cuántos filtros hay activos (sin contar la vista), para el botón "Filtros (3)". */
export function activeFilterCount(filters: HomeFilters | LotFilters): number {
  return Object.entries(filters).filter(([key, value]) => key !== "view" && value !== undefined).length;
}

/** Vuelve a armar los parámetros de la URL (p. ej. para cambiar de vista sin perder filtros). */
export function toSearchParams(filters: HomeFilters | LotFilters, overrides: Record<string, string> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || (key === "view" && value === "list")) continue;
    params.set(key, value === true ? "1" : String(value));
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (key === "view" && value === "list") params.delete("view");
    else params.set(key, value);
  }
  return params;
}
