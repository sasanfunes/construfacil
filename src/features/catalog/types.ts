import type { AppLocale } from "@/i18n/routing";

/** Texto guardado en ambos idiomas (columnas `*_es` y `*_en`). */
export type Localized = Readonly<Record<AppLocale, string>>;

export const LISTING_STATUSES = ["draft", "published", "reserved", "sold"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const CONSTRUCTION_STATUSES = ["ready", "under_construction", "presale"] as const;
export type ConstructionStatus = (typeof CONSTRUCTION_STATUSES)[number];

/** Debe coincidir con `private.is_valid_home_feature_list` en la migración. */
export const HOME_FEATURES = [
  "carport",
  "covered_garage",
  "patio",
  "garden",
  "terrace",
  "laundry_area",
  "service_room",
  "water_cistern",
  "elevated_tank",
  "solar_panels",
  "water_heater",
  "air_conditioning",
  "perimeter_wall",
  "electric_gate",
  "gated_community",
  "pool",
  "integrated_kitchen",
  "ceramic_floors",
  "walk_in_closet",
  "study",
] as const;
export type HomeFeature = (typeof HOME_FEATURES)[number];

export const LOT_LEGAL_STATUSES = ["full_title", "useful_domain", "title_in_process"] as const;
export type LotLegalStatus = (typeof LOT_LEGAL_STATUSES)[number];

export const ROAD_ACCESS = ["paved", "gravel", "dirt"] as const;
export type RoadAccess = (typeof ROAD_ACCESS)[number];

export const TOPOGRAPHIES = ["flat", "gentle_slope", "steep"] as const;
export type Topography = (typeof TOPOGRAPHIES)[number];

export const ROOM_TYPES = [
  "living_dining",
  "living",
  "dining",
  "kitchen",
  "laundry",
  "primary_bedroom",
  "bedroom",
  "bathroom",
  "half_bath",
  "hallway",
  "stairs",
  "carport",
  "terrace",
  "porch",
  "study",
  "service_room",
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export type FloorPlanRoom = { room: RoomType; areaM2: number; floor: number };

type Listing = {
  id: string;
  slug: string;
  code: string;
  title: Localized;
  summary: Localized;
  description: Localized;
  departmentId: number;
  municipalityId: number;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  listingStatus: ListingStatus;
  priceUsdCents: number;
  isExample: boolean;
  sortOrder: number;
};

export type Home = Listing & {
  constructionStatus: ConstructionStatus;
  bedrooms: number;
  bathrooms: number;
  constructionAreaM2: number;
  lotAreaM2: number;
  floors: number;
  parkingSpaces: number;
  features: HomeFeature[];
  houseModelId: string | null;
  videoUrl: string | null;
  tourUrl: string | null;
  /** Fecha ISO (AAAA-MM-DD). */
  estimatedDelivery: string | null;
};

export type Lot = Listing & {
  areaM2: number;
  frontM: number | null;
  depthM: number | null;
  hasWater: boolean;
  hasElectricity: boolean;
  hasSewer: boolean;
  roadAccess: RoadAccess;
  legalStatus: LotLegalStatus;
  topography: Topography;
};

export type HouseModel = {
  id: string;
  slug: string;
  name: Localized;
  summary: Localized;
  description: Localized;
  areaM2: number;
  bedrooms: number;
  bathrooms: number;
  floors: number;
  minLotAreaM2: number;
  minLotFrontM: number | null;
  buildWeeks: number;
  /** Precio con acabado estándar y factor de departamento 1.0. */
  basePriceUsdCents: number;
  floorPlan: FloorPlanRoom[];
  isActive: boolean;
  isExample: boolean;
  sortOrder: number;
};

/** Factor de precio por departamento (flete y mano de obra). 1.0 = referencia. */
export type RegionFactor = { departmentId: number; factor: number };

export type ExchangeRate = { usdToHnl: number; effectiveDate: string; isExample: boolean };
