"use server";

import { headers } from "next/headers";

import { getLeadStore } from "@/features/leads/store";
import { enforceRateLimit, getRequestIdentifier } from "@/lib/security/rate-limit";

import { clientFunnelEventSchema } from "./schemas";

/** Evento anónimo del embudo. Nunca falla hacia el navegador: medir no debe estorbar. */
export async function trackFunnelEvent(payload: unknown): Promise<void> {
  try {
    const limit = await enforceRateLimit("funnel", getRequestIdentifier(await headers()));
    if (!limit.allowed) return;
    const parsed = clientFunnelEventSchema.safeParse(payload);
    if (!parsed.success) return;
    await getLeadStore().trackFunnelEvent(parsed.data);
  } catch (error) {
    console.error(`[embudo] no se pudo registrar: ${(error as Error).message}`);
  }
}
