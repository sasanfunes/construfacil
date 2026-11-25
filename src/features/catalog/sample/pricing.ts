import type { Localized, RegionFactor } from "../types";

/**
 * EJEMPLO. Factor de precio por departamento (flete y mano de obra).
 *
 * El resto de este archivo es LEGADO del cotizador de la Fase 1 (acabados, extras y etapas):
 * ya no lo usa el sitio, pero sus tablas siguen en la base para las cotizaciones guardadas y
 * `pnpm db:seed` las sigue llenando con estos ejemplos.
 */

export type LegacyFinishLevel = {
  id: string;
  key: string;
  name: Localized;
  description: Localized;
  includes: Readonly<Record<"es" | "en", readonly string[]>>;
  priceMultiplier: number;
  customPricePerM2UsdCents: number;
  sortOrder: number;
};

export type LegacyQuoteExtra = {
  id: string;
  key: string;
  name: Localized;
  description: Localized;
  pricingUnit: "fixed" | "per_m2" | "per_linear_m" | "per_unit";
  unitPriceUsdCents: number;
  minQuantity: number;
  maxQuantity: number;
  defaultQuantity: number;
  appliesRegionFactor: boolean;
  stageKey: string;
  sortOrder: number;
};

export type LegacyStageTemplate = {
  key: string;
  name: Localized;
  description: Localized;
  sortOrder: number;
  costShareBp: number;
  durationShareBp: number;
  coveredByInitialPayment: boolean;
};

/** EJEMPLO. Pago inicial al comprar una casa lista (porcentaje del precio). */
export const SAMPLE_INITIAL_PAYMENT_PERCENT = 20;

export const LEGACY_SAMPLE_STAGES: LegacyStageTemplate[] = [
  {
    key: "permits",
    name: { es: "Trámites y diseño", en: "Permits and design" },
    description: {
      es: "Planos finales, permiso de construcción de la municipalidad y preparación del terreno.",
      en: "Final plans, the municipal building permit and site preparation.",
    },
    sortOrder: 1,
    costShareBp: 400,
    durationShareBp: 1200,
    coveredByInitialPayment: true,
  },
  {
    key: "foundation",
    name: { es: "Cimentación", en: "Foundation" },
    description: {
      es: "Trazo, excavación, zapatas y solera de fundación.",
      en: "Layout, excavation, footings and the foundation beam.",
    },
    sortOrder: 2,
    costShareBp: 1500,
    durationShareBp: 1300,
    coveredByInitialPayment: false,
  },
  {
    key: "walls",
    name: { es: "Paredes y estructura", en: "Walls and structure" },
    description: {
      es: "Paredes de bloque, columnas y vigas. Al terminar, la casa queda en obra gris.",
      en: "Block walls, columns and beams. When this stage ends, the shell of the house is done.",
    },
    sortOrder: 3,
    costShareBp: 2500,
    durationShareBp: 2000,
    coveredByInitialPayment: false,
  },
  {
    key: "roof",
    name: { es: "Techo", en: "Roof" },
    description: {
      es: "Estructura del techo o losa, cubierta e impermeabilización.",
      en: "Roof structure or slab, roofing and waterproofing.",
    },
    sortOrder: 4,
    costShareBp: 1500,
    durationShareBp: 1300,
    coveredByInitialPayment: false,
  },
  {
    key: "installations",
    name: { es: "Instalaciones", en: "Utilities" },
    description: {
      es: "Instalación eléctrica, agua potable, aguas negras y conexión a los servicios.",
      en: "Electrical wiring, drinking water, sewage and connection to public services.",
    },
    sortOrder: 5,
    costShareBp: 1400,
    durationShareBp: 1200,
    coveredByInitialPayment: false,
  },
  {
    key: "finishes",
    name: { es: "Acabados", en: "Finishes" },
    description: {
      es: "Pisos, repello y pintura, cielo falso, puertas, ventanas, cocina y baños.",
      en: "Floors, plaster and paint, drop ceilings, doors, windows, kitchen and bathrooms.",
    },
    sortOrder: 6,
    costShareBp: 2300,
    durationShareBp: 2600,
    coveredByInitialPayment: false,
  },
  {
    key: "delivery",
    name: { es: "Entrega", en: "Handover" },
    description: {
      es: "Limpieza final, revisión contigo o con tu familiar y entrega de llaves.",
      en: "Final cleaning, a walkthrough with you or your relative, and the keys.",
    },
    sortOrder: 7,
    costShareBp: 400,
    durationShareBp: 400,
    coveredByInitialPayment: false,
  },
];

export const LEGACY_SAMPLE_FINISH_LEVELS: LegacyFinishLevel[] = [
  {
    id: "d4000000-0000-4000-8000-000000000001",
    key: "basic",
    name: { es: "Básico", en: "Basic" },
    description: {
      es: "Una casa sólida y bien terminada, con materiales económicos y durables.",
      en: "A solid, well-finished home with affordable, durable materials.",
    },
    includes: {
      es: [
        "Piso de cerámica",
        "Paredes repelladas y pintadas",
        "Puertas de madera de pino",
        "Cocina con gabinetes básicos",
        "Sanitarios y grifería estándar",
      ],
      en: [
        "Ceramic tile floors",
        "Plastered and painted walls",
        "Pine wood doors",
        "Kitchen with basic cabinets",
        "Standard toilets and faucets",
      ],
    },
    priceMultiplier: 0.86,
    customPricePerM2UsdCents: 44_000,
    sortOrder: 1,
  },
  {
    id: "d4000000-0000-4000-8000-000000000002",
    key: "standard",
    name: { es: "Estándar", en: "Standard" },
    description: {
      es: "Lo que elige la mayoría: buenos materiales y detalles que se notan.",
      en: "What most people choose: good materials and details you notice.",
    },
    includes: {
      es: [
        "Piso de porcelanato",
        "Cielo falso de tablayeso",
        "Cocina con gabinetes y desayunador",
        "Ventanas de aluminio y vidrio",
        "Puertas de madera sólida",
      ],
      en: [
        "Porcelain tile floors",
        "Drywall drop ceilings",
        "Kitchen with cabinets and breakfast bar",
        "Aluminum and glass windows",
        "Solid wood doors",
      ],
    },
    priceMultiplier: 1,
    customPricePerM2UsdCents: 52_000,
    sortOrder: 2,
  },
  {
    id: "d4000000-0000-4000-8000-000000000003",
    key: "premium",
    name: { es: "Premium", en: "Premium" },
    description: {
      es: "Acabados de primera para una casa que luce y dura.",
      en: "Top-quality finishes for a home that looks great and lasts.",
    },
    includes: {
      es: [
        "Porcelanato de formato grande",
        "Cocina con isla y cubierta de granito",
        "Duchas con puerta de vidrio templado",
        "Iluminación LED empotrada",
        "Ventanas con vidrio doble",
      ],
      en: [
        "Large-format porcelain tile",
        "Kitchen island with granite countertop",
        "Showers with tempered glass doors",
        "Recessed LED lighting",
        "Double-glazed windows",
      ],
    },
    priceMultiplier: 1.32,
    customPricePerM2UsdCents: 69_000,
    sortOrder: 3,
  },
];

export const SAMPLE_REGION_FACTORS: RegionFactor[] = [
  { departmentId: 5, factor: 1 }, // Cortés: referencia
  { departmentId: 8, factor: 1.04 }, // Francisco Morazán
  { departmentId: 1, factor: 1.07 }, // Atlántida: más flete
  { departmentId: 3, factor: 0.97 }, // Comayagua
];

export const LEGACY_SAMPLE_EXTRAS: LegacyQuoteExtra[] = [
  {
    id: "e5000000-0000-4000-8000-000000000001",
    key: "perimeter_wall",
    name: { es: "Muro perimetral", en: "Perimeter wall" },
    description: {
      es: "Muro de bloque de 2.40 m de alto con columnas. Se cobra por metro lineal.",
      en: "2.40 m (8 ft) block wall with columns. Priced per linear meter.",
    },
    pricingUnit: "per_linear_m",
    unitPriceUsdCents: 9_500,
    minQuantity: 10,
    maxQuantity: 400,
    defaultQuantity: 60,
    appliesRegionFactor: true,
    stageKey: "walls",
    sortOrder: 1,
  },
  {
    id: "e5000000-0000-4000-8000-000000000002",
    key: "water_cistern",
    name: { es: "Cisterna de 5,000 litros", en: "5,000-liter cistern" },
    description: {
      es: "Cisterna enterrada para tener agua aunque falle el servicio.",
      en: "Underground cistern so you have water even when the service fails.",
    },
    pricingUnit: "fixed",
    unitPriceUsdCents: 190_000,
    minQuantity: 1,
    maxQuantity: 1,
    defaultQuantity: 1,
    appliesRegionFactor: true,
    stageKey: "foundation",
    sortOrder: 2,
  },
  {
    id: "e5000000-0000-4000-8000-000000000003",
    key: "elevated_tank",
    name: { es: "Tanque elevado con bomba", en: "Elevated tank with pump" },
    description: {
      es: "Tanque de 1,100 litros en alto y bomba para tener buena presión.",
      en: "1,100-liter elevated tank and pump for good water pressure.",
    },
    pricingUnit: "fixed",
    unitPriceUsdCents: 65_000,
    minQuantity: 1,
    maxQuantity: 1,
    defaultQuantity: 1,
    appliesRegionFactor: true,
    stageKey: "installations",
    sortOrder: 3,
  },
  {
    id: "e5000000-0000-4000-8000-000000000004",
    key: "solar_panels",
    name: { es: "Paneles solares de 3 kW", en: "3 kW solar panels" },
    description: {
      es: "Sistema conectado a la red para bajar el recibo de luz.",
      en: "Grid-tied system to lower the electricity bill.",
    },
    pricingUnit: "fixed",
    unitPriceUsdCents: 390_000,
    minQuantity: 1,
    maxQuantity: 1,
    defaultQuantity: 1,
    appliesRegionFactor: false,
    stageKey: "installations",
    sortOrder: 4,
  },
  {
    id: "e5000000-0000-4000-8000-000000000005",
    key: "water_heater",
    name: { es: "Calentador de agua solar", en: "Solar water heater" },
    description: {
      es: "Agua caliente en la ducha sin gastar electricidad.",
      en: "Hot showers without using electricity.",
    },
    pricingUnit: "fixed",
    unitPriceUsdCents: 85_000,
    minQuantity: 1,
    maxQuantity: 1,
    defaultQuantity: 1,
    appliesRegionFactor: false,
    stageKey: "installations",
    sortOrder: 5,
  },
  {
    id: "e5000000-0000-4000-8000-000000000006",
    key: "air_conditioning",
    name: { es: "Aire acondicionado", en: "Air conditioning" },
    description: {
      es: "Minisplit de 12,000 BTU instalado. Se cobra por unidad.",
      en: "12,000 BTU mini-split, installed. Priced per unit.",
    },
    pricingUnit: "per_unit",
    unitPriceUsdCents: 78_000,
    minQuantity: 1,
    maxQuantity: 6,
    defaultQuantity: 2,
    appliesRegionFactor: false,
    stageKey: "installations",
    sortOrder: 6,
  },
  {
    id: "e5000000-0000-4000-8000-000000000007",
    key: "covered_carport",
    name: { es: "Cochera techada", en: "Covered carport" },
    description: {
      es: "Espacio techado para un vehículo, con piso de concreto.",
      en: "Covered space for one vehicle with a concrete floor.",
    },
    pricingUnit: "fixed",
    unitPriceUsdCents: 280_000,
    minQuantity: 1,
    maxQuantity: 1,
    defaultQuantity: 1,
    appliesRegionFactor: true,
    stageKey: "roof",
    sortOrder: 7,
  },
  {
    id: "e5000000-0000-4000-8000-000000000008",
    key: "electric_gate",
    name: { es: "Portón eléctrico", en: "Electric gate" },
    description: {
      es: "Portón corredizo de metal con motor y dos controles.",
      en: "Sliding metal gate with motor and two remotes.",
    },
    pricingUnit: "fixed",
    unitPriceUsdCents: 145_000,
    minQuantity: 1,
    maxQuantity: 1,
    defaultQuantity: 1,
    appliesRegionFactor: true,
    stageKey: "finishes",
    sortOrder: 8,
  },
];
