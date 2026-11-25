"use client";

import { CheckCircle2, MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect, useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox, describedBy, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { submitLeadRequest, type LeadFormState } from "../actions";
import { HONEYPOT_FIELD, STARTED_AT_FIELD } from "../bot-check";
import { addDays, CONTACT_CHANNELS, TIME_SLOTS, US_STATES, type LeadIntent } from "../schemas";

export const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Tegucigalpa",
] as const;

export type FormErrorKey =
  | "required"
  | "invalid"
  | "nameTooShort"
  | "nameTooLong"
  | "nameInvalid"
  | "emailInvalid"
  | "phoneInvalid"
  | "phoneRequired"
  | "messageTooLong"
  | "privacyRequired"
  | "dateInvalid"
  | "dateOutOfRange"
  | "timezoneInvalid";

/** Fecha mínima y máxima de videollamada y zona horaria del navegador (solo existen en el cliente). */
export function useBrowserCallDefaults() {
  const [values, setValues] = useState<{ min: string; max: string; zone: string | null } | null>(null);
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    // Se calcula al montar a propósito: en el servidor no se conoce la fecha ni la zona del visitante.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues({
      min: addDays(today, 1),
      max: addDays(today, 60),
      zone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    });
  }, []);
  return values;
}

/**
 * Formulario de captación: contacto, videollamada, apartado o pregunta por una propiedad.
 * Funciona sin JavaScript (el formulario se envía al servidor); con JavaScript no recarga
 * la página y conserva lo escrito si hay errores.
 */
export function LeadForm({
  intent,
  homeId,
  lotId,
  modelId,
  whatsappHref,
  className,
}: {
  intent: LeadIntent;
  homeId?: string;
  lotId?: string;
  modelId?: string;
  whatsappHref?: string | null;
  className?: string;
}) {
  const t = useTranslations("forms");
  const locale = useLocale();
  const id = useId().replace(/:/g, "");
  const [state, formAction, pending] = useActionState<LeadFormState, FormData>(submitLeadRequest, {
    status: "idle",
  });
  const [startedAt, setStartedAt] = useState("0");
  const [wantsCall, setWantsCall] = useState(intent === "video_call");
  const browser = useBrowserCallDefaults();

  useEffect(() => {
    // Momento en que se mostró el formulario, para descartar envíos instantáneos de bots.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStartedAt(String(Date.now()));
  }, []);

  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const errorText = (key: string) => (errors[key] ? t(`errors.${errors[key] as FormErrorKey}`) : null);
  const fid = (name: string) => `${id}-${name}`;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // Con JavaScript se envía a mano: así React no vacía el formulario si hay errores.
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  if (state.status === "success") {
    return (
      <div
        role="status"
        className={cn("flex flex-col items-start gap-3 rounded-2xl border bg-card p-6", className)}
      >
        <CheckCircle2 aria-hidden="true" className="size-10 text-success" />
        <p className="font-display text-2xl font-semibold">{t("success.title")}</p>
        <p className="text-muted-foreground">{t("success.body")}</p>
        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 font-bold text-brand underline underline-offset-4"
          >
            <MessageCircle aria-hidden="true" className="size-5" />
            {t("success.whatsapp")}
          </a>
        ) : null}
      </div>
    );
  }

  const generalError =
    state.status === "error" && state.error !== "validation" ? t(`errors.${state.error}`) : null;
  const hasFieldErrors = Object.keys(errors).length > 0;
  const zoneOptions: string[] = [...COMMON_TIMEZONES];
  if (browser?.zone && !zoneOptions.includes(browser.zone)) zoneOptions.unshift(browser.zone);
  const defaultZone = browser?.zone ?? "America/New_York";

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className={cn("flex flex-col gap-5", className)}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="intent" value={intent} />
      {homeId ? <input type="hidden" name="homeId" value={homeId} /> : null}
      {lotId ? <input type="hidden" name="lotId" value={lotId} /> : null}
      {modelId ? <input type="hidden" name="modelId" value={modelId} /> : null}
      <input type="hidden" name={STARTED_AT_FIELD} value={startedAt} />
      {/* Campo trampa: invisible para las personas; los bots lo llenan. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <input id={fid("website")} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {generalError || hasFieldErrors ? (
        <p role="alert" className="rounded-xl bg-destructive/10 p-4 font-bold text-destructive">
          {generalError ?? t("errors.title")}
        </p>
      ) : null}

      <Field id={fid("fullName")} label={t("fields.fullName")} error={errorText("fullName")}>
        <Input
          id={fid("fullName")}
          name="fullName"
          autoComplete="name"
          required
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby={describedBy(fid("fullName"), { error: Boolean(errors.fullName) })}
        />
      </Field>

      <Field id={fid("email")} label={t("fields.email")} error={errorText("email")}>
        <Input
          id={fid("email")}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(errors.email)}
          aria-describedby={describedBy(fid("email"), { error: Boolean(errors.email) })}
        />
      </Field>

      <Field
        id={fid("phone")}
        label={t("fields.phone")}
        hint={t("fields.phoneHint")}
        error={errorText("phone")}
      >
        <Input
          id={fid("phone")}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={describedBy(fid("phone"), { hint: true, error: Boolean(errors.phone) })}
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-bold">{t("fields.preferredChannel")}</legend>
        <div className="flex flex-wrap gap-2">
          {CONTACT_CHANNELS.map((channel) => (
            <label
              key={channel}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-4 font-bold has-[:checked]:border-brand has-[:checked]:bg-accent"
            >
              <input
                type="radio"
                name="preferredChannel"
                value={channel}
                defaultChecked={channel === "whatsapp"}
                className="size-5 accent-[var(--brand)]"
              />
              {t(`channels.${channel}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <Field id={fid("usState")} label={t("fields.usState")}>
        <Select id={fid("usState")} name="usState" defaultValue="" autoComplete="address-level1">
          <option value="">{t("fields.usStateNone")}</option>
          {US_STATES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        id={fid("message")}
        label={intent === "contact" ? t("fields.message") : t("fields.messageOptional")}
        error={errorText("message")}
      >
        <Textarea
          id={fid("message")}
          name="message"
          maxLength={2000}
          placeholder={t("fields.messagePlaceholder")}
          aria-invalid={Boolean(errors.message)}
        />
      </Field>

      {intent !== "video_call" ? (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 font-bold">
          <Checkbox
            name="wantsCall"
            checked={wantsCall}
            onChange={(e) => setWantsCall(e.currentTarget.checked)}
          />
          {t("fields.wantsCall")}
        </label>
      ) : null}

      <div className={cn("flex flex-col gap-5 rounded-2xl bg-muted/60 p-4", !wantsCall && "hidden")}>
        <Field id={fid("callDate")} label={t("fields.callDate")} error={errorText("videoCall.date")}>
          <Input
            id={fid("callDate")}
            name="callDate"
            type="date"
            min={browser?.min}
            max={browser?.max}
            required={wantsCall}
            aria-invalid={Boolean(errors["videoCall.date"])}
            aria-describedby={describedBy(fid("callDate"), { error: Boolean(errors["videoCall.date"]) })}
          />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-base font-bold">{t("fields.callTimeSlot")}</legend>
          <div className="flex flex-wrap gap-2">
            {TIME_SLOTS.map((slot) => (
              <label
                key={slot}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-4 font-bold has-[:checked]:border-brand has-[:checked]:bg-card"
              >
                <input
                  type="radio"
                  name="callTimeSlot"
                  value={slot}
                  defaultChecked={slot === "evening"}
                  className="size-5 accent-[var(--brand)]"
                />
                {t(`slots.${slot}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <Field
          id={fid("callTimezone")}
          label={t("fields.callTimezone")}
          error={errorText("videoCall.timezone")}
        >
          <Select id={fid("callTimezone")} name="callTimezone" key={defaultZone} defaultValue={defaultZone}>
            {zoneOptions.map((zone) => (
              <option key={zone} value={zone}>
                {(COMMON_TIMEZONES as readonly string[]).includes(zone)
                  ? t(`timezones.${zone as (typeof COMMON_TIMEZONES)[number]}`)
                  : t("timezones.detected", { zone })}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex cursor-pointer items-start gap-3">
          <Checkbox
            name="privacy"
            required
            className="mt-1"
            aria-invalid={Boolean(errors.privacy)}
            aria-describedby={errors.privacy ? fid("privacy-error") : undefined}
          />
          <span>
            {t.rich("fields.privacy", {
              link: (chunks) => (
                <Link href="/legal/privacy" className="font-bold text-brand underline underline-offset-4">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        {errors.privacy ? (
          <p id={fid("privacy-error")} className="text-sm font-bold text-destructive" role="alert">
            {errorText("privacy")}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? t("submit.pending") : t(`submit.${intent}`)}
      </Button>
    </form>
  );
}
