import { DEPARTMENTS, MUNICIPALITIES } from "@/features/geo/data";

import type { Catalog } from "../catalog";

import { SAMPLE_CONSTRUCTION_OPTIONS } from "./construction";
import { SAMPLE_HOMES, SAMPLE_LOTS } from "./listings";
import { SAMPLE_MODELS } from "./models";
import { SAMPLE_INITIAL_PAYMENT_PERCENT, SAMPLE_REGION_FACTORS } from "./pricing";

/**
 * Catálogo de EJEMPLO. Se usa cuando no hay Supabase configurado (desarrollo, CI y pruebas
 * de punta a punta) y es la fuente de `supabase/seed.sql` (`pnpm db:seed`).
 * En producción nunca se usa: sin Supabase el sitio no arranca.
 */
export const SAMPLE_CATALOG: Catalog = {
  source: "sample",
  departments: [...DEPARTMENTS],
  municipalities: [...MUNICIPALITIES],
  homes: SAMPLE_HOMES,
  lots: SAMPLE_LOTS,
  models: SAMPLE_MODELS,
  regionFactors: SAMPLE_REGION_FACTORS,
  constructionOptions: SAMPLE_CONSTRUCTION_OPTIONS,
  initialPaymentPercent: SAMPLE_INITIAL_PAYMENT_PERCENT,
  exchangeRate: { usdToHnl: 26.5, effectiveDate: "2026-11-01", isExample: true },
};
