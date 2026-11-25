import type { Json } from "@/lib/supabase/database.types";

import type { NewProject, ProjectUpdate } from "./store";
import type { ProjectEstimate } from "./types";

/**
 * Lo que se manda a submit_project() y update_project_selections(), armado solo con valores que
 * calculó el servidor. Sin dependencias de servidor: los tests de RLS lo usan para mandar
 * proyectos con montos reales.
 */
export const BREAKDOWN_VERSION = 1;

export function projectPayload(project: NewProject | (ProjectUpdate & { tokenHash?: string })): Json {
  const { input, estimate, usdToHnl } = project;
  const base = {
    preliminary_usd_cents: estimate.preliminaryUsdCents,
    construction_usd_cents: estimate.constructionUsdCents,
    total_usd_cents: estimate.totalUsdCents,
    duration_weeks: estimate.durationWeeks,
    breakdown: { version: BREAKDOWN_VERSION, input, estimate } as unknown as Json,
    usd_to_hnl: usdToHnl,
  };
  if (!("name" in project)) return base;
  return {
    ...base,
    access_token_hash: project.tokenHash,
    name: project.name,
    locale: project.locale,
    land_status: input.landStatus,
    lot_id: input.lotId,
    department_id: input.departmentId,
    municipality_id: input.municipalityId,
    land_area_m2: input.landAreaM2,
    design_source: estimate.design.source,
    house_model_id: estimate.design.houseModelId,
    area_m2: estimate.design.areaM2,
    floors: estimate.design.floors,
    bedrooms: estimate.design.bedrooms,
    bathrooms: estimate.design.bathrooms,
    lot_price_usd_cents: estimate.lotPriceUsdCents,
  };
}

export function selectionsPayload(estimate: ProjectEstimate): Json {
  return estimate.lines.map((line) => ({
    category: line.category,
    option_id: line.optionId,
    quantity: line.quantity,
    unit_price_usd_cents: line.unitPriceUsdCents,
    total_usd_cents: line.totalUsdCents,
    materials_usd_cents: line.materialsUsdCents,
  }));
}
