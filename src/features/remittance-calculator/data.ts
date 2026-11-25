import {
  activeModels,
  listedHomes,
  listedLots,
  projectRulesFrom,
  type Catalog,
} from "@/features/catalog/catalog";
import type { Localized } from "@/features/catalog/types";
import { modelReferenceEstimate } from "@/features/projects/engine";
import { OPTION_STAGES, PRELIMINARY_STAGE, type ProjectEstimate } from "@/features/projects/types";

/** Departamento de referencia para la calculadora: Cortés (factor 1.0). */
const REFERENCE_DEPARTMENT = 5;

export type CalculatorData = {
  models: Array<{
    id: string;
    slug: string;
    name: Localized;
    quote: Pick<ProjectEstimate, "payments" | "stages" | "totalUsdCents">;
  }>;
  coveredByInitial: string[];
  /** Nombres de las etapas, ya traducidos. */
  stageNames: Record<string, string>;
  referenceDepartment: string;
  typicalLotUsdCents: number | null;
  typicalHomeUsdCents: number | null;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
  return Math.round(value / 10_000) * 10_000;
}

/**
 * Datos ya calculados en el servidor: el navegador solo simula el ahorro. Cada modelo se
 * calcula con las opciones por defecto y el factor de referencia (Cortés, 1.0).
 */
export function toCalculatorData(catalog: Catalog, stageName: (key: string) => string): CalculatorData {
  const rules = projectRulesFrom(catalog);
  const department =
    catalog.departments.find((d) => d.id === REFERENCE_DEPARTMENT && d.isActive) ??
    catalog.departments.find((d) => d.isActive);

  const models = activeModels(catalog).flatMap((model) => {
    const estimate = modelReferenceEstimate(model.id, rules);
    if (!estimate) return [];
    const { payments, stages, totalUsdCents } = estimate;
    return [{ id: model.id, slug: model.slug, name: model.name, quote: { payments, stages, totalUsdCents } }];
  });

  return {
    models,
    // El pago inicial cubre diseño y trámites.
    coveredByInitial: [PRELIMINARY_STAGE],
    stageNames: Object.fromEntries(OPTION_STAGES.map((key) => [key, stageName(key)])),
    referenceDepartment: department?.name ?? "",
    typicalLotUsdCents: median(
      listedLots(catalog)
        .filter((l) => l.listingStatus === "published")
        .map((l) => l.priceUsdCents),
    ),
    typicalHomeUsdCents: median(
      listedHomes(catalog)
        .filter((h) => h.listingStatus === "published")
        .map((h) => h.priceUsdCents),
    ),
  };
}
