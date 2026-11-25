"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { pricingRulesFrom } from "@/features/catalog/catalog";
import { getCatalog } from "@/features/catalog/data/load";
import { HONEYPOT_FIELD, looksLikeBot, STARTED_AT_FIELD } from "@/features/leads/bot-check";
import { callSummary, notifyClientQuote, notifyTeam } from "@/features/leads/notify";
import { contactInfoSchema, fieldErrorsOf, localeSchema, videoCallSchema } from "@/features/leads/schemas";
import { getLeadStore, type NewVideoCall } from "@/features/leads/store";
import { hashQuoteToken, newQuoteToken } from "@/features/leads/token";
import { getPathname } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import { formatUsd } from "@/lib/money";
import { enforceRateLimit, getRequestIdentifier } from "@/lib/security/rate-limit";
import { siteConfig } from "@/lib/site";

import { calculateQuote, QuoteInputError } from "./engine";
import { funnelEventSchema, quoteInputSchema } from "./schemas";

export type SaveQuoteResult =
  | { status: "success"; path: string }
  | {
      status: "error";
      error: "validation" | "rate_limited" | "unavailable" | "server";
      fieldErrors?: Record<string, string>;
    };

function saveQuoteSchema(today: string) {
  return z.object({
    locale: localeSchema,
    quote: quoteInputSchema,
    contact: contactInfoSchema,
    videoCall: videoCallSchema(today).nullable(),
    /** Sesión anónima del embudo, para contar la cotización guardada. */
    sessionId: z.uuid().optional(),
    [HONEYPOT_FIELD]: z.unknown(),
    [STARTED_AT_FIELD]: z.unknown(),
  });
}

/**
 * Guarda la cotización del cotizador. El navegador manda las elecciones; el servidor
 * recalcula todos los montos con las reglas de la base y guarda esa foto.
 * Devuelve la ruta del enlace privado para llevar al cliente ahí.
 */
export async function saveQuote(payload: unknown): Promise<SaveQuoteResult> {
  const raw = (typeof payload === "object" && payload !== null ? payload : {}) as Record<string, unknown>;
  if (looksLikeBot({ honeypot: raw[HONEYPOT_FIELD], startedAt: raw[STARTED_AT_FIELD], now: Date.now() })) {
    console.warn("[cotizador] envío descartado: parece automatizado");
    return { status: "error", error: "server" };
  }

  const requestHeaders = await headers();
  const byIp = await enforceRateLimit("quote", getRequestIdentifier(requestHeaders));
  if (!byIp.allowed) return { status: "error", error: "rate_limited" };

  const today = new Date().toISOString().slice(0, 10);
  const parsed = saveQuoteSchema(today).safeParse(payload);
  if (!parsed.success)
    return { status: "error", error: "validation", fieldErrors: fieldErrorsOf(parsed.error) };
  const { locale, quote: input, contact, videoCall: call, sessionId } = parsed.data;

  const byEmail = await enforceRateLimit("quote", `email:${contact.email}`);
  if (!byEmail.allowed) return { status: "error", error: "rate_limited" };

  const catalog = await getCatalog();
  let result;
  try {
    result = calculateQuote(input, pricingRulesFrom(catalog));
  } catch (error) {
    if (error instanceof QuoteInputError) return { status: "error", error: "unavailable" };
    throw error;
  }

  const token = newQuoteToken();
  const videoCall: NewVideoCall | null = call
    ? { preferredDate: call.date, timeSlot: call.timeSlot, timezone: call.timezone }
    : null;
  const model = input.design.kind === "model" ? input.design.modelId : null;

  let quoteCode: string;
  try {
    ({ quoteCode } = await getLeadStore().submitQuote(
      {
        fullName: contact.fullName,
        email: contact.email,
        phone: contact.phone ?? null,
        preferredChannel: contact.preferredChannel,
        locale,
        usState: contact.usState ?? null,
        message: null,
        homeId: null,
        lotId: input.lotId,
        houseModelId: model,
      },
      { tokenHash: hashQuoteToken(token), locale, input, result, usdToHnl: catalog.exchangeRate.usdToHnl },
      videoCall,
    ));
  } catch (error) {
    console.error(`[cotizador] no se pudo guardar: ${(error as Error).message}`);
    return { status: "error", error: "server" };
  }

  const path = getPathname({ href: { pathname: "/quote/[token]", params: { token } }, locale });
  const validUntil = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const modelName = model ? (catalog.models.find((m) => m.id === model)?.name ?? null) : null;

  await Promise.all([
    notifyTeam({
      source: "quote",
      fullName: contact.fullName,
      email: contact.email,
      phone: contact.phone ?? null,
      channel: contact.preferredChannel,
      usState: contact.usState ?? null,
      locale,
      message: null,
      listing: input.lotId ? (catalog.lots.find((l) => l.id === input.lotId)?.code ?? null) : null,
      model: modelName?.es ?? null,
      call: callSummary(videoCall, "es"),
      quote: { code: quoteCode, totalText: formatUsd(result.grandTotalUsdCents, "es") },
    }),
    notifyClientQuote({
      to: contact.email,
      locale,
      firstName: contact.fullName.split(/\s+/)[0] ?? contact.fullName,
      quote: {
        code: quoteCode,
        url: new URL(path, siteConfig.url).toString(),
        totalText: formatUsd(result.totalUsdCents, locale),
        lotText: result.lotPriceUsdCents ? formatUsd(result.lotPriceUsdCents, locale) : null,
        initialText: formatUsd(result.payments[0]?.amountUsdCents ?? 0, locale),
        weeks: result.durationWeeks,
        validUntilText: formatDate(validUntil, locale),
      },
      call: callSummary(videoCall, locale),
      isSample: catalog.source === "sample",
    }),
  ]);

  if (sessionId) {
    // Se registra aquí y no desde el navegador: el navegador ya está cambiando de página.
    await getLeadStore()
      .trackFunnelEvent({ event: "quote_saved", step: 7, sessionId, locale })
      .catch((error: unknown) => console.error(`[embudo] no se pudo registrar: ${(error as Error).message}`));
  }

  return { status: "success", path };
}

/** Evento anónimo del embudo. Nunca falla hacia el navegador: medir no debe estorbar. */
export async function trackFunnelEvent(payload: unknown): Promise<void> {
  const parsed = funnelEventSchema.safeParse(payload);
  if (!parsed.success) return;
  try {
    const limit = await enforceRateLimit("funnel", getRequestIdentifier(await headers()));
    if (!limit.allowed) return;
    await getLeadStore().trackFunnelEvent(parsed.data);
  } catch (error) {
    console.error(`[embudo] no se pudo registrar: ${(error as Error).message}`);
  }
}
