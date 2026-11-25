import "server-only";

import type { AppLocale } from "@/i18n/routing";
import { formatLongDate } from "@/lib/format";
import { getServerEnv } from "@/lib/env.server";
import { buildWhatsAppUrl, siteConfig } from "@/lib/site";

import { sendEmail } from "./emails/send";
import {
  ClientConfirmationEmail,
  ClientProjectEmail,
  TeamLeadEmail,
  type CallSummary,
  type ConfirmationKind,
  type ProjectSummary,
  type TeamLeadSummary,
} from "./emails/templates";
import { emailTranslator } from "./emails/translator";
import type { NewVideoCall } from "./store";

/**
 * Avisos por correo de un lead: al equipo de ventas y al cliente.
 * Un fallo al enviar no deshace el lead (ya está guardado): se registra y se sigue.
 */

export function callSummary(call: NewVideoCall | null, locale: AppLocale): CallSummary | null {
  return call
    ? { dateText: formatLongDate(call.preferredDate, locale), slot: call.timeSlot, timezone: call.timezone }
    : null;
}

async function safely(label: string, send: () => Promise<unknown>) {
  try {
    await send();
  } catch (error) {
    // Sin datos personales: solo qué correo falló y por qué.
    console.error(`[correo] no se pudo enviar "${label}": ${(error as Error).message}`);
  }
}

export async function notifyTeam(lead: TeamLeadSummary) {
  const to = getServerEnv().LEADS_NOTIFICATION_EMAIL;
  const t = emailTranslator("es");
  const subject = lead.project
    ? t(lead.source === "project_request" ? "team.subjectRequest" : "team.subjectProject", {
        code: lead.project.code,
      })
    : t("team.subject", { source: t(`team.source.${lead.source}`) });
  if (!to) {
    console.info(`[correo] sin destinatario del equipo (LEADS_NOTIFICATION_EMAIL): "${subject}"`);
    return;
  }
  await safely("equipo", () =>
    sendEmail({ to, subject, element: TeamLeadEmail({ t, lead }), replyTo: lead.email }),
  );
}

export async function notifyClientConfirmation(args: {
  to: string;
  locale: AppLocale;
  firstName: string;
  kind: ConfirmationKind;
  channel: "whatsapp" | "phone" | "email";
  listingName: string | null;
  call: CallSummary | null;
  isSample: boolean;
}) {
  const t = emailTranslator(args.locale);
  const whatsappUrl = siteConfig.whatsappNumber ? buildWhatsAppUrl(siteConfig.whatsappNumber) : null;
  await safely("confirmación", () =>
    sendEmail({
      to: args.to,
      subject: t("confirmation.subject"),
      element: ClientConfirmationEmail({
        t,
        lang: args.locale,
        firstName: args.firstName,
        kind: args.kind,
        channel: args.channel,
        listingName: args.listingName,
        call: args.call,
        whatsappUrl,
        showExampleNotice: args.isSample,
      }),
    }),
  );
}

export async function notifyClientProject(args: {
  to: string;
  locale: AppLocale;
  firstName: string;
  project: ProjectSummary;
  isSample: boolean;
}) {
  const t = emailTranslator(args.locale);
  await safely("proyecto", () =>
    sendEmail({
      to: args.to,
      // Solo valores del servidor en el asunto: el nombre del proyecto lo escribió el cliente.
      subject: t("project.subject", { code: args.project.code }),
      element: ClientProjectEmail({
        t,
        lang: args.locale,
        firstName: args.firstName,
        project: args.project,
        showExampleNotice: args.isSample,
      }),
    }),
  );
}
