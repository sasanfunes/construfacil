"use server";

import { headers } from "next/headers";

import { projectRulesFrom } from "@/features/catalog/catalog";
import { getCatalog } from "@/features/catalog/data/load";
import { HONEYPOT_FIELD, looksLikeBot, STARTED_AT_FIELD } from "@/features/leads/bot-check";
import { notifyClientProject, notifyTeam } from "@/features/leads/notify";
import { fieldErrorsOf } from "@/features/leads/schemas";
import { getLeadStore } from "@/features/leads/store";
import { hashAccessToken as hashToken, newAccessToken as newToken } from "@/features/leads/token";
import { getPathname } from "@/i18n/navigation";
import { formatUsd } from "@/lib/money";
import { emailRateLimitKey, enforceRateLimit, getRequestIdentifier } from "@/lib/security/rate-limit";
import { siteConfig } from "@/lib/site";

import { estimateProject, ProjectInputError } from "./engine";
import { projectRequestSchema, saveProjectSchema, updateSelectionsSchema } from "./schemas";
import { getProjectStore } from "./store";
import type { ProjectEstimate, ProjectInput } from "./types";

export type SaveProjectResult =
  | { status: "success"; path: string }
  | {
      status: "error";
      error: "validation" | "rate_limited" | "unavailable" | "server";
      fieldErrors?: Record<string, string>;
    };

export type UpdateSelectionsResult =
  | { status: "success"; estimate: ProjectEstimate }
  | { status: "error"; error: "validation" | "rate_limited" | "not_editable" | "unavailable" | "server" };

/** Contador por proyecto: la huella del token, nunca el token. */
const projectRateLimitKey = (tokenHash: string) => `project:${tokenHash}`;

export type ProjectRequestResult =
  { status: "success" } | { status: "error"; error: "validation" | "rate_limited" | "not_found" | "server" };

/** Entrada que se guarda: con la ubicación y el diseño con los que de verdad se calculó. */
function resolvedInput(input: ProjectInput, estimate: ProjectEstimate): ProjectInput {
  return {
    ...input,
    // El terreno elegido en el catálogo solo cuenta si de verdad lo compra con nosotros.
    lotId: input.landStatus === "buying_from_us" ? input.lotId : null,
    ...estimate.location,
    houseModelId: estimate.design.houseModelId,
    areaM2: estimate.design.areaM2,
    floors: estimate.design.floors,
    bedrooms: estimate.design.bedrooms,
    bathrooms: estimate.design.bathrooms,
  };
}

/**
 * Guarda el proyecto del onboarding. El navegador manda las elecciones; el servidor
 * recalcula todos los montos con las reglas de la base y guarda esa foto. Devuelve la ruta
 * del panel privado para llevar al cliente ahí.
 */
export async function saveProject(payload: unknown): Promise<SaveProjectResult> {
  const requestHeaders = await headers();
  const byIp = await enforceRateLimit("project", getRequestIdentifier(requestHeaders));
  if (!byIp.allowed) return { status: "error", error: "rate_limited" };

  const raw = (typeof payload === "object" && payload !== null ? payload : {}) as Record<string, unknown>;
  if (looksLikeBot({ honeypot: raw[HONEYPOT_FIELD], startedAt: raw[STARTED_AT_FIELD], now: Date.now() })) {
    console.warn("[proyectos] envío descartado: parece automatizado");
    return { status: "error", error: "server" };
  }

  const parsed = saveProjectSchema.safeParse(payload);
  if (!parsed.success)
    return { status: "error", error: "validation", fieldErrors: fieldErrorsOf(parsed.error) };
  const { locale, name, project: input, contact, sessionId } = parsed.data;

  // Cada proyecto guardado manda un correo: se limita por destinatario.
  const byEmail = await enforceRateLimit("outboundEmail", emailRateLimitKey(contact.email));
  if (!byEmail.allowed) return { status: "error", error: "rate_limited" };

  const catalog = await getCatalog();
  let estimate: ProjectEstimate;
  try {
    estimate = estimateProject(input, projectRulesFrom(catalog));
  } catch (error) {
    if (error instanceof ProjectInputError) return { status: "error", error: "unavailable" };
    throw error;
  }

  const stored = resolvedInput(input, estimate);
  const token = newToken();
  let code: string;
  try {
    ({ code } = await getProjectStore().submitProject(
      {
        fullName: contact.fullName,
        email: contact.email,
        phone: contact.phone ?? null,
        preferredChannel: contact.preferredChannel,
        locale,
        usState: contact.usState ?? null,
        message: null,
        homeId: null,
        lotId: stored.lotId,
        houseModelId: estimate.design.houseModelId,
      },
      {
        tokenHash: hashToken(token),
        name,
        locale,
        input: stored,
        estimate,
        usdToHnl: catalog.exchangeRate.usdToHnl,
      },
    ));
  } catch (error) {
    console.error(`[proyectos] no se pudo guardar: ${(error as Error).message}`);
    return { status: "error", error: "server" };
  }

  const path = getPathname({ href: { pathname: "/project/[token]", params: { token } }, locale });
  const model = estimate.design.houseModelId
    ? catalog.models.find((m) => m.id === estimate.design.houseModelId)
    : undefined;
  const lot = stored.lotId ? catalog.lots.find((l) => l.id === stored.lotId) : undefined;

  await Promise.all([
    notifyTeam({
      source: "project",
      fullName: contact.fullName,
      email: contact.email,
      phone: contact.phone ?? null,
      channel: contact.preferredChannel,
      usState: contact.usState ?? null,
      locale,
      message: null,
      listing: lot ? `${lot.code} — ${lot.title.es}` : null,
      model: model?.name.es ?? null,
      call: null,
      project: { code, name, totalText: formatUsd(estimate.grandTotalUsdCents, "es") },
    }),
    notifyClientProject({
      to: contact.email,
      locale,
      firstName: contact.fullName.split(/\s+/)[0] ?? contact.fullName,
      project: {
        code,
        url: new URL(path, siteConfig.url).toString(),
        totalText: formatUsd(estimate.totalUsdCents, locale),
        lotText: estimate.lotPriceUsdCents ? formatUsd(estimate.lotPriceUsdCents, locale) : null,
        initialText: formatUsd(estimate.payments[0]?.amountUsdCents ?? 0, locale),
        weeks: estimate.durationWeeks,
      },
      isSample: catalog.source === "sample",
    }),
  ]);

  if (sessionId) {
    await getLeadStore()
      .trackFunnelEvent({ event: "project_saved", step: null, sessionId, locale })
      .catch((error: unknown) => console.error(`[embudo] no se pudo registrar: ${(error as Error).message}`));
  }

  return { status: "success", path };
}

/**
 * Cambia los materiales desde el panel. El token del enlace privado decide de qué proyecto
 * se trata; el servidor recalcula con las reglas de la base.
 */
export async function updateProjectSelections(payload: unknown): Promise<UpdateSelectionsResult> {
  const limit = await enforceRateLimit("projectUpdate", getRequestIdentifier(await headers()));
  if (!limit.allowed) return { status: "error", error: "rate_limited" };

  const parsed = updateSelectionsSchema.safeParse(payload);
  if (!parsed.success) return { status: "error", error: "validation" };
  const tokenHash = hashToken(parsed.data.token);
  const perProject = await enforceRateLimit("projectUpdatePerProject", projectRateLimitKey(tokenHash));
  if (!perProject.allowed) return { status: "error", error: "rate_limited" };

  const store = getProjectStore();
  const project = await store.findByTokenHash(tokenHash);
  if (!project || project.status !== "draft") return { status: "error", error: "not_editable" };

  const catalog = await getCatalog();
  let estimate: ProjectEstimate;
  try {
    // El terreno y el diseño quedan como se guardaron: solo cambian los materiales (con los
    // precios de hoy). Así el panel y lo que ve el equipo no se separan, y el cliente puede
    // seguir cambiando materiales aunque su terreno ya esté apartado.
    estimate = estimateProject(
      { ...project.input, optionIds: parsed.data.optionIds },
      projectRulesFrom(catalog),
      { lotPriceUsdCents: project.estimate.lotPriceUsdCents },
    );
  } catch (error) {
    if (error instanceof ProjectInputError) return { status: "error", error: "unavailable" };
    throw error;
  }

  try {
    const result = await store.updateSelections(tokenHash, {
      input: resolvedInput({ ...project.input, optionIds: parsed.data.optionIds }, estimate),
      estimate,
      usdToHnl: catalog.exchangeRate.usdToHnl,
    });
    if (result === "not_editable") return { status: "error", error: "not_editable" };
  } catch (error) {
    console.error(`[proyectos] no se pudo actualizar: ${(error as Error).message}`);
    return { status: "error", error: "server" };
  }
  return { status: "success", estimate };
}

/** Solicitud desde el panel (servicios, prueba de avance, soporte). Llega al equipo por correo. */
export async function requestProjectHelp(payload: unknown): Promise<ProjectRequestResult> {
  const limit = await enforceRateLimit("projectRequest", getRequestIdentifier(await headers()));
  if (!limit.allowed) return { status: "error", error: "rate_limited" };

  const parsed = projectRequestSchema.safeParse(payload);
  if (!parsed.success) return { status: "error", error: "validation" };
  const { token, kind, message, locale } = parsed.data;
  const tokenHash = hashToken(token);
  const perProject = await enforceRateLimit("projectRequestPerProject", projectRateLimitKey(tokenHash));
  if (!perProject.allowed) return { status: "error", error: "rate_limited" };

  const store = getProjectStore();
  const project = await store.findByTokenHash(tokenHash);
  if (!project) return { status: "error", error: "not_found" };

  try {
    const result = await store.submitRequest(tokenHash, kind, message);
    if (result === "not_found") return { status: "error", error: "not_found" };
  } catch (error) {
    console.error(`[proyectos] no se pudo guardar la solicitud: ${(error as Error).message}`);
    return { status: "error", error: "server" };
  }

  const kindText = {
    service: "contratar un servicio",
    progress_proof: "prueba de avance",
    support: "soporte",
  }[kind];
  await notifyTeam({
    source: "project_request",
    fullName: project.contact.fullName,
    email: project.contact.email,
    phone: project.contact.phone,
    channel: project.contact.preferredChannel,
    usState: project.contact.usState,
    locale,
    message,
    listing: null,
    model: null,
    call: null,
    project: {
      code: project.code,
      name: project.name,
      totalText: formatUsd(project.estimate.grandTotalUsdCents, "es"),
      request: kindText,
    },
  });
  return { status: "success" };
}
