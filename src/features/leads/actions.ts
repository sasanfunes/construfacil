"use server";

import { headers } from "next/headers";

import { getCatalog } from "@/features/catalog/data/load";
import { emailRateLimitKey, enforceRateLimit, getRequestIdentifier } from "@/lib/security/rate-limit";

import { HONEYPOT_FIELD, looksLikeBot, STARTED_AT_FIELD } from "./bot-check";
import { callSummary, notifyClientConfirmation, notifyTeam } from "./notify";
import {
  fieldErrorsOf,
  leadRequestFromFormData,
  leadRequestSchema,
  localeSchema,
  type LeadIntent,
} from "./schemas";
import { getLeadStore, type LeadSource, type NewVideoCall } from "./store";

export type LeadFormState =
  | { status: "idle" }
  | { status: "success" }
  | {
      status: "error";
      error: "validation" | "rate_limited" | "unavailable" | "server";
      fieldErrors?: Record<string, string>;
    };

const SOURCE_BY_INTENT: Record<LeadIntent, LeadSource> = {
  contact: "contact",
  video_call: "video_call",
  reservation: "reservation_request",
  listing_inquiry: "listing_inquiry",
};

/**
 * Formularios de contacto, videollamada, apartado y preguntas por una propiedad.
 * Orden: anti-bots → rate limiting por IP → validación → rate limiting por correo →
 * contexto contra el catálogo → guardar → avisar por correo.
 */
export async function submitLeadRequest(
  _previous: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const requestHeaders = await headers();
  const intentRaw = formData.get("intent");
  const rateAction = intentRaw === "video_call" ? "videoCallRequest" : "contactForm";
  const byIp = await enforceRateLimit(rateAction, getRequestIdentifier(requestHeaders));
  if (!byIp.allowed) return { status: "error", error: "rate_limited" };

  const locale = localeSchema.parse(formData.get("locale"));

  if (
    looksLikeBot({
      honeypot: formData.get(HONEYPOT_FIELD),
      startedAt: formData.get(STARTED_AT_FIELD),
      now: Date.now(),
    })
  ) {
    console.warn("[leads] envío descartado: parece automatizado");
    return { status: "success" };
  }

  const today = new Date().toISOString().slice(0, 10);
  const parsed = leadRequestSchema(today).safeParse(leadRequestFromFormData(formData));
  if (!parsed.success)
    return { status: "error", error: "validation", fieldErrors: fieldErrorsOf(parsed.error) };
  const request = parsed.data;

  // Cada formulario manda un correo de confirmación: se limita por destinatario para que
  // nadie lo use para llenar de correos la bandeja de otra persona.
  const byEmail = await enforceRateLimit("outboundEmail", emailRateLimitKey(request.email));
  if (!byEmail.allowed) return { status: "error", error: "rate_limited" };

  // El contexto (casa, terreno, modelo) debe existir y estar disponible.
  const catalog = await getCatalog();
  const home = request.homeId ? catalog.homes.find((h) => h.id === request.homeId) : undefined;
  const lot = request.lotId ? catalog.lots.find((l) => l.id === request.lotId) : undefined;
  const model = request.modelId
    ? catalog.models.find((m) => m.id === request.modelId && m.isActive)
    : undefined;
  const listed = (status?: string) => status === "published" || status === "reserved";
  if (
    (request.homeId && !listed(home?.listingStatus)) ||
    (request.lotId && !listed(lot?.listingStatus)) ||
    (request.modelId && !model) ||
    (request.intent === "reservation" &&
      home?.listingStatus !== "published" &&
      lot?.listingStatus !== "published")
  ) {
    return { status: "error", error: "unavailable" };
  }

  const videoCall: NewVideoCall | null = request.videoCall
    ? {
        preferredDate: request.videoCall.date,
        timeSlot: request.videoCall.timeSlot,
        timezone: request.videoCall.timezone,
      }
    : null;
  const source = request.intent === "contact" && videoCall ? "video_call" : SOURCE_BY_INTENT[request.intent];

  try {
    await getLeadStore().submitLead(
      {
        source,
        fullName: request.fullName,
        email: request.email,
        phone: request.phone ?? null,
        preferredChannel: request.preferredChannel,
        locale,
        usState: request.usState ?? null,
        message: request.message ?? null,
        homeId: home?.id ?? null,
        lotId: lot?.id ?? null,
        houseModelId: model?.id ?? null,
      },
      videoCall,
    );
  } catch (error) {
    console.error(`[leads] no se pudo guardar: ${(error as Error).message}`);
    return { status: "error", error: "server" };
  }

  const listingName = home
    ? `${home.title[locale]} (${home.code})`
    : lot
      ? `${lot.title[locale]} (${lot.code})`
      : null;
  await Promise.all([
    notifyTeam({
      source,
      fullName: request.fullName,
      email: request.email,
      phone: request.phone ?? null,
      channel: request.preferredChannel,
      usState: request.usState ?? null,
      locale,
      message: request.message ?? null,
      listing: home ? `${home.code} — ${home.title.es}` : lot ? `${lot.code} — ${lot.title.es}` : null,
      model: model?.name.es ?? null,
      call: callSummary(videoCall, "es"),
      project: null,
    }),
    notifyClientConfirmation({
      to: request.email,
      locale,
      firstName: request.fullName.split(/\s+/)[0] ?? request.fullName,
      kind: source === "video_call" ? "video_call" : request.intent,
      channel: request.preferredChannel,
      listingName,
      call: callSummary(videoCall, locale),
      isSample: catalog.source === "sample",
    }),
  ]);

  return { status: "success" };
}
