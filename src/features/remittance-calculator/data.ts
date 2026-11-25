import {
  activeModels,
  listedHomes,
  listedLots,
  pricingRulesFrom,
  type Catalog,
} from "@/features/catalog/catalog";
import type { Localized } from "@/features/catalog/types";
import { calculateQuote } from "@/features/quote/engine";
import type { QuoteResult } from "@/features/quote/types";

/** Departamento de referencia para la calculadora: Cortés (factor 1.0). */
const REFERENCE_DEPARTMENT = 5;

export type CalculatorData = {
  models: Array<{
    id: string;
    slug: string;
    name: Localized;
    quote: Pick<QuoteResult, "payments" | "stages" | "totalUsdCents">;
  }>;
  coveredByInitial: string[];
  stageNames: Record<string, Localized>;
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

/** Datos ya calculados en el servidor: el navegador solo simula el ahorro. */
export function toCalculatorData(catalog: Catalog): CalculatorData {
  const rules = pricingRulesFrom(catalog);
  const department =
    catalog.departments.find((d) => d.id === REFERENCE_DEPARTMENT && d.isActive) ??
    catalog.departments.find((d) => d.isActive);
  const standard = catalog.finishLevels.find((f) => f.key === "standard") ?? catalog.finishLevels[0];

  const models =
    department && standard
      ? activeModels(catalog).map((model) => {
          const { payments, stages, totalUsdCents } = calculateQuote(
            {
              landStatus: "not_yet",
              lotId: null,
              departmentId: department.id,
              municipalityId: null,
              landAreaM2: null,
              design: { kind: "model", modelId: model.id },
              finishLevelId: standard.id,
              extras: [],
            },
            rules,
          );
          return {
            id: model.id,
            slug: model.slug,
            name: model.name,
            quote: { payments, stages, totalUsdCents },
          };
        })
      : [];

  return {
    models,
    coveredByInitial: catalog.stages.filter((s) => s.coveredByInitialPayment).map((s) => s.key),
    stageNames: Object.fromEntries(catalog.stages.map((s) => [s.key, s.name])),
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
