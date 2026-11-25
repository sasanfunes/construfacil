import { activeDepartments, activeModels, projectRulesFrom, type Catalog } from "@/features/catalog/catalog";
import type { Municipality } from "@/features/geo/data";

import type { ProjectRules } from "./types";

/** Lo que necesita el onboarding en el navegador: solo lo público y activo, sin textos largos. */
export type ProjectWizardData = {
  rules: ProjectRules;
  municipalities: Municipality[];
  usdToHnl: number;
};

const EMPTY = { es: "", en: "" } as const;

export function toProjectWizardData(catalog: Catalog): ProjectWizardData {
  const departments = activeDepartments(catalog);
  const municipalities = catalog.municipalities.filter((m) =>
    departments.some((d) => d.id === m.departmentId),
  );
  const rules = projectRulesFrom(catalog);
  return {
    rules: {
      ...rules,
      departments,
      municipalities: municipalities.map(({ id, departmentId }) => ({ id, departmentId })),
      lots: catalog.lots
        .filter((l) => l.listingStatus === "published")
        .sort((a, b) => a.sortOrder - b.sortOrder || a.priceUsdCents - b.priceUsdCents)
        .map((l) => ({ ...l, description: EMPTY })),
      models: activeModels(catalog).map((m) => ({
        ...m,
        description: EMPTY,
        floorPlan: m.floorPlan.filter((r) => r.room === "carport"),
      })),
      options: catalog.constructionOptions.filter((o) => o.isActive),
    },
    municipalities,
    usdToHnl: catalog.exchangeRate.usdToHnl,
  };
}
