"use client";

import { ArrowLeft, ArrowRight, Check, MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";

import { Usd } from "@/components/shared/price";
import { Button } from "@/components/ui/button";
import { Checkbox, describedBy, Field, Input, Select } from "@/components/ui/field";
import { HONEYPOT_FIELD, STARTED_AT_FIELD } from "@/features/leads/bot-check";
import {
  COMMON_TIMEZONES,
  type FormErrorKey,
  useBrowserCallDefaults,
} from "@/features/leads/components/lead-form";
import { CONTACT_CHANNELS, TIME_SLOTS, US_STATES } from "@/features/leads/schemas";
import { Link, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { formatUsd } from "@/lib/money";
import { squareMetersToVaras, squareVarasToMeters } from "@/lib/units";
import { cn } from "@/lib/utils";

import { saveQuote, trackFunnelEvent } from "../actions";
import {
  calculateQuote,
  CUSTOM_DESIGN_MAX_M2,
  CUSTOM_DESIGN_MIN_M2,
  estimatePerimeterM,
  QuoteInputError,
} from "../engine";
import type { FunnelEventInput } from "../schemas";
import type { LandStatus, QuoteInput, QuoteResult } from "../types";
import type { WizardData } from "../wizard-data";

import { QuoteResultView } from "./quote-result";

const STEPS = 7;
const DRAFT_KEY = "construfacil.quote-draft.v1";
const SESSION_KEY = "construfacil.funnel-session";

type DesignChoice = { kind: "model"; modelId: string } | { kind: "custom"; areaM2: string } | null;

type WizardState = {
  step: number;
  landStatus: LandStatus | null;
  lotId: string | null;
  departmentId: number | null;
  municipalityId: number | null;
  landArea: string;
  landUnit: "m2" | "varas";
  design: DesignChoice;
  finishLevelId: string | null;
  extras: Record<string, { selected: boolean; quantity: number }>;
};

type Preset = { lotSlug?: string; modelSlug?: string };

/**
 * Terreno o modelo que llega en la URL (`?lot=…` o `?model=…`, desde una ficha). Se lee en el
 * navegador: así la página del cotizador es estática y carga rápido desde la caché.
 */
function presetFromUrl(search: string): Preset {
  const params = new URLSearchParams(search);
  const slug = (value: string | null) => (value && /^[a-z0-9-]{1,80}$/.test(value) ? value : undefined);
  return { lotSlug: slug(params.get("lot")), modelSlug: slug(params.get("model")) };
}

function initialState(data: WizardData, preset: Preset): WizardState {
  const lot = preset.lotSlug ? data.rules.lots.find((l) => l.slug === preset.lotSlug) : undefined;
  const model = preset.modelSlug ? data.rules.models.find((m) => m.slug === preset.modelSlug) : undefined;
  const standard = data.rules.finishLevels.find((f) => f.key === "standard") ?? data.rules.finishLevels[0];
  return {
    step: 1,
    landStatus: lot ? "buying_from_us" : null,
    lotId: lot?.id ?? null,
    departmentId: lot?.departmentId ?? null,
    municipalityId: lot?.municipalityId ?? null,
    landArea: "",
    landUnit: "m2",
    design: model ? { kind: "model", modelId: model.id } : null,
    finishLevelId: standard?.id ?? null,
    extras: {},
  };
}

/** Convierte lo elegido en la entrada del motor. `null` si todavía falta algo. */
function toInput(state: WizardState, data: WizardData): QuoteInput | null {
  if (!state.landStatus || !state.finishLevelId || !state.design) return null;
  const lot = state.lotId ? data.rules.lots.find((l) => l.id === state.lotId) : undefined;
  if (state.landStatus === "buying_from_us" && !lot) return null;
  const departmentId = lot?.departmentId ?? state.departmentId;
  if (!departmentId) return null;

  const rawArea = Number(state.landArea.replace(",", "."));
  const landAreaM2 =
    lot?.areaM2 ??
    (state.landArea && rawArea > 0
      ? Math.round((state.landUnit === "varas" ? squareVarasToMeters(rawArea) : rawArea) * 100) / 100
      : null);

  let design: QuoteInput["design"];
  if (state.design.kind === "model") design = state.design;
  else {
    const area = Number(state.design.areaM2);
    if (!(area >= CUSTOM_DESIGN_MIN_M2 && area <= CUSTOM_DESIGN_MAX_M2)) return null;
    design = { kind: "custom", areaM2: area };
  }

  return {
    landStatus: state.landStatus,
    lotId: state.landStatus === "buying_from_us" ? (lot?.id ?? null) : null,
    departmentId,
    municipalityId: lot?.municipalityId ?? state.municipalityId,
    landAreaM2,
    design,
    finishLevelId: state.finishLevelId,
    extras: Object.entries(state.extras)
      .filter(([, v]) => v.selected)
      .map(([extraId, v]) => ({ extraId, quantity: v.quantity })),
  };
}

function safeCalculate(input: QuoteInput | null, data: WizardData): QuoteResult | null {
  if (!input) return null;
  try {
    return calculateQuote(input, data.rules);
  } catch (error) {
    if (error instanceof QuoteInputError) return null;
    throw error;
  }
}

function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Cotizador paso a paso. Calcula al instante en el navegador con las mismas reglas que
 * el servidor; al guardar, el servidor vuelve a calcular todo y guarda su resultado.
 */
export function QuoteWizard({ data, whatsappHref }: { data: WizardData; whatsappHref: string | null }) {
  const t = useTranslations("quote");
  const tf = useTranslations("forms");
  const tc = useTranslations("catalog");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const id = useId().replace(/:/g, "");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [state, setState] = useState<WizardState>(() => initialState(data, {}));
  const [restored, setRestored] = useState(false);
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [wantsCall, setWantsCall] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const browser = useBrowserCallDefaults();

  const { rules } = data;
  const input = useMemo(() => toInput(state, data), [state, data]);
  const result = useMemo(() => safeCalculate(input, data), [input, data]);
  const selectedLot = state.lotId ? rules.lots.find((l) => l.id === state.lotId) : undefined;
  const departmentId = selectedLot?.departmentId ?? state.departmentId;
  const regionFactor = rules.regionFactors.find((r) => r.departmentId === departmentId)?.factor ?? 1;

  const track = (event: FunnelEventInput["event"], step: number | null = null) => {
    void trackFunnelEvent({ event, step, sessionId: sessionId(), locale } satisfies FunnelEventInput);
  };

  // Aplica el terreno o modelo de la URL o, si no hay, recupera el borrador de esta pestaña.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- la URL y sessionStorage solo existen en el navegador */
    setStartedAt(Date.now());
    const preset = presetFromUrl(window.location.search);
    if (preset.lotSlug || preset.modelSlug) {
      setState(initialState(data, preset));
    } else {
      try {
        const saved = sessionStorage.getItem(DRAFT_KEY);
        if (saved) setState({ ...initialState(data, {}), ...(JSON.parse(saved) as Partial<WizardState>) });
      } catch {
        // Un borrador ilegible se ignora.
      }
    }
    setRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    track("quote_started");
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    } catch {
      // Sin almacenamiento (modo privado): el cotizador funciona igual.
    }
  }, [state, restored]);

  useEffect(() => {
    if (!restored) return;
    track(state.step === 6 ? "quote_estimate_viewed" : "quote_step_viewed", state.step);
    headingRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  const set = (patch: Partial<WizardState>) => setState((s) => ({ ...s, ...patch }));
  const go = (step: number) => {
    set({ step });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const stepValid = (() => {
    switch (state.step) {
      case 1:
        return state.landStatus !== null && (state.landStatus !== "buying_from_us" || Boolean(selectedLot));
      case 2:
        return Boolean(departmentId);
      case 3:
        return state.design?.kind === "model" || Boolean(input);
      case 4:
        return state.finishLevelId !== null;
      default:
        return true;
    }
  })();

  const landAreaM2 = input?.landAreaM2 ?? null;
  const priceFor = (patch: Partial<QuoteInput>): number | null => {
    if (!input && !(departmentId && state.landStatus)) return null;
    const base: QuoteInput = input ?? {
      landStatus: state.landStatus!,
      lotId: selectedLot?.id ?? null,
      departmentId: departmentId!,
      municipalityId: null,
      landAreaM2,
      design: { kind: "model", modelId: rules.models[0]?.id ?? "" },
      finishLevelId: state.finishLevelId ?? "",
      extras: [],
    };
    return safeCalculate({ ...base, extras: [], ...patch }, data)?.constructionUsdCents ?? null;
  };

  function toggleExtra(extraId: string, selected: boolean) {
    const extra = rules.extras.find((e) => e.id === extraId);
    if (!extra) return;
    const current = state.extras[extraId];
    let quantity = current?.quantity ?? extra.defaultQuantity;
    if (!current && extra.pricingUnit === "per_linear_m" && landAreaM2) {
      quantity = Math.min(extra.maxQuantity, Math.max(extra.minQuantity, estimatePerimeterM(landAreaM2)));
    }
    set({ extras: { ...state.extras, [extraId]: { selected, quantity } } });
  }

  function submit(form: HTMLFormElement) {
    if (!input) return;
    const values = new FormData(form);
    const text = (name: string) => (typeof values.get(name) === "string" ? String(values.get(name)) : "");
    setSaveError(null);
    setFieldErrors({});
    startSaving(async () => {
      const response = await saveQuote({
        locale,
        quote: input,
        contact: {
          fullName: text("fullName"),
          email: text("email"),
          phone: text("phone") || undefined,
          preferredChannel: text("preferredChannel") || "whatsapp",
          usState: text("usState") || undefined,
          privacy: values.get("privacy") === "on",
        },
        videoCall: wantsCall
          ? { date: text("callDate"), timeSlot: text("callTimeSlot"), timezone: text("callTimezone") }
          : null,
        sessionId: sessionId(),
        [HONEYPOT_FIELD]: text(HONEYPOT_FIELD),
        [STARTED_AT_FIELD]: startedAt,
      });
      if (response.status === "success") {
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          // nada
        }
        router.push(response.path as never);
        return;
      }
      if (response.error === "validation") {
        const errors: Record<string, string> = {};
        for (const [key, value] of Object.entries(response.fieldErrors ?? {})) {
          errors[key.replace(/^contact\./, "")] = value;
        }
        setFieldErrors(errors);
        setSaveError(tf("errors.title"));
      } else {
        setSaveError(tf(`errors.${response.error}`));
      }
    });
  }

  const fe = (key: string) => (fieldErrors[key] ? tf(`errors.${fieldErrors[key] as FormErrorKey}`) : null);
  const fid = (name: string) => `${id}-${name}`;
  const showBar = state.step >= 2 && state.step <= 5;

  return (
    <div className="flex flex-col gap-6">
      {/* Progreso */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-muted-foreground">
          {t("progress", { step: state.step, total: STEPS })}
        </p>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS}
          aria-valuenow={state.step}
          aria-label={t("progressLabel")}
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(state.step / STEPS) * 100}%` }}
          />
        </div>
      </div>

      <h2 ref={headingRef} tabIndex={-1} className="text-2xl outline-none md:text-3xl">
        {t(`steps.${state.step as 1 | 2 | 3 | 4 | 5 | 6 | 7}.title`)}
      </h2>
      {state.step <= 5 ? (
        <p className="-mt-3 text-muted-foreground">{t(`steps.${state.step as 1 | 2 | 3 | 4 | 5}.hint`)}</p>
      ) : null}

      {/* Paso 1: terreno */}
      {state.step === 1 ? (
        <div className="flex flex-col gap-4">
          <fieldset className="grid gap-3">
            <legend className="sr-only">{t("steps.1.title")}</legend>
            {(["own", "buying_from_us", "not_yet"] as const).map((status) => (
              <label
                key={status}
                className="flex min-h-14 cursor-pointer items-start gap-4 rounded-2xl border-2 bg-card p-4 has-[:checked]:border-brand has-[:checked]:ring-1 has-[:checked]:ring-brand"
              >
                <input
                  type="radio"
                  name="landStatus"
                  checked={state.landStatus === status}
                  onChange={() =>
                    set({ landStatus: status, lotId: status === "buying_from_us" ? state.lotId : null })
                  }
                  className="mt-1 size-5 accent-[var(--brand)]"
                />
                <span className="flex flex-col gap-1">
                  <span className="text-lg font-bold">{t(`land.${status}.label`)}</span>
                  <span className="text-muted-foreground">{t(`land.${status}.hint`)}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {state.landStatus === "buying_from_us" ? (
            <div className="flex flex-col gap-3">
              <Field id={fid("lot")} label={t("land.chooseLot")}>
                <Select
                  id={fid("lot")}
                  value={state.lotId ?? ""}
                  onChange={(e) => {
                    const lot = rules.lots.find((l) => l.id === e.currentTarget.value);
                    set({
                      lotId: lot?.id ?? null,
                      departmentId: lot?.departmentId ?? null,
                      municipalityId: lot?.municipalityId ?? null,
                    });
                  }}
                >
                  <option value="">{t("land.chooseLotPlaceholder")}</option>
                  {rules.lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.title[locale]}
                    </option>
                  ))}
                </Select>
              </Field>
              {selectedLot ? (
                <p className="rounded-xl border bg-card p-4">
                  <span className="font-bold">{selectedLot.title[locale]}</span>
                  <br />
                  <span className="text-muted-foreground">
                    {tc("facts.lotArea", {
                      m2: formatNumber(selectedLot.areaM2, locale),
                      varas: formatNumber(squareMetersToVaras(selectedLot.areaM2), locale),
                    })}
                  </span>
                  <br />
                  <Usd usdCents={selectedLot.priceUsdCents} className="font-bold" />
                </p>
              ) : null}
              <Link
                href="/land"
                className="inline-flex min-h-11 items-center font-bold text-brand underline underline-offset-4"
              >
                {t("land.browseLots")}
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Paso 2: ubicación y tamaño */}
      {state.step === 2 ? (
        selectedLot ? (
          <p className="rounded-xl border bg-card p-4">
            {t("location.fromLot", {
              place: `${data.municipalities.find((m) => m.id === selectedLot.municipalityId)?.name ?? ""}, ${
                rules.departments.find((d) => d.id === selectedLot.departmentId)?.name ?? ""
              }`,
            })}
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id={fid("department")} label={t("location.department")}>
              <Select
                id={fid("department")}
                value={state.departmentId ?? ""}
                onChange={(e) =>
                  set({ departmentId: Number(e.currentTarget.value) || null, municipalityId: null })
                }
              >
                <option value="">{t("location.choose")}</option>
                {rules.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id={fid("municipality")} label={t("location.municipality")}>
              <Select
                id={fid("municipality")}
                value={state.municipalityId ?? ""}
                disabled={!state.departmentId}
                onChange={(e) => set({ municipalityId: Number(e.currentTarget.value) || null })}
              >
                <option value="">{t("location.chooseOptional")}</option>
                {data.municipalities
                  .filter((m) => m.departmentId === state.departmentId)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </Select>
            </Field>
            {state.landStatus === "own" ? (
              <div className="flex flex-col gap-3 sm:col-span-2">
                <Field id={fid("landArea")} label={t("location.landArea")} hint={t("location.landAreaHint")}>
                  <Input
                    id={fid("landArea")}
                    inputMode="decimal"
                    value={state.landArea}
                    onChange={(e) => set({ landArea: e.currentTarget.value.replace(/[^\d.,]/g, "") })}
                    aria-describedby={describedBy(fid("landArea"), { hint: true })}
                  />
                </Field>
                <fieldset className="flex flex-wrap gap-2">
                  <legend className="sr-only">{t("location.unit")}</legend>
                  {(["m2", "varas"] as const).map((unit) => (
                    <label
                      key={unit}
                      className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-4 font-bold has-[:checked]:border-brand has-[:checked]:bg-accent"
                    >
                      <input
                        type="radio"
                        name="landUnit"
                        checked={state.landUnit === unit}
                        onChange={() => set({ landUnit: unit })}
                        className="size-5 accent-[var(--brand)]"
                      />
                      {t(`location.units.${unit}`)}
                    </label>
                  ))}
                </fieldset>
              </div>
            ) : null}
          </div>
        )
      ) : null}

      {/* Paso 3: diseño */}
      {state.step === 3 ? (
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">{t("steps.3.title")}</legend>
          {rules.models.map((model) => {
            const price = priceFor({ design: { kind: "model", modelId: model.id } });
            const small = landAreaM2 !== null && landAreaM2 < model.minLotAreaM2;
            return (
              <label
                key={model.id}
                className="flex cursor-pointer flex-col gap-2 rounded-2xl border-2 bg-card p-4 has-[:checked]:border-brand has-[:checked]:ring-1 has-[:checked]:ring-brand"
              >
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="design"
                    checked={state.design?.kind === "model" && state.design.modelId === model.id}
                    onChange={() => set({ design: { kind: "model", modelId: model.id } })}
                    className="mt-1 size-5 accent-[var(--brand)]"
                  />
                  <span className="flex flex-col gap-1">
                    <span className="text-lg font-bold">{model.name[locale]}</span>
                    <span className="text-sm text-muted-foreground">
                      {[
                        tc("facts.bedrooms", { count: model.bedrooms }),
                        tc("facts.bathrooms", { count: model.bathrooms }),
                        tc("facts.area", { value: formatNumber(model.areaM2, locale) }),
                      ].join(", ")}
                    </span>
                    {price !== null ? (
                      <span className="font-bold">
                        <Usd usdCents={price} />
                      </span>
                    ) : null}
                    {small ? (
                      <span className="text-sm font-bold text-primary">{t("design.tooSmall")}</span>
                    ) : null}
                  </span>
                </span>
              </label>
            );
          })}
          <label className="flex cursor-pointer flex-col gap-3 rounded-2xl border-2 bg-card p-4 has-[:checked]:border-brand has-[:checked]:ring-1 has-[:checked]:ring-brand sm:col-span-2">
            <span className="flex items-start gap-3">
              <input
                type="radio"
                name="design"
                checked={state.design?.kind === "custom"}
                onChange={() =>
                  set({
                    design: {
                      kind: "custom",
                      areaM2: state.design?.kind === "custom" ? state.design.areaM2 : "90",
                    },
                  })
                }
                className="mt-1 size-5 accent-[var(--brand)]"
              />
              <span className="flex flex-col gap-1">
                <span className="text-lg font-bold">{t("design.custom")}</span>
                <span className="text-sm text-muted-foreground">{t("design.customHint")}</span>
              </span>
            </span>
            {state.design?.kind === "custom" ? (
              <Field
                id={fid("customArea")}
                label={t("design.customArea", { min: CUSTOM_DESIGN_MIN_M2, max: CUSTOM_DESIGN_MAX_M2 })}
              >
                <Input
                  id={fid("customArea")}
                  inputMode="numeric"
                  value={state.design.areaM2}
                  onChange={(e) =>
                    set({ design: { kind: "custom", areaM2: e.currentTarget.value.replace(/\D/g, "") } })
                  }
                />
              </Field>
            ) : null}
          </label>
        </fieldset>
      ) : null}

      {/* Paso 4: acabados */}
      {state.step === 4 ? (
        <fieldset className="grid gap-3 md:grid-cols-3">
          <legend className="sr-only">{t("steps.4.title")}</legend>
          {rules.finishLevels.map((finish) => {
            const price = priceFor({ finishLevelId: finish.id });
            return (
              <label
                key={finish.id}
                className="flex cursor-pointer flex-col gap-3 rounded-2xl border-2 bg-card p-4 has-[:checked]:border-brand has-[:checked]:ring-1 has-[:checked]:ring-brand"
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="finish"
                    checked={state.finishLevelId === finish.id}
                    onChange={() => set({ finishLevelId: finish.id })}
                    className="size-5 accent-[var(--brand)]"
                  />
                  <span className="text-lg font-bold">{finish.name[locale]}</span>
                </span>
                {price !== null ? <Usd usdCents={price} className="text-xl font-bold" /> : null}
                <span className="text-sm text-muted-foreground">{finish.description[locale]}</span>
                <ul className="flex flex-col gap-1 text-sm">
                  {finish.includes[locale].map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
                      {item}
                    </li>
                  ))}
                </ul>
              </label>
            );
          })}
        </fieldset>
      ) : null}

      {/* Paso 5: extras */}
      {state.step === 5 ? (
        <ul className="grid gap-3">
          {rules.extras.map((extra) => {
            const choice = state.extras[extra.id];
            const unit =
              Math.round((extra.unitPriceUsdCents * (extra.appliesRegionFactor ? regionFactor : 1)) / 100) *
              100;
            const hasQuantity = extra.pricingUnit !== "fixed" && extra.maxQuantity > 1;
            return (
              <li
                key={extra.id}
                className="flex flex-col gap-3 rounded-2xl border-2 bg-card p-4 has-[:checked]:border-brand"
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={Boolean(choice?.selected)}
                    onChange={(e) => toggleExtra(extra.id, e.currentTarget.checked)}
                    className="mt-1"
                  />
                  <span className="flex flex-1 flex-col gap-1">
                    <span className="flex flex-wrap justify-between gap-2">
                      <span className="text-lg font-bold">{extra.name[locale]}</span>
                      <span className="font-bold">
                        {t(`extras.unit.${extra.pricingUnit}`, { price: formatUsd(unit, locale) })}
                      </span>
                    </span>
                    <span className="text-sm text-muted-foreground">{extra.description[locale]}</span>
                  </span>
                </label>
                {choice?.selected && hasQuantity ? (
                  <Field
                    id={fid(`qty-${extra.key}`)}
                    label={t(`extras.quantity.${extra.pricingUnit}`)}
                    className="max-w-56"
                  >
                    <Input
                      id={fid(`qty-${extra.key}`)}
                      type="number"
                      inputMode="numeric"
                      min={extra.minQuantity}
                      max={extra.maxQuantity}
                      value={choice.quantity}
                      onChange={(e) => {
                        const value = Math.round(Number(e.currentTarget.value));
                        const quantity = Math.min(
                          extra.maxQuantity,
                          Math.max(extra.minQuantity, Number.isFinite(value) ? value : extra.minQuantity),
                        );
                        set({ extras: { ...state.extras, [extra.id]: { selected: true, quantity } } });
                      }}
                    />
                  </Field>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* Paso 6: resultado */}
      {state.step === 6 ? (
        result ? (
          <div className="flex flex-col gap-6">
            <QuoteResultView
              result={result}
              stages={rules.stages}
              extras={rules.extras}
              usdToHnl={data.usdToHnl}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" onClick={() => go(7)}>
                {t("result.saveCta")}
              </Button>
              <Button variant="outline" onClick={() => go(3)}>
                {t("result.changeCta")}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{t("result.saveHint")}</p>
          </div>
        ) : (
          <p className="rounded-2xl bg-accent p-4">{t("result.incomplete")}</p>
        )
      ) : null}

      {/* Paso 7: datos de contacto */}
      {state.step === 7 ? (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit(event.currentTarget);
          }}
          className="flex max-w-2xl flex-col gap-5"
        >
          {result ? (
            <p className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border bg-card p-4">
              <span className="font-bold">{t("contact.summary")}</span>
              <Usd usdCents={result.grandTotalUsdCents} className="text-xl font-bold" />
            </p>
          ) : null}
          {saveError ? (
            <p role="alert" className="rounded-xl bg-destructive/10 p-4 font-bold text-destructive">
              {saveError}
            </p>
          ) : null}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <input name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
          </div>
          <Field id={fid("fullName")} label={tf("fields.fullName")} error={fe("fullName")}>
            <Input
              id={fid("fullName")}
              name="fullName"
              autoComplete="name"
              required
              aria-invalid={Boolean(fieldErrors.fullName)}
            />
          </Field>
          <Field
            id={fid("email")}
            label={tf("fields.email")}
            hint={t("contact.emailHint")}
            error={fe("email")}
          >
            <Input
              id={fid("email")}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={describedBy(fid("email"), { hint: true, error: Boolean(fieldErrors.email) })}
            />
          </Field>
          <Field
            id={fid("phone")}
            label={tf("fields.phone")}
            hint={tf("fields.phoneHint")}
            error={fe("phone")}
          >
            <Input
              id={fid("phone")}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              aria-invalid={Boolean(fieldErrors.phone)}
              aria-describedby={describedBy(fid("phone"), { hint: true, error: Boolean(fieldErrors.phone) })}
            />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-bold">{tf("fields.preferredChannel")}</legend>
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
                  {tf(`channels.${channel}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <Field id={fid("usState")} label={tf("fields.usState")}>
            <Select id={fid("usState")} name="usState" defaultValue="" autoComplete="address-level1">
              <option value="">{tf("fields.usStateNone")}</option>
              {US_STATES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 font-bold">
            <Checkbox checked={wantsCall} onChange={(e) => setWantsCall(e.currentTarget.checked)} />
            {tf("fields.wantsCall")}
          </label>
          {wantsCall ? (
            <div className="flex flex-col gap-5 rounded-2xl bg-muted/60 p-4">
              <Field id={fid("callDate")} label={tf("fields.callDate")} error={fe("videoCall.date")}>
                <Input
                  id={fid("callDate")}
                  name="callDate"
                  type="date"
                  min={browser?.min}
                  max={browser?.max}
                  required
                />
              </Field>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 font-bold">{tf("fields.callTimeSlot")}</legend>
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
                      {tf(`slots.${slot}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field id={fid("callTimezone")} label={tf("fields.callTimezone")}>
                <Select
                  id={fid("callTimezone")}
                  name="callTimezone"
                  key={browser?.zone ?? "default"}
                  defaultValue={browser?.zone ?? "America/New_York"}
                >
                  {[
                    ...(browser?.zone && !(COMMON_TIMEZONES as readonly string[]).includes(browser.zone)
                      ? [browser.zone]
                      : []),
                    ...COMMON_TIMEZONES,
                  ].map((zone) => (
                    <option key={zone} value={zone}>
                      {(COMMON_TIMEZONES as readonly string[]).includes(zone)
                        ? tf(`timezones.${zone as (typeof COMMON_TIMEZONES)[number]}`)
                        : tf("timezones.detected", { zone })}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                name="privacy"
                required
                className="mt-1"
                aria-invalid={Boolean(fieldErrors.privacy)}
              />
              <span>
                {tf.rich("fields.privacy", {
                  link: () => (
                    <Link href="/legal/privacy" className="font-bold text-brand underline underline-offset-4">
                      {tf("fields.privacyLink")}
                    </Link>
                  ),
                })}
              </span>
            </label>
            {fe("privacy") ? (
              <p className="text-sm font-bold text-destructive" role="alert">
                {fe("privacy")}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={saving || !input}>
              {saving ? tf("submit.pending") : t("contact.submit")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => go(6)}>
              <ArrowLeft aria-hidden="true" />
              {t("nav.back")}
            </Button>
          </div>
        </form>
      ) : null}

      {/* Navegación de los pasos 1 a 5, con el estimado siempre a la vista */}
      {state.step <= 5 ? (
        <div
          className={cn(
            "sticky bottom-0 z-20 -mx-5 border-t bg-background/95 px-5 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0",
            "pr-20 md:pr-0",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            {showBar && result ? (
              <p className="flex flex-col" aria-live="polite">
                <span className="text-sm text-muted-foreground">{t("estimate")}</span>
                <Usd usdCents={result.totalUsdCents} className="text-xl font-bold" />
              </p>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              {state.step > 1 ? (
                <Button variant="ghost" onClick={() => go(state.step - 1)} aria-label={t("nav.back")}>
                  <ArrowLeft aria-hidden="true" />
                  <span className="hidden sm:inline">{t("nav.back")}</span>
                </Button>
              ) : null}
              <Button
                variant="brand"
                disabled={!stepValid}
                onClick={() => go(state.step === 5 ? 6 : state.step + 1)}
              >
                {state.step === 5 ? t("nav.seeResult") : t("nav.next")}
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {whatsappHref ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 self-start font-bold text-brand underline underline-offset-4"
        >
          <MessageCircle aria-hidden="true" className="size-5" />
          {t("helpWhatsapp")}
        </a>
      ) : null}
    </div>
  );
}
