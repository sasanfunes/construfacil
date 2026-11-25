import { z } from "zod";

import { routing } from "@/i18n/routing";

/**
 * Esquemas de los formularios de captación. Los mismos validan en el navegador (para
 * avisar al instante) y en el servidor (la única validación que cuenta).
 *
 * Los mensajes de error son llaves de traducción de `forms.errors`.
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

/** Deja solo dígitos (y el + inicial). "+1 (305) 555-0123" → "+13055550123". */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function isValidTimeZone(value: string): boolean {
  if (value.length > 64 || !/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Suma días a una fecha AAAA-MM-DD (en UTC, como `current_date` en la base). */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

/**
 * Letras (con tildes y diéresis), espacios, apóstrofo, punto y guion. El primer nombre va en el
 * saludo de los correos: sin esta regla, alguien podría escribir una URL como "nombre" y usar
 * nuestros correos de confirmación para mandar enlaces a la dirección de otra persona.
 */
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*$/u;

export const fullNameSchema = z
  .string({ error: "required" })
  .trim()
  .transform((value) => value.replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(2, { error: "nameTooShort" })
      .max(120, { error: "nameTooLong" })
      .regex(NAME_PATTERN, { error: "nameInvalid" }),
  );

export const emailSchema = z
  .string({ error: "required" })
  .trim()
  .toLowerCase()
  .max(254, { error: "emailInvalid" })
  .pipe(z.email({ error: "emailInvalid" }));

export const phoneSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .transform(normalizePhone)
    .pipe(z.string().regex(/^\+?\d{8,15}$/, { error: "phoneInvalid" }))
    .optional(),
);

export const localeSchema = z.enum(routing.locales).catch(routing.defaultLocale);

const contactShape = {
  fullName: fullNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  preferredChannel: z.enum(CONTACT_CHANNELS, { error: "required" }).default("whatsapp"),
  usState: z.preprocess(emptyToUndefined, z.enum(US_STATES).optional()),
  privacy: z.literal(true, { error: "privacyRequired" }),
};

function requirePhoneForCalls(
  value: { preferredChannel: (typeof CONTACT_CHANNELS)[number]; phone?: string | undefined },
  ctx: z.RefinementCtx,
) {
  if (value.preferredChannel !== "email" && !value.phone) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "phoneRequired" });
  }
}

export const contactInfoSchema = z.object(contactShape).superRefine(requirePhoneForCalls);
export type ContactInfo = z.infer<typeof contactInfoSchema>;

/** Videollamada: desde mañana y hasta 60 días, como exige la base. */
export function videoCallSchema(todayIso: string) {
  return z.object({
    date: z
      .string({ error: "required" })
      .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "dateInvalid" })
      .refine((d) => d >= addDays(todayIso, 1) && d <= addDays(todayIso, 60), { error: "dateOutOfRange" }),
    timeSlot: z.enum(TIME_SLOTS, { error: "required" }),
    timezone: z.string({ error: "required" }).refine(isValidTimeZone, { error: "timezoneInvalid" }),
  });
}
export type VideoCallInput = z.infer<ReturnType<typeof videoCallSchema>>;

const uuid = z.preprocess(emptyToUndefined, z.uuid().optional());

export function leadRequestSchema(todayIso: string) {
  return z
    .object({
      ...contactShape,
      intent: z.enum(LEAD_INTENTS).catch("contact"),
      message: z.preprocess(
        emptyToUndefined,
        z.string().trim().max(2000, { error: "messageTooLong" }).optional(),
      ),
      homeId: uuid,
      lotId: uuid,
      modelId: uuid,
      wantsCall: z.preprocess((v) => v === "on" || v === true, z.boolean()),
      videoCall: videoCallSchema(todayIso).optional(),
    })
    .superRefine(requirePhoneForCalls)
    .superRefine((value, ctx) => {
      if ((value.intent === "video_call" || value.wantsCall) && !value.videoCall) {
        ctx.addIssue({ code: "custom", path: ["videoCall", "date"], message: "required" });
      }
    });
}
export type LeadRequest = z.infer<ReturnType<typeof leadRequestSchema>>;

/** Lee un FormData de los formularios de captación como objeto plano para el esquema. */
export function leadRequestFromFormData(formData: FormData): Record<string, unknown> {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };
  const wantsCall = text("wantsCall") === "on" || text("intent") === "video_call";
  return {
    fullName: text("fullName"),
    email: text("email"),
    phone: text("phone"),
    preferredChannel: text("preferredChannel"),
    usState: text("usState"),
    privacy: text("privacy") === "on",
    intent: text("intent"),
    message: text("message"),
    homeId: text("homeId"),
    lotId: text("lotId"),
    modelId: text("modelId"),
    wantsCall,
    videoCall: wantsCall
      ? { date: text("callDate"), timeSlot: text("callTimeSlot"), timezone: text("callTimezone") }
      : undefined,
  };
}

/** Primer error de cada campo, con la ruta en notación de punto ("videoCall.date"). */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in result)) result[key] = /^[a-zA-Z]+$/.test(issue.message) ? issue.message : "invalid";
  }
  return result;
}
