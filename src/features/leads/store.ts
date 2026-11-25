import "server-only";

import { isProductionDeploy } from "@/lib/env";
import { canWriteToSupabase } from "@/lib/env.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

import type { FunnelEventInput } from "@/features/quote/schemas";
import type { QuoteInput, QuoteResult } from "@/features/quote/types";

/**
 * Dónde se guardan los leads. Con Supabase, en la base, a través de submit_lead() y
 * submit_quote() (todo o nada). Sin Supabase (solo fuera de producción), en memoria:
 * sirve para desarrollar y para las pruebas, y se pierde al reiniciar.
 */

export type LeadSource = "quote" | "contact" | "video_call" | "reservation_request" | "listing_inquiry";

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

export type NewQuote = {
  tokenHash: string;
  locale: "es" | "en";
  input: QuoteInput;
  result: QuoteResult;
  usdToHnl: number;
};

/** Lo que se le muestra al cliente en su enlace privado: una foto de lo que se calculó. */
export type StoredQuote = {
  code: string;
  createdAt: string;
  validUntil: string;
  locale: "es" | "en";
  firstName: string;
  input: QuoteInput;
  result: QuoteResult;
  usdToHnl: number;
};

export interface LeadStore {
  submitLead(lead: NewLead, videoCall: NewVideoCall | null): Promise<{ leadId: string }>;
  submitQuote(
    lead: Omit<NewLead, "source">,
    quote: NewQuote,
    videoCall: NewVideoCall | null,
  ): Promise<{ quoteCode: string }>;
  findQuoteByTokenHash(tokenHash: string): Promise<StoredQuote | null>;
  trackFunnelEvent(event: FunnelEventInput): Promise<void>;
}

const BREAKDOWN_VERSION = 1;

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

function leadPayload(lead: Omit<NewLead, "source"> & { source?: LeadSource }): Json {
  return {
    source: lead.source ?? "quote",
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

  async submitQuote(lead: Omit<NewLead, "source">, quote: NewQuote, videoCall: NewVideoCall | null) {
    const { input, result } = quote;
    const { data, error } = await this.db.rpc("submit_quote", {
      p_lead: leadPayload(lead),
      p_quote: {
        access_token_hash: quote.tokenHash,
        locale: quote.locale,
        land_status: input.landStatus,
        lot_id: input.lotId,
        department_id: input.departmentId,
        municipality_id: input.municipalityId,
        land_area_m2: input.landAreaM2,
        house_model_id: input.design.kind === "model" ? input.design.modelId : null,
        custom_area_m2: input.design.kind === "custom" ? input.design.areaM2 : null,
        finish_level_id: input.finishLevelId,
        construction_usd_cents: result.constructionUsdCents,
        extras_usd_cents: result.extrasUsdCents,
        total_usd_cents: result.totalUsdCents,
        lot_price_usd_cents: result.lotPriceUsdCents,
        initial_payment_percent: result.initialPaymentPercent,
        duration_weeks: result.durationWeeks,
        breakdown: { version: BREAKDOWN_VERSION, input, result } as unknown as Json,
        usd_to_hnl: quote.usdToHnl,
      },
      p_items: result.extras.map((line) => ({
        extra_id: line.extraId,
        quantity: line.quantity,
        unit_price_usd_cents: line.unitPriceUsdCents,
        total_usd_cents: line.totalUsdCents,
      })),
      p_video_call: videoCallPayload(videoCall),
    });
    const row = data?.[0];
    if (error || !row) throw new Error(`No se pudo guardar la cotización (${error?.code ?? "sin datos"})`);
    return { quoteCode: row.quote_code };
  }

  async findQuoteByTokenHash(tokenHash: string): Promise<StoredQuote | null> {
    const { data, error } = await this.db
      .from("quotes")
      .select("code, created_at, valid_until, locale, breakdown, usd_to_hnl, lead_id")
      .eq("access_token_hash", tokenHash)
      .gt("access_expires_at", new Date().toISOString())
      .maybeSingle();
    if (error) throw new Error(`No se pudo leer la cotización (${error.code})`);
    if (!data) return null;

    const breakdown = data.breakdown as { version?: number; input?: QuoteInput; result?: QuoteResult } | null;
    if (breakdown?.version !== BREAKDOWN_VERSION || !breakdown.input || !breakdown.result) return null;

    const lead = await this.db.from("leads").select("full_name").eq("id", data.lead_id).maybeSingle();
    return {
      code: data.code,
      createdAt: data.created_at,
      validUntil: data.valid_until,
      locale: data.locale === "en" ? "en" : "es",
      firstName: firstNameOf(lead.data?.full_name ?? ""),
      input: breakdown.input,
      result: breakdown.result,
      usdToHnl: Number(data.usd_to_hnl),
    };
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
  quotes: Map<string, StoredQuote>;
  funnel: FunnelEventInput[];
};

class MemoryLeadStore implements LeadStore {
  // En globalThis para sobrevivir a la recarga en caliente de `next dev`.
  private state: MemoryState = ((globalThis as { __construfacilLeads?: MemoryState }).__construfacilLeads ??=
    {
      leads: [],
      quotes: new Map(),
      funnel: [],
    });

  async submitLead(lead: NewLead, videoCall: NewVideoCall | null) {
    const id = crypto.randomUUID();
    this.state.leads.push({ ...lead, id, videoCall });
    console.info(`[leads] guardado en memoria (modo ejemplo): ${lead.source} ${id}`);
    return { leadId: id };
  }

  async submitQuote(lead: Omit<NewLead, "source">, quote: NewQuote, videoCall: NewVideoCall | null) {
    await this.submitLead({ ...lead, source: "quote" }, videoCall);
    const code = `CF-Q-${crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
    const now = new Date();
    const validUntil = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    this.state.quotes.set(quote.tokenHash, {
      code,
      createdAt: now.toISOString(),
      validUntil,
      locale: quote.locale,
      firstName: firstNameOf(lead.fullName),
      input: quote.input,
      result: quote.result,
      usdToHnl: quote.usdToHnl,
    });
    return { quoteCode: code };
  }

  async findQuoteByTokenHash(tokenHash: string) {
    return this.state.quotes.get(tokenHash) ?? null;
  }

  async trackFunnelEvent(event: FunnelEventInput) {
    this.state.funnel.push(event);
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
