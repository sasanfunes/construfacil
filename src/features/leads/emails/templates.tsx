import type { EmailTranslator } from "./translator";
import { ButtonLink, EmailLayout, H, P, Rows } from "./layout";

/** Datos ya formateados (fechas, montos): las plantillas solo arman el correo. */

export type ConfirmationKind = "contact" | "video_call" | "reservation" | "listing_inquiry";

export type CallSummary = { dateText: string; slot: "morning" | "afternoon" | "evening"; timezone: string };

export function ClientConfirmationEmail({
  t,
  lang,
  firstName,
  kind,
  channel,
  listingName,
  call,
  whatsappUrl,
  showExampleNotice,
}: {
  t: EmailTranslator;
  lang: string;
  firstName: string;
  kind: ConfirmationKind;
  channel: "whatsapp" | "phone" | "email";
  listingName: string | null;
  call: CallSummary | null;
  whatsappUrl: string | null;
  showExampleNotice: boolean;
}) {
  const listing = listingName ?? "";
  return (
    <EmailLayout
      lang={lang}
      preview={t("confirmation.preview")}
      brand={t("brand")}
      footer={t("footer")}
      notice={showExampleNotice ? t("exampleNotice") : undefined}
    >
      <P>{t("greeting", { name: firstName })}</P>
      <P>{t(`confirmation.intro.${kind}`, { listing })}</P>
      <P>{t("confirmation.nextSteps", { channel: t(`channel.${channel}`) })}</P>
      {call ? (
        <>
          <H>{t("confirmation.callTitle")}</H>
          <P>
            {t("confirmation.callWhen", {
              date: call.dateText,
              slot: t(`slots.${call.slot}`),
              timezone: call.timezone,
            })}
          </P>
          <P>{t("confirmation.callNote")}</P>
        </>
      ) : null}
      {kind === "reservation" ? <P>{t("confirmation.reservationNote")}</P> : null}
      {whatsappUrl ? <ButtonLink href={whatsappUrl}>{t("whatsappCta")}</ButtonLink> : null}
      <P>{t("signature")}</P>
    </EmailLayout>
  );
}

export type ProjectSummary = {
  code: string;
  name: string;
  url: string;
  totalText: string;
  lotText: string | null;
  initialText: string;
  weeks: number;
};

/** Al cliente, cuando guarda su proyecto: el enlace privado a su panel. */
export function ClientProjectEmail({
  t,
  lang,
  firstName,
  project,
  showExampleNotice,
}: {
  t: EmailTranslator;
  lang: string;
  firstName: string;
  project: ProjectSummary;
  showExampleNotice: boolean;
}) {
  const rows: Array<readonly [string, string]> = [
    [t("project.total"), project.totalText],
    ...(project.lotText ? [[t("project.lot"), project.lotText] as const] : []),
    [t("project.initial"), project.initialText],
    [t("project.duration"), t("project.weeks", { weeks: project.weeks })],
  ];
  return (
    <EmailLayout
      lang={lang}
      preview={t("project.preview", { total: project.totalText })}
      brand={t("brand")}
      footer={t("footer")}
      notice={showExampleNotice ? t("exampleNotice") : undefined}
    >
      <P>{t("greeting", { name: firstName })}</P>
      <P>{t("project.intro", { name: project.name })}</P>
      <ButtonLink href={project.url}>{t("project.cta")}</ButtonLink>
      <H>{project.code}</H>
      <Rows rows={rows} />
      <P>{t("project.nextSteps")}</P>
      <P>{t("project.estimateNote")}</P>
      <P style={{ fontSize: 13, color: "#4a5873" }}>{t("project.privateLink")}</P>
      <P>{t("signature")}</P>
    </EmailLayout>
  );
}

export type TeamLeadSummary = {
  source:
    "project" | "project_request" | "contact" | "video_call" | "reservation_request" | "listing_inquiry";
  fullName: string;
  email: string;
  phone: string | null;
  channel: "whatsapp" | "phone" | "email";
  usState: string | null;
  locale: string;
  message: string | null;
  listing: string | null;
  model: string | null;
  call: CallSummary | null;
  project: { code: string; name: string; totalText: string; request?: string } | null;
};

/** Aviso al equipo de ventas. Siempre en español. */
export function TeamLeadEmail({ t, lead }: { t: EmailTranslator; lead: TeamLeadSummary }) {
  const none = t("team.none");
  const rows: Array<readonly [string, string]> = [
    [t("team.fields.name"), lead.fullName],
    [t("team.fields.email"), lead.email],
    [t("team.fields.phone"), lead.phone ?? none],
    [t("team.fields.channel"), t(`channel.${lead.channel}`)],
    [t("team.fields.state"), lead.usState ?? none],
    [t("team.fields.locale"), lead.locale],
  ];
  if (lead.listing) rows.push([t("team.fields.listing"), lead.listing]);
  if (lead.model) rows.push([t("team.fields.model"), lead.model]);
  if (lead.project) {
    rows.push(
      [t("team.fields.project"), `${lead.project.code} · ${lead.project.name}`],
      [t("team.fields.total"), lead.project.totalText],
    );
    if (lead.project.request) rows.push([t("team.fields.request"), lead.project.request]);
  }
  if (lead.call) {
    rows.push([
      t("team.fields.call"),
      t("confirmation.callWhen", {
        date: lead.call.dateText,
        slot: t(`slots.${lead.call.slot}`),
        timezone: lead.call.timezone,
      }),
    ]);
  }
  if (lead.message) rows.push([t("team.fields.message"), lead.message]);

  return (
    <EmailLayout
      lang="es"
      preview={t(`team.source.${lead.source}`)}
      brand={t("brand")}
      footer={t("team.replyHint")}
    >
      <H>{t("team.title")}</H>
      <P>{t(`team.source.${lead.source}`)}</P>
      <Rows rows={rows} />
    </EmailLayout>
  );
}
