/**
 * Constantes y utilidades de los formularios de captación, sin dependencias: los
 * componentes del navegador las importan de aquí para no cargar la librería de validación.
 * Los esquemas (schemas.ts) las usan para validar en el servidor.
 */

export const CONTACT_CHANNELS = ["whatsapp", "phone", "email"] as const;
export const TIME_SLOTS = ["morning", "afternoon", "evening"] as const;
export const LEAD_INTENTS = ["contact", "video_call", "reservation", "listing_inquiry"] as const;
export type LeadIntent = (typeof LEAD_INTENTS)[number];

export const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "PR",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
] as const;

/** Suma días a una fecha AAAA-MM-DD (en UTC, como `current_date` en la base). */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
