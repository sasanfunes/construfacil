import "server-only";

import { isProductionDeploy } from "@/lib/env";
import { canWriteToSupabase } from "@/lib/env.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

import type { FunnelEventInput } from "@/features/funnel/schemas";

/**
 * Dónde se guardan los leads. Con Supabase, en la base, a través de submit_lead() (todo o
 * nada). Sin Supabase (solo fuera de producción), en memoria: sirve para desarrollar y
 * para las pruebas, y se pierde al reiniciar. Los proyectos tienen su propio almacén
 * (src/features/projects/store.ts), que crea su lead con submit_project().
 */

export type LeadSource = "contact" | "video_call" | "reservation_request" | "listing_inquiry" | "project";

export type NewLead = {
  source: LeadSource;
  fullName: string;
  email: string;
  phone: string | null;
  preferredChannel: "whatsapp" | "phone" | "email";
  locale: "es" | "en";
  usState: string | null;
  message: string | null;
  homeId: string | null;
  lotId: string | null;
  houseModelId: string | null;
};

export type NewVideoCall = {
  preferredDate: string;
  timeSlot: "morning" | "afternoon" | "evening";
  timezone: string;
};

export interface LeadStore {
  submitLead(lead: NewLead, videoCall: NewVideoCall | null): Promise<{ leadId: string }>;
  trackFunnelEvent(event: FunnelEventInput): Promise<void>;
}

export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/** El lead tal como lo esperan submit_lead() y submit_project(). */
export function leadPayload(lead: Omit<NewLead, "source"> & { source?: LeadSource }): Json {
  return {
    source: lead.source ?? "contact",
    full_name: lead.fullName,
    email: lead.email,
    phone: lead.phone,
    preferred_channel: lead.preferredChannel,
    locale: lead.locale,
    us_state: lead.usState,
    message: lead.message,
    home_id: lead.homeId,
    lot_id: lead.lotId,
    house_model_id: lead.houseModelId,
  };
}

function videoCallPayload(call: NewVideoCall | null): Json | null {
  return call
    ? { preferred_date: call.preferredDate, time_slot: call.timeSlot, timezone: call.timezone }
    : null;
}

class SupabaseLeadStore implements LeadStore {
  private db = createSupabaseAdminClient();

  async submitLead(lead: NewLead, videoCall: NewVideoCall | null) {
    const { data, error } = await this.db.rpc("submit_lead", {
      p_lead: leadPayload(lead),
      p_video_call: videoCallPayload(videoCall),
    });
    if (error || !data) throw new Error(`No se pudo guardar el lead (${error?.code ?? "sin datos"})`);
    return { leadId: data };
  }

  async trackFunnelEvent(event: FunnelEventInput) {
    const { error } = await this.db
      .from("funnel_events")
      .insert({ event: event.event, step: event.step, session_id: event.sessionId, locale: event.locale });
    if (error) throw new Error(`No se pudo registrar el evento (${error.code})`);
  }
}

type MemoryState = {
  leads: Array<NewLead & { id: string; videoCall: NewVideoCall | null }>;
  funnel: FunnelEventInput[];
};

/** Tope de registros en memoria (modo ejemplo): se descartan los más viejos. */
export const MEMORY_LIMIT = 1_000;

export function capArray<T>(items: T[]) {
  if (items.length > MEMORY_LIMIT) items.splice(0, items.length - MEMORY_LIMIT);
}

class MemoryLeadStore implements LeadStore {
  // En globalThis para sobrevivir a la recarga en caliente de `next dev`.
  private state: MemoryState = ((globalThis as { __construfacilLeads?: MemoryState }).__construfacilLeads ??=
    {
      leads: [],
      funnel: [],
    });

  async submitLead(lead: NewLead, videoCall: NewVideoCall | null) {
    const id = crypto.randomUUID();
    this.state.leads.push({ ...lead, id, videoCall });
    capArray(this.state.leads);
    console.info(`[leads] guardado en memoria (modo ejemplo): ${lead.source} ${id}`);
    return { leadId: id };
  }

  async trackFunnelEvent(event: FunnelEventInput) {
    this.state.funnel.push(event);
    capArray(this.state.funnel);
  }
}

let store: LeadStore | undefined;

export function getLeadStore(): LeadStore {
  if (store) return store;
  if (canWriteToSupabase()) store = new SupabaseLeadStore();
  else if (isProductionDeploy()) throw new Error("En producción los leads necesitan Supabase.");
  else store = new MemoryLeadStore();
  return store;
}
