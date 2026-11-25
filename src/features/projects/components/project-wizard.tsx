"use client";

import { ArrowLeft, ArrowRight, Bath, BedDouble, Ruler } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";

import { Usd } from "@/components/shared/price";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, describedBy, Field, Input, Select } from "@/components/ui/field";
import { LotLegalBadge } from "@/features/catalog/components/cards";
import { HouseIllustration, LotIllustration } from "@/features/catalog/components/illustrations";
import { trackFunnelEvent } from "@/features/funnel/actions";
import type { FunnelEventInput } from "@/features/funnel/schemas";
import { HONEYPOT_FIELD, STARTED_AT_FIELD } from "@/features/leads/bot-check";
import type { FormErrorKey } from "@/features/leads/components/lead-form";
import { CONTACT_CHANNELS, US_STATES } from "@/features/leads/schemas";
import { Link, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { squareMetersToVaras, squareVarasToMeters } from "@/lib/units";
import { cn } from "@/lib/utils";

import { saveProject } from "../actions";
import { normalizeOptionIds, safeEstimate } from "../engine";
import { projectNameSchema } from "../schemas";
import {
  BUILD_STAGES,
  CUSTOM_AREA_MAX_M2,
  CUSTOM_AREA_MIN_M2,
  MAX_BATHROOMS,
  MAX_BEDROOMS,
  type BuildStage,
  type DesignSource,
  type LandStatus,
  type OptionCategory,
  type ProjectInput,
} from "../types";
import type { ProjectWizardData } from "../wizard-data";

import { EstimateSummary } from "./estimate-summary";
import { StageOptions } from "./stage-options";

const DRAFT_KEY = "construfacil.project-draft.v1";
const SESSION_KEY = "construfacil.funnel-session";

type StepId =
  | "name"
  | "land"
  | "location"
  | "lot"
  | "plans"
  | "design"
  | "details"
  | "model"
  | BuildStage
  | "summary"
  | "save";

/** Número estable de cada paso para el embudo (1 a 10), aunque la lista de pasos cambie. */
const FUNNEL_STEP: Record<StepId, number> = {
  name: 1,
  land: 2,
  location: 3,
  lot: 3,
  plans: 4,
  design: 4,
  details: 4,
  model: 4,
  foundation: 5,
  grey_work: 6,
  roof: 7,
  finishes: 8,
  summary: 9,
  save: 10,
};

type WizardState = {
  stepId: StepId;
  name: string;
  landStatus: LandStatus | null;
  lotId: string | null;
  lotFilter: number | null;
  departmentId: number | null;
  municipalityId: number | null;
  landArea: string;
  landUnit: "m2" | "varas";
  hasPlans: boolean | null;
  designChoice: "custom" | "catalog" | null;
  houseModelId: string | null;
  area: string;
  floors: 1 | 2;
  bedrooms: number;
  bathrooms: number;
  optionIds: string[];
};

const INITIAL: WizardState = {
  stepId: "name",
  name: "",
  landStatus: null,
  lotId: null,
  lotFilter: null,
  departmentId: null,
  municipalityId: null,
  landArea: "",
  landUnit: "m2",
  hasPlans: null,
  designChoice: null,
  houseModelId: null,
  area: "",
  floors: 1,
  bedrooms: 3,
  bathrooms: 2,
  optionIds: [],
};

function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

/** Terreno, modelo o "comprar terreno" que llegan en la URL (desde otra página del sitio). */
function presetFromUrl(search: string, data: ProjectWizardData): Partial<WizardState> {
  const params = new URLSearchParams(search);
  const slug = (value: string | null) => (value && /^[a-z0-9-]{1,80}$/.test(value) ? value : undefined);
  const lot = data.rules.lots.find((l) => l.slug === slug(params.get("lot")));
  const model = data.rules.models.find((m) => m.slug === slug(params.get("model")));
  const preset: Partial<WizardState> = {};
  if (lot)
    Object.assign(preset, { landStatus: "buying_from_us", lotId: lot.id, lotFilter: lot.departmentId });
  else if (params.get("land") === "buy") Object.assign(preset, { landStatus: "buying_from_us" });
  if (model) Object.assign(preset, { designChoice: "catalog", houseModelId: model.id });
  return preset;
}

function parseNumber(value: string): number | null {
  const n = Number(value.replace(",", "."));
  return value.trim() !== "" && Number.isFinite(n) ? n : null;
}

/**
 * Onboarding de "Construir": nombre, terreno, diseño, materiales por etapa, resumen y
 * guardar. El costo se calcula en vivo en el navegador; al guardar, el servidor lo vuelve
 * a calcular con las reglas de la base y guarda su resultado.
 */
export function ProjectWizard({
  data,
  whatsappHref,
}: {
  data: ProjectWizardData;
  whatsappHref: string | null;
}) {
  const t = useTranslations("projects.wizard");
  const tp = useTranslations("projects");
  const tf = useTranslations("forms");
  const tc = useTranslations("catalog");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const id = useId().replace(/:/g, "");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [state, setState] = useState<WizardState>(INITIAL);
  const [restored, setRestored] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [startedAt, setStartedAt] = useState(0);
  const { rules } = data;

  const set = (patch: Partial<WizardState>) => setState((s) => ({ ...s, ...patch }));
  const track = (event: FunnelEventInput["event"], step: number | null = null) => {
    void trackFunnelEvent({ event, step, sessionId: sessionId(), locale } satisfies FunnelEventInput);
  };

  // Al montar: lo que trae la URL o, si no trae nada, el borrador de esta pestaña.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- la URL y sessionStorage solo existen en el navegador */
    setStartedAt(Date.now());
    const preset = presetFromUrl(window.location.search, data);
    if (Object.keys(preset).length > 0) {
      setState((s) => ({ ...s, ...preset }));
    } else {
      try {
        const saved = sessionStorage.getItem(DRAFT_KEY);
        if (saved) setState({ ...INITIAL, ...(JSON.parse(saved) as Partial<WizardState>) });
      } catch {
        // Un borrador ilegible se ignora.
      }
    }
    setRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    track("project_started");
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    } catch {
      // Sin almacenamiento (modo privado): el onboarding funciona igual.
    }
  }, [state, restored]);

  useEffect(() => {
    if (!restored) return;
    track(
      state.stepId === "summary" ? "project_estimate_viewed" : "project_step_viewed",
      FUNNEL_STEP[state.stepId],
    );
    headingRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stepId]);

  // --- Valores derivados ---------------------------------------------------------------
  const selectedLot = state.lotId ? rules.lots.find((l) => l.id === state.lotId) : undefined;
  const model = state.houseModelId ? rules.models.find((m) => m.id === state.houseModelId) : undefined;
  const designSource: DesignSource | null =
    state.landStatus === "own" && state.hasPlans ? "own_plans" : state.designChoice;
  const floors: 1 | 2 = designSource === "catalog" && model ? (model.floors >= 2 ? 2 : 1) : state.floors;
  const optionIds = useMemo(
    () => normalizeOptionIds(rules.options, state.optionIds, floors),
    [rules.options, state.optionIds, floors],
  );
  const landAreaValue = parseNumber(state.landArea);
  const landAreaM2 =
    landAreaValue === null
      ? null
      : state.landUnit === "varas"
        ? squareVarasToMeters(landAreaValue)
        : landAreaValue;
  const departmentId =
    state.landStatus === "buying_from_us" ? (selectedLot?.departmentId ?? null) : state.departmentId;
  const regionFactor = rules.regionFactors.find((r) => r.departmentId === departmentId)?.factor ?? 1;

  const input: ProjectInput | null = useMemo(() => {
    if (!state.landStatus || !designSource) return null;
    return {
      landStatus: state.landStatus,
      lotId: state.landStatus === "buying_from_us" ? state.lotId : null,
      departmentId: state.landStatus === "buying_from_us" ? null : state.departmentId,
      municipalityId: state.landStatus === "buying_from_us" ? null : state.municipalityId,
      landAreaM2:
        state.landStatus === "own" && landAreaM2 !== null ? Math.round(landAreaM2 * 100) / 100 : null,
      designSource,
      houseModelId: designSource === "catalog" ? state.houseModelId : null,
      areaM2: designSource === "catalog" ? null : parseNumber(state.area),
      floors,
      bedrooms: state.bedrooms,
      bathrooms: state.bathrooms,
      optionIds,
    };
  }, [state, designSource, landAreaM2, floors, optionIds]);
  const estimate = useMemo(() => safeEstimate(input, rules), [input, rules]);

  const steps: StepId[] = ["name", "land"];
  if (state.landStatus === "own") steps.push("location", "plans");
  else if (state.landStatus === "buying_from_us") steps.push("lot");
  else if (state.landStatus === "skipped") steps.push("location");
  if (designSource === "own_plans") steps.push("details");
  else {
    steps.push("design");
    if (state.designChoice === "custom") steps.push("details");
    else if (state.designChoice === "catalog") steps.push("model");
  }
  steps.push(...BUILD_STAGES, "summary", "save");
  const index = Math.max(0, steps.indexOf(state.stepId));
  const stage = (BUILD_STAGES as readonly string[]).includes(state.stepId)
    ? (state.stepId as BuildStage)
    : null;

  // --- Validación de cada paso ---------------------------------------------------------
  function stepProblem(): string | null {
    switch (state.stepId) {
      case "name": {
        const parsed = projectNameSchema.safeParse(state.name);
        if (parsed.success) return null;
        const code = parsed.error.issues[0]?.message;
        return code === "projectNameInvalid" ? t("errors.projectNameInvalid") : t("errors.nameRequired");
      }
      case "land":
        return state.landStatus ? null : t("errors.chooseLand");
      case "location":
        if (state.landStatus === "own" && !state.departmentId) return t("errors.chooseDepartment");
        if (state.landArea.trim() !== "" && !(landAreaM2 && landAreaM2 > 0 && landAreaM2 < 10_000_000)) {
          return t("errors.landArea");
        }
        return null;
      case "lot":
        return selectedLot ? null : t("errors.chooseLot");
      case "plans":
        return state.hasPlans === null ? t("errors.choosePlans") : null;
      case "design":
        return state.designChoice ? null : t("errors.chooseDesign");
      case "model":
        return model ? null : t("errors.chooseModel");
      case "details": {
        const area = parseNumber(state.area);
        return area !== null && area >= CUSTOM_AREA_MIN_M2 && area <= CUSTOM_AREA_MAX_M2
          ? null
          : t("errors.area", { min: CUSTOM_AREA_MIN_M2, max: CUSTOM_AREA_MAX_M2 });
      }
      case "save":
        return null;
      default:
        // Etapas y resumen: hace falta un estimado válido.
        return estimate ? null : t("errors.incomplete");
    }
  }

  function go(stepId: StepId) {
    setStepError(null);
    set({ stepId });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function next() {
    const problem = stepProblem();
    if (problem) {
      setStepError(problem);
      return;
    }
    const following = steps[index + 1];
    if (following) go(following);
  }

  function chooseOption(category: OptionCategory, optionId: string) {
    const others = optionIds.filter(
      (existing) => rules.options.find((o) => o.id === existing)?.category !== category,
    );
    set({ optionIds: [...others, optionId] });
  }

  function submit(form: HTMLFormElement) {
    if (!input || !estimate) return;
    const values = new FormData(form);
    const text = (name: string) => (typeof values.get(name) === "string" ? String(values.get(name)) : "");
    setSaveError(null);
    setFieldErrors({});
    startSaving(async () => {
      const response = await saveProject({
        locale,
        name: state.name,
        project: input,
        contact: {
          fullName: text("fullName"),
          email: text("email"),
          phone: text("phone") || undefined,
          preferredChannel: text("preferredChannel") || "whatsapp",
          usState: text("usState") || undefined,
          privacy: values.get("privacy") === "on",
        },
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
        setSaveError(errors.name ? t("errors.projectNameInvalid") : tf("errors.title"));
      } else {
        setSaveError(t(`errors.${response.error}`));
      }
    });
  }

  const fe = (key: string) => (fieldErrors[key] ? tf(`errors.${fieldErrors[key] as FormErrorKey}`) : null);
  const fid = (name: string) => `${id}-${name}`;
  const place = (municipalityId: number, deptId: number) =>
    tc("place", {
      municipality: data.municipalities.find((m) => m.id === municipalityId)?.name ?? "",
      department: rules.departments.find((d) => d.id === deptId)?.name ?? "",
    });

  /** Total si se eligiera este modelo, con lo demás como está. */
  const modelTotal = (modelId: string, modelFloors: number) =>
    safeEstimate(
      input && {
        ...input,
        designSource: "catalog",
        houseModelId: modelId,
        areaM2: null,
        floors: modelFloors >= 2 ? 2 : 1,
        optionIds: normalizeOptionIds(rules.options, optionIds, modelFloors),
      },
      rules,
    )?.totalUsdCents ?? null;

  const title = (() => {
    switch (state.stepId) {
      case "location":
        return state.landStatus === "own" ? t("location.titleOwn") : t("location.titleSkipped");
      case "details":
        return designSource === "own_plans" ? t("details.titlePlans") : t("details.titleCustom");
      case "foundation":
      case "grey_work":
      case "roof":
      case "finishes":
        return tp(`stages.${state.stepId}.name`);
      default:
        return t(`${state.stepId}.title`);
    }
  })();
  const hint = (() => {
    switch (state.stepId) {
      case "location":
        return state.landStatus === "skipped" ? t("location.hintSkipped") : null;
      case "details":
        return t("details.hint");
      case "foundation":
      case "grey_work":
      case "roof":
      case "finishes":
        return tp(`stages.${state.stepId}.description`);
      default:
        return t(`${state.stepId}.hint`);
    }
  })();

  const radioCard =
    "flex min-h-14 cursor-pointer items-start gap-4 rounded-2xl border-2 bg-card p-4 has-[:checked]:border-brand has-[:checked]:ring-1 has-[:checked]:ring-brand";

  return (
    <div className="flex flex-col gap-6 pb-28 md:pb-0">
      {/* Progreso */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-muted-foreground">
          {t("progress", { step: index + 1, total: steps.length })}
        </p>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={index + 1}
          aria-label={t("progressLabel")}
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((index + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {stage ? (
          <p className="text-sm font-bold text-primary">
            {t("stage.eyebrow", { number: BUILD_STAGES.indexOf(stage) + 1 })}
          </p>
        ) : null}
        <h2 ref={headingRef} tabIndex={-1} className="text-2xl outline-none md:text-3xl">
          {title}
        </h2>
        {hint ? <p className="max-w-2xl text-muted-foreground">{hint}</p> : null}
      </div>

      {/* Nombre */}
      {state.stepId === "name" ? (
        <form
          className="max-w-xl"
          onSubmit={(event) => {
            event.preventDefault();
            next();
          }}
        >
          <Field id={fid("name")} label={t("name.label")}>
            <Input
              id={fid("name")}
              value={state.name}
              maxLength={80}
              placeholder={t("name.placeholder")}
              autoComplete="off"
              onChange={(e) => set({ name: e.currentTarget.value })}
            />
          </Field>
        </form>
      ) : null}

      {/* ¿Tiene terreno? */}
      {state.stepId === "land" ? (
        <fieldset className="grid gap-3">
          <legend className="sr-only">{t("land.title")}</legend>
          {(["own", "buying_from_us", "skipped"] as const).map((status) => (
            <label key={status} className={radioCard}>
              <input
                type="radio"
                name={fid("land")}
                checked={state.landStatus === status}
                onChange={() => set({ landStatus: status })}
                className="mt-1 size-5 accent-[var(--brand)]"
              />
              <span className="flex flex-col gap-1">
                <span className="text-lg font-bold">{t(`land.${status}.label`)}</span>
                <span className="text-muted-foreground">{t(`land.${status}.hint`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {/* Ubicación (terreno propio, o dónde le gustaría construir) */}
      {state.stepId === "location" ? (
        <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
          <Field id={fid("department")} label={t("location.department")}>
            <Select
              id={fid("department")}
              value={state.departmentId ?? ""}
              onChange={(e) =>
                set({ departmentId: Number(e.currentTarget.value) || null, municipalityId: null })
              }
            >
              <option value="">
                {state.landStatus === "own" ? t("location.choose") : t("location.unknown")}
              </option>
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
              <option value="">{t("location.unknown")}</option>
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
                      name={fid("landUnit")}
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
      ) : null}

      {/* Comprar terreno: lista de terrenos */}
      {state.stepId === "lot" ? (
        <div className="flex flex-col gap-4">
          <Field id={fid("lotFilter")} label={t("lot.filter")} className="max-w-xs">
            <Select
              id={fid("lotFilter")}
              value={state.lotFilter ?? ""}
              onChange={(e) => set({ lotFilter: Number(e.currentTarget.value) || null })}
            >
              <option value="">{t("lot.all")}</option>
              {rules.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          {(() => {
            const lots = rules.lots.filter((l) => !state.lotFilter || l.departmentId === state.lotFilter);
            if (lots.length === 0) return <p className="rounded-2xl bg-muted/60 p-4">{t("lot.empty")}</p>;
            return (
              <fieldset className="grid gap-4 md:grid-cols-2">
                <legend className="sr-only">{t("lot.title")}</legend>
                {lots.map((lot) => (
                  <label key={lot.id} className={cn(radioCard, "flex-col gap-3 p-0")}>
                    <LotIllustration
                      seed={lot.slug}
                      className="aspect-[16/9] w-full overflow-hidden rounded-t-2xl"
                    />
                    <span className="flex items-start gap-3 px-4 pb-4">
                      <input
                        type="radio"
                        name={fid("lot")}
                        checked={state.lotId === lot.id}
                        onChange={() => set({ lotId: lot.id })}
                        className="mt-1 size-5 shrink-0 accent-[var(--brand)]"
                        aria-label={lot.title[locale]}
                      />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="flex flex-wrap gap-2">
                          <LotLegalBadge legalStatus={lot.legalStatus} />
                        </span>
                        <span className="text-lg font-bold">{lot.title[locale]}</span>
                        <span className="text-muted-foreground">
                          {place(lot.municipalityId, lot.departmentId)}
                        </span>
                        <span className="text-sm font-bold text-muted-foreground">
                          {tc("facts.lotArea", {
                            m2: formatNumber(lot.areaM2, locale),
                            varas: formatNumber(squareMetersToVaras(lot.areaM2), locale),
                          })}
                        </span>
                        <Usd usdCents={lot.priceUsdCents} className="text-xl font-bold" />
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            );
          })()}
        </div>
      ) : null}

      {/* ¿Tiene planos? */}
      {state.stepId === "plans" ? (
        <fieldset className="grid gap-3">
          <legend className="sr-only">{t("plans.title")}</legend>
          {([true, false] as const).map((value) => (
            <label key={String(value)} className={radioCard}>
              <input
                type="radio"
                name={fid("plans")}
                checked={state.hasPlans === value}
                onChange={() => set({ hasPlans: value })}
                className="mt-1 size-5 accent-[var(--brand)]"
              />
              <span className="flex flex-col gap-1">
                <span className="text-lg font-bold">{t(`plans.${value ? "yes" : "no"}.label`)}</span>
                <span className="text-muted-foreground">{t(`plans.${value ? "yes" : "no"}.hint`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {/* Diseño desde cero o del catálogo */}
      {state.stepId === "design" ? (
        <fieldset className="grid gap-3">
          <legend className="sr-only">{t("design.title")}</legend>
          {(["custom", "catalog"] as const).map((choice) => (
            <label key={choice} className={radioCard}>
              <input
                type="radio"
                name={fid("design")}
                checked={state.designChoice === choice}
                onChange={() => set({ designChoice: choice })}
                className="mt-1 size-5 accent-[var(--brand)]"
              />
              <span className="flex flex-col gap-1">
                <span className="text-lg font-bold">{t(`design.${choice}.label`)}</span>
                <span className="text-muted-foreground">{t(`design.${choice}.hint`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {/* Datos de la casa (planos propios o diseño a la medida) */}
      {state.stepId === "details" ? (
        <div className="grid max-w-2xl gap-5 sm:grid-cols-3">
          <Field
            id={fid("area")}
            label={t("details.area", { min: CUSTOM_AREA_MIN_M2, max: CUSTOM_AREA_MAX_M2 })}
            className="sm:col-span-3"
          >
            <Input
              id={fid("area")}
              inputMode="decimal"
              value={state.area}
              onChange={(e) => set({ area: e.currentTarget.value.replace(/[^\d.,]/g, "") })}
            />
          </Field>
          <Field id={fid("bedrooms")} label={t("details.bedrooms")}>
            <Select
              id={fid("bedrooms")}
              value={state.bedrooms}
              onChange={(e) => set({ bedrooms: Number(e.currentTarget.value) })}
            >
              {Array.from({ length: MAX_BEDROOMS + 1 }, (_, n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={fid("bathrooms")} label={t("details.bathrooms")}>
            <Select
              id={fid("bathrooms")}
              value={state.bathrooms}
              onChange={(e) => set({ bathrooms: Number(e.currentTarget.value) })}
            >
              {Array.from({ length: MAX_BATHROOMS }, (_, n) => (
                <option key={n + 1} value={n + 1}>
                  {n + 1}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : null}

      {/* Modelo del catálogo */}
      {state.stepId === "model" ? (
        <fieldset className="grid gap-4 md:grid-cols-2">
          <legend className="sr-only">{t("model.title")}</legend>
          {rules.models.map((m) => {
            const total = modelTotal(m.id, m.floors);
            const small = landAreaM2 !== null && state.landStatus === "own" && landAreaM2 < m.minLotAreaM2;
            const lotSmall = selectedLot ? selectedLot.areaM2 < m.minLotAreaM2 : false;
            return (
              <label key={m.id} className={cn(radioCard, "flex-col gap-3 p-0")}>
                <HouseIllustration
                  seed={m.slug}
                  floors={m.floors}
                  withCarport={m.floorPlan.length > 0}
                  className="aspect-[16/9] w-full overflow-hidden rounded-t-2xl"
                />
                <span className="flex items-start gap-3 px-4 pb-4">
                  <input
                    type="radio"
                    name={fid("model")}
                    checked={state.houseModelId === m.id}
                    onChange={() => set({ houseModelId: m.id })}
                    className="mt-1 size-5 shrink-0 accent-[var(--brand)]"
                    aria-label={m.name[locale]}
                  />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-lg font-bold">{m.name[locale]}</span>
                    <span className="text-muted-foreground">{m.summary[locale]}</span>
                    <span className="flex flex-wrap gap-x-4 text-sm font-bold text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <BedDouble aria-hidden="true" className="size-4" />
                        {tc("facts.bedrooms", { count: m.bedrooms })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Bath aria-hidden="true" className="size-4" />
                        {tc("facts.bathrooms", { count: m.bathrooms })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Ruler aria-hidden="true" className="size-4" />
                        {tc("facts.area", { value: formatNumber(m.areaM2, locale) })}
                      </span>
                    </span>
                    {small || lotSmall ? <Badge className="self-start">{t("model.tooSmall")}</Badge> : null}
                    {total !== null ? <Usd usdCents={total} className="text-xl font-bold" /> : null}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
      ) : null}

      {/* Etapas de obra */}
      {stage ? (
        <div className="flex flex-col gap-8">
          {stage === "foundation" ? (
            designSource === "catalog" ? (
              <p className="rounded-2xl bg-muted/60 p-4 font-bold">
                {t("stage.floorsLocked", { count: floors })}
              </p>
            ) : (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-3 font-display text-xl font-semibold">{t("stage.floors")}</legend>
                <div className="flex flex-wrap gap-2">
                  {([1, 2] as const).map((value) => (
                    <label
                      key={value}
                      className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-5 font-bold has-[:checked]:border-brand has-[:checked]:bg-accent"
                    >
                      <input
                        type="radio"
                        name={fid("floors")}
                        checked={state.floors === value}
                        onChange={() => set({ floors: value })}
                        className="size-5 accent-[var(--brand)]"
                      />
                      {tc("facts.floors", { count: value })}
                    </label>
                  ))}
                </div>
              </fieldset>
            )
          ) : null}
          <StageOptions
            idPrefix={fid(stage)}
            stage={stage}
            floors={floors}
            options={rules.options}
            selectedIds={optionIds}
            regionFactor={regionFactor}
            onSelect={chooseOption}
          />
        </div>
      ) : null}

      {/* Resumen */}
      {state.stepId === "summary" && estimate ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 rounded-2xl border bg-card p-5">
            <p className="font-display text-xl font-semibold">{state.name}</p>
            <p className="text-muted-foreground">
              {tp("summary.designFacts", {
                area: formatNumber(estimate.design.areaM2, locale),
                floors: estimate.design.floors,
                bedrooms: estimate.design.bedrooms,
                bathrooms: estimate.design.bathrooms,
              })}
            </p>
          </div>
          <EstimateSummary estimate={estimate} usdToHnl={data.usdToHnl} />
        </div>
      ) : null}

      {/* Guardar */}
      {state.stepId === "save" ? (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit(event.currentTarget);
          }}
          className="flex max-w-2xl flex-col gap-5"
        >
          {estimate ? (
            <p className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border bg-card p-4">
              <span className="font-bold">{state.name}</span>
              <Usd usdCents={estimate.grandTotalUsdCents} className="text-xl font-bold" />
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
              aria-describedby={describedBy(fid("fullName"), { error: Boolean(fieldErrors.fullName) })}
            />
          </Field>
          <Field id={fid("email")} label={tf("fields.email")} error={fe("email")}>
            <Input
              id={fid("email")}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={describedBy(fid("email"), { error: Boolean(fieldErrors.email) })}
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
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                name="privacy"
                required
                className="mt-1"
                aria-invalid={Boolean(fieldErrors.privacy)}
                aria-describedby={fieldErrors.privacy ? fid("privacy-error") : undefined}
              />
              <span>
                {tf.rich("fields.privacy", {
                  link: (chunks) => (
                    <Link href="/legal/privacy" className="font-bold text-brand underline underline-offset-4">
                      {chunks}
                    </Link>
                  ),
                })}
              </span>
            </label>
            {fieldErrors.privacy ? (
              <p id={fid("privacy-error")} className="text-sm font-bold text-destructive" role="alert">
                {fe("privacy")}
              </p>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{t("save.accountNote")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? t("save.pending") : t("save.submit")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => go("summary")}>
              <ArrowLeft aria-hidden="true" />
              {t("nav.back")}
            </Button>
          </div>
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center font-bold text-brand underline underline-offset-4"
            >
              {tf("success.whatsapp")}
            </a>
          ) : null}
        </form>
      ) : null}

      {stepError ? (
        <p role="alert" className="rounded-xl bg-destructive/10 p-4 font-bold text-destructive">
          {stepError}
        </p>
      ) : null}

      {/* Navegación: abajo y fija en el celular, con el estimado cuando ya hay. */}
      {state.stepId !== "save" ? (
        <div
          data-bottom-bar
          className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 shadow-[0_-4px_16px_rgba(14,39,73,0.08)] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none"
        >
          <div className="container-page flex items-center justify-between gap-3 md:px-0">
            {estimate && index >= steps.indexOf("foundation") && state.stepId !== "summary" ? (
              <p className="flex flex-col">
                <span className="text-xs font-bold text-muted-foreground">{t("estimate")}</span>
                <Usd usdCents={estimate.totalUsdCents} className="text-lg font-bold" />
              </p>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              {index > 0 ? (
                <Button type="button" variant="ghost" onClick={() => go(steps[index - 1]!)}>
                  <ArrowLeft aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">{t("nav.back")}</span>
                </Button>
              ) : null}
              <Button type="button" size="lg" onClick={next}>
                {state.stepId === "finishes"
                  ? t("nav.review")
                  : state.stepId === "summary"
                    ? t("nav.save")
                    : t("nav.next")}
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
