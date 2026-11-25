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

export type QuoteSummary = {
  code: string;
  url: string;
  totalText: string;
  lotText: string | null;
  initialText: string;
  weeks: number;
  validUntilText: string;
};

export function ClientQuoteEmail({
  t,
  lang,
  firstName,
  quote,
  call,
  showExampleNotice,
}: {
  t: EmailTranslator;
  lang: string;
  firstName: string;
  quote: QuoteSummary;
  call: CallSummary | null;
  showExampleNotice: boolean;
}) {
  const rows: Array<readonly [string, string]> = [
    [t("quote.total"), quote.totalText],
    ...(quote.lotText ? [[t("quote.lot"), quote.lotText] as const] : []),
    [t("quote.initial"), quote.initialText],
    [t("quote.duration"), t("quote.weeks", { weeks: quote.weeks })],
  ];
  return (
    <EmailLayout
      lang={lang}
      preview={t("quote.preview", { total: quote.totalText })}
      brand={t("brand")}
      footer={t("footer")}
      notice={showExampleNotice ? t("exampleNotice") : undefined}
    >
      <P>{t("greeting", { name: firstName })}</P>
      <P>{t("quote.intro")}</P>
      <ButtonLink href={quote.url}>{t("quote.cta")}</ButtonLink>
      <H>{quote.code}</H>
      <Rows rows={rows} />
      <P>{t("quote.validUntil", { date: quote.validUntilText })}</P>
      <P>{t("quote.estimateNote")}</P>
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
      <P style={{ fontSize: 13, color: "#4a5873" }}>{t("quote.privateLink")}</P>
      <P>{t("signature")}</P>
    </EmailLayout>
  );
}

export type TeamLeadSummary = {
  source: "quote" | "contact" | "video_call" | "reservation_request" | "listing_inquiry";
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
  quote: { code: string; totalText: string } | null;
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
  if (lead.quote) {
    rows.push([t("team.fields.quote"), lead.quote.code], [t("team.fields.total"), lead.quote.totalText]);
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
