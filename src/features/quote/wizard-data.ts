import { activeDepartments, activeModels, type Catalog } from "@/features/catalog/catalog";
import type { HouseModel, Lot } from "@/features/catalog/types";
import type { Municipality } from "@/features/geo/data";

import type { PricingRules } from "./types";

/**
 * Lo que el cotizador necesita en el navegador: solo lo público y lo justo (sin
 * descripciones largas ni planos) para que la página cargue rápido con datos móviles.
 */
export type WizardData = {
  rules: PricingRules;
  municipalities: Municipality[];
  usdToHnl: number;
  exchangeRateDate: string;
};

export function toWizardData(catalog: Catalog): WizardData {
  const departments = activeDepartments(catalog);
  const lots: Lot[] = catalog.lots
    .filter((l) => l.listingStatus === "published")
    .map((l) => ({ ...l, description: { es: "", en: "" } }));
  const models: HouseModel[] = activeModels(catalog).map((m) => ({
    ...m,
    description: { es: "", en: "" },
    floorPlan: m.floorPlan.filter((r) => r.room === "carport"),
  }));
  return {
    rules: {
      departments,
      models,
      lots,
      finishLevels: [...catalog.finishLevels].sort((a, b) => a.sortOrder - b.sortOrder),
      regionFactors: catalog.regionFactors,
      extras: [...catalog.extras].sort((a, b) => a.sortOrder - b.sortOrder),
      stages: catalog.stages,
      initialPaymentPercent: catalog.initialPaymentPercent,
    },
    municipalities: catalog.municipalities.filter((m) => departments.some((d) => d.id === m.departmentId)),
    usdToHnl: catalog.exchangeRate.usdToHnl,
    exchangeRateDate: catalog.exchangeRate.effectiveDate,
  };
}
