import { z } from "@/lib/zod";

import { HONEYPOT_FIELD, STARTED_AT_FIELD } from "@/features/leads/bot-check";
import { contactInfoSchema, localeSchema } from "@/features/leads/schemas";

import { normalizeProjectName, projectNameError } from "./names";
import {
  CUSTOM_AREA_MAX_M2,
  CUSTOM_AREA_MIN_M2,
  DESIGN_SOURCES,
  LAND_STATUSES,
  MAX_BATHROOMS,
  MAX_BEDROOMS,
  PROJECT_REQUEST_KINDS,
} from "./types";

/** Nombre del proyecto: la regla vive en names.ts para que el onboarding la use sin Zod. */
export const projectNameSchema = z
  .string({ error: "required" })
  .transform(normalizeProjectName)
  .superRefine((value, context) => {
    const error = projectNameError(value);
    if (error) context.addIssue({ code: "custom", message: error });
  });

const id = z.string().uuid();

/** Las elecciones del onboarding. Solo identificadores y números: nunca montos. */
export const projectInputSchema = z.object({
  landStatus: z.enum(LAND_STATUSES),
  lotId: id.nullable(),
  departmentId: z.number().int().positive().max(32767).nullable(),
  municipalityId: z.number().int().positive().nullable(),
  landAreaM2: z.number().positive().max(10_000_000).nullable(),
  designSource: z.enum(DESIGN_SOURCES),
  houseModelId: id.nullable(),
  areaM2: z.number().min(CUSTOM_AREA_MIN_M2).max(CUSTOM_AREA_MAX_M2).nullable(),
  floors: z.union([z.literal(1), z.literal(2)]),
  bedrooms: z.number().int().min(0).max(MAX_BEDROOMS),
  bathrooms: z.number().int().min(1).max(MAX_BATHROOMS),
  optionIds: z.array(id).min(1).max(40),
});

/** El enlace privado del proyecto: 32 bytes en base64url. */
export const projectTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const saveProjectSchema = z.object({
  locale: localeSchema,
  name: projectNameSchema,
  project: projectInputSchema,
  contact: contactInfoSchema,
  /** Sesión anónima del embudo, para contar el proyecto guardado. */
  sessionId: z.uuid().optional(),
  [HONEYPOT_FIELD]: z.unknown(),
  [STARTED_AT_FIELD]: z.unknown(),
});

export const updateSelectionsSchema = z.object({
  locale: localeSchema,
  token: projectTokenSchema,
  optionIds: z.array(id).min(1).max(40),
});

export const projectRequestSchema = z.object({
  locale: localeSchema,
  token: projectTokenSchema,
  kind: z.enum(PROJECT_REQUEST_KINDS),
  message: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(1000, { error: "messageTooLong" }).nullable(),
  ),
});
