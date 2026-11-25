import { z } from "@/lib/zod";

/**
 * Eventos anónimos del embudo: cuánta gente empieza un proyecto, en qué paso se va y
 * cuántos lo guardan. Sin datos personales; el identificador de sesión es aleatorio por
 * pestaña. Debe coincidir con el CHECK de `funnel_events.event` en la base (que además
 * conserva los eventos del cotizador anterior).
 */
export const FUNNEL_EVENTS = [
  "project_started",
  "project_step_viewed",
  "project_estimate_viewed",
  "project_saved",
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
 * Lo que puede reportar el navegador. `project_saved` lo registra solo el servidor al
 * guardar el proyecto: si lo aceptáramos del navegador, cualquiera podría inflar esa cifra.
 */
export const clientFunnelEventSchema = funnelEventSchema.extend({
  event: z.enum(FUNNEL_EVENTS.filter((event) => event !== "project_saved")),
});
