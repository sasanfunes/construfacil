/**
 * Genera `supabase/seed.sql` a partir de los datos de ejemplo de
 * `src/features/catalog/sample`. Así el sitio sin Supabase (modo ejemplo) y la base de
 * desarrollo muestran exactamente lo mismo.
 *
 *   pnpm db:seed          escribe el archivo
 *   pnpm db:seed --check  falla si el archivo no está al día (lo usa CI)
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { SAMPLE_CATALOG } from "../src/features/catalog/sample";
import {
  LEGACY_SAMPLE_EXTRAS,
  LEGACY_SAMPLE_FINISH_LEVELS,
  LEGACY_SAMPLE_STAGES,
} from "../src/features/catalog/sample/pricing";
import { MUNICIPALITIES } from "../src/features/geo/data";

type SqlValue = string | number | boolean | null | undefined | readonly string[] | { json: unknown };

function literal(value: SqlValue): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Número inválido: ${value}`);
    return String(value);
  }
  if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`;
  if (Array.isArray(value)) {
    return value.length === 0 ? "'{}'::text[]" : `array[${value.map((v) => literal(v)).join(", ")}]::text[]`;
  }
  return `${literal(JSON.stringify((value as { json: unknown }).json))}::jsonb`;
}

function insert(table: string, rows: ReadonlyArray<Record<string, SqlValue>>, conflict: string): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]!);
  const values = rows.map((row) => `  (${columns.map((c) => literal(row[c])).join(", ")})`).join(",\n");
  return `insert into public.${table} (${columns.join(", ")}) values\n${values}\non conflict (${conflict}) do nothing;\n`;
}

/** El id del municipio en la base sale de su nombre: no depende del orden de inserción. */
function municipalitySql(municipalityId: number): string {
  const m = MUNICIPALITIES.find((item) => item.id === municipalityId);
  if (!m) throw new Error(`Municipio ${municipalityId} desconocido`);
  return `(select id from public.municipalities where department_id = ${m.departmentId} and name = ${literal(m.name)})`;
}

function insertWithMunicipality(
  table: string,
  rows: ReadonlyArray<Record<string, SqlValue> & { municipality_id: number }>,
) {
  const columns = Object.keys(rows[0]!);
  const values = rows
    .map(
      (row) =>
        `  (${columns
          .map((c) =>
            c === "municipality_id" ? municipalitySql(row.municipality_id) : literal(row[c] as SqlValue),
          )
          .join(", ")})`,
    )
    .join(",\n");
  return `insert into public.${table} (${columns.join(", ")}) values\n${values}\non conflict (id) do nothing;\n`;
}

const c = SAMPLE_CATALOG;

const sections = [
  `-- =====================================================================================
-- DATOS DE EJEMPLO para desarrollo. No se cargan en producción.
-- Archivo GENERADO por \`pnpm db:seed\` desde src/features/catalog/sample. No editar a mano.
-- Todo lo que aparece aquí es un EJEMPLO y debe reemplazarse antes del lanzamiento.
-- =====================================================================================
`,
  `-- Tipo de cambio y ajustes
insert into public.exchange_rates (usd_to_hnl, effective_date, source, is_example)
select ${c.exchangeRate.usdToHnl}, date ${literal(c.exchangeRate.effectiveDate)}, 'Valor de ejemplo. Reemplazar por la tasa de referencia del Banco Central de Honduras.', true
where not exists (select 1 from public.exchange_rates);
`,
  insert(
    "app_settings",
    [
      {
        key: "payments.initial_payment_percent",
        value: { json: c.initialPaymentPercent },
        is_public: true,
        description: "EJEMPLO. Porcentaje del pago inicial al comprar una casa lista.",
      },
      {
        key: "company.legal_name",
        value: { json: "ConstruFácil (razón social por definir)" },
        is_public: true,
        description: "EJEMPLO. Razón social que aparece en el pie y en las páginas legales.",
      },
      {
        key: "company.support_hours",
        value: {
          json: { timezone: "America/Tegucigalpa", weekdays: "08:00-18:00", saturday: "08:00-12:00" },
        },
        is_public: true,
        description: "EJEMPLO. Horario de atención en hora de Honduras.",
      },
      {
        key: "sales.lead_notification_note",
        value: { json: "Uso interno del equipo de ventas." },
        is_public: false,
        description: "EJEMPLO de ajuste privado: solo lo ve el equipo.",
      },
    ],
    "key",
  ),
  "-- Legado del cotizador de la Fase 1: etapas, acabados y extras\n" +
    insert(
      "stage_templates",
      LEGACY_SAMPLE_STAGES.map((s) => ({
        key: s.key,
        name_es: s.name.es,
        name_en: s.name.en,
        description_es: s.description.es,
        description_en: s.description.en,
        sort_order: s.sortOrder,
        cost_share_bp: s.costShareBp,
        duration_share_bp: s.durationShareBp,
        covered_by_initial_payment: s.coveredByInitialPayment,
      })),
      "key",
    ),
  insert(
    "finish_levels",
    LEGACY_SAMPLE_FINISH_LEVELS.map((f) => ({
      id: f.id,
      key: f.key,
      name_es: f.name.es,
      name_en: f.name.en,
      description_es: f.description.es,
      description_en: f.description.en,
      includes_es: f.includes.es,
      includes_en: f.includes.en,
      price_multiplier: f.priceMultiplier,
      custom_price_per_m2_usd_cents: f.customPricePerM2UsdCents,
      sort_order: f.sortOrder,
    })),
    "id",
  ),
  "-- Factor de precio por departamento\n" +
    insert(
      "region_price_factors",
      c.regionFactors.map((r) => ({ department_id: r.departmentId, factor: r.factor })),
      "department_id",
    ),
  insert(
    "quote_extras",
    LEGACY_SAMPLE_EXTRAS.map((e) => ({
      id: e.id,
      key: e.key,
      name_es: e.name.es,
      name_en: e.name.en,
      description_es: e.description.es,
      description_en: e.description.en,
      pricing_unit: e.pricingUnit,
      unit_price_usd_cents: e.unitPriceUsdCents,
      min_quantity: e.minQuantity,
      max_quantity: e.maxQuantity,
      default_quantity: e.defaultQuantity,
      applies_region_factor: e.appliesRegionFactor,
      stage_key: e.stageKey,
      sort_order: e.sortOrder,
    })),
    "id",
  ),
  "-- Sistemas y materiales por etapa de obra\n" +
    insert(
      "construction_options",
      c.constructionOptions.map((o) => ({
        id: o.id,
        stage: o.stage,
        category: o.category,
        key: o.key,
        name_es: o.name.es,
        name_en: o.name.en,
        description_es: o.description.es,
        description_en: o.description.en,
        pricing_basis: o.pricingBasis,
        unit_price_usd_cents: o.unitPriceUsdCents,
        materials_share_bp: o.materialsShareBp,
        weeks_factor: o.weeksFactor,
        is_default: o.isDefault,
        is_active: o.isActive,
        is_example: o.isExample,
        sort_order: o.sortOrder,
      })),
      "id",
    ),
  "-- Modelos de casa\n" +
    insert(
      "house_models",
      c.models.map((m) => ({
        id: m.id,
        slug: m.slug,
        name_es: m.name.es,
        name_en: m.name.en,
        summary_es: m.summary.es,
        summary_en: m.summary.en,
        description_es: m.description.es,
        description_en: m.description.en,
        area_m2: m.areaM2,
        bedrooms: m.bedrooms,
        bathrooms: m.bathrooms,
        floors: m.floors,
        min_lot_area_m2: m.minLotAreaM2,
        min_lot_front_m: m.minLotFrontM,
        build_weeks: m.buildWeeks,
        base_price_usd_cents: m.basePriceUsdCents,
        floor_plan: { json: m.floorPlan },
        is_active: m.isActive,
        is_example: m.isExample,
        sort_order: m.sortOrder,
      })),
      "id",
    ),
  "-- Casas listas\n" +
    insertWithMunicipality(
      "homes",
      c.homes.map((h) => ({
        id: h.id,
        slug: h.slug,
        code: h.code,
        title_es: h.title.es,
        title_en: h.title.en,
        summary_es: h.summary.es,
        summary_en: h.summary.en,
        description_es: h.description.es,
        description_en: h.description.en,
        department_id: h.departmentId,
        municipality_id: h.municipalityId,
        neighborhood: h.neighborhood,
        latitude: h.latitude,
        longitude: h.longitude,
        construction_status: h.constructionStatus,
        listing_status: h.listingStatus,
        price_usd_cents: h.priceUsdCents,
        bedrooms: h.bedrooms,
        bathrooms: h.bathrooms,
        construction_area_m2: h.constructionAreaM2,
        lot_area_m2: h.lotAreaM2,
        floors: h.floors,
        parking_spaces: h.parkingSpaces,
        features: h.features,
        house_model_id: h.houseModelId,
        video_url: h.videoUrl,
        tour_url: h.tourUrl,
        estimated_delivery: h.estimatedDelivery,
        is_example: h.isExample,
        sort_order: h.sortOrder,
      })),
    ),
  "-- Terrenos\n" +
    insertWithMunicipality(
      "lots",
      c.lots.map((l) => ({
        id: l.id,
        slug: l.slug,
        code: l.code,
        title_es: l.title.es,
        title_en: l.title.en,
        summary_es: l.summary.es,
        summary_en: l.summary.en,
        description_es: l.description.es,
        description_en: l.description.en,
        department_id: l.departmentId,
        municipality_id: l.municipalityId,
        neighborhood: l.neighborhood,
        latitude: l.latitude,
        longitude: l.longitude,
        listing_status: l.listingStatus,
        price_usd_cents: l.priceUsdCents,
        area_m2: l.areaM2,
        front_m: l.frontM,
        depth_m: l.depthM,
        has_water: l.hasWater,
        has_electricity: l.hasElectricity,
        has_sewer: l.hasSewer,
        road_access: l.roadAccess,
        legal_status: l.legalStatus,
        topography: l.topography,
        is_example: l.isExample,
        sort_order: l.sortOrder,
      })),
    ),
];

const output = sections.join("\n");
const target = path.resolve(import.meta.dirname, "../supabase/seed.sql");

if (process.argv.includes("--check")) {
  const current = readFileSync(target, "utf8");
  if (current !== output) {
    console.error("supabase/seed.sql no está al día. Corre `pnpm db:seed` y vuelve a hacer commit.");
    process.exit(1);
  }
  console.log("supabase/seed.sql está al día.");
} else {
  writeFileSync(target, output);
  console.log(`Escrito ${path.relative(process.cwd(), target)}`);
}
