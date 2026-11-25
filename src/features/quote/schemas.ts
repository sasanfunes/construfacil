import { z } from "zod";

import { CUSTOM_DESIGN_MAX_M2, CUSTOM_DESIGN_MIN_M2 } from "./engine";
import { LAND_STATUSES } from "./types";

/**
 * Lo que manda el navegador al guardar una cotización: solo identificadores y cantidades.
 * Los montos los calcula el servidor con las reglas de la base.
 */
export const quoteInputSchema = z.object({
  landStatus: z.enum(LAND_STATUSES),
  lotId: z.uuid().nullable(),
  departmentId: z.number().int().positive().max(100),
  municipalityId: z.number().int().positive().max(100_000).nullable(),
  landAreaM2: z.number().positive().max(10_000_000).nullable(),
  design: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("model"), modelId: z.uuid() }),
    z.object({
      kind: z.literal("custom"),
      areaM2: z.number().min(CUSTOM_DESIGN_MIN_M2).max(CUSTOM_DESIGN_MAX_M2),
    }),
  ]),
  finishLevelId: z.uuid(),
  extras: z.array(z.object({ extraId: z.uuid(), quantity: z.number().int().positive().max(10_000) })).max(30),
});

export const FUNNEL_EVENTS = [
  "quote_started",
  "quote_step_viewed",
  "quote_estimate_viewed",
  "quote_saved",
  "calculator_used",
] as const;

export const funnelEventSchema = z.object({
  event: z.enum(FUNNEL_EVENTS),
  step: z.number().int().min(1).max(10).nullable(),
  sessionId: z.uuid(),
  locale: z.enum(["es", "en"]),
});
export type FunnelEventInput = z.infer<typeof funnelEventSchema>;

/**
 * Lo que puede reportar el navegador. `quote_saved` lo registra solo el servidor al guardar
 * la cotización: si lo aceptáramos del navegador, cualquiera podría inflar esa cifra.
 */
export const clientFunnelEventSchema = funnelEventSchema.extend({
  event: z.enum(FUNNEL_EVENTS.filter((event) => event !== "quote_saved")),
});
