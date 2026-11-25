"use client";

import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { AppLocale } from "@/i18n/routing";
import { formatUsd } from "@/lib/money";

import { includedCategoriesOf, optionsOf, userCategoriesOf } from "../engine";
import type { BuildStage, ConstructionOption, OptionCategory } from "../types";

/** Precio unitario de una opción, con el factor del departamento ("$115 por m²"). */
export function useUnitPrice() {
  const t = useTranslations("projects.pricing");
  const locale = useLocale() as AppLocale;
  return (option: ConstructionOption, regionFactor: number) => {
    if (option.unitPriceUsdCents === 0) return t("free");
    const cents = Math.round((option.unitPriceUsdCents * regionFactor) / 100) * 100;
    return t(option.pricingBasis, { price: formatUsd(cents, locale) });
  };
}

/**
 * Las opciones de una etapa: una lista de tarjetas por cada categoría que elige el cliente
 * y, al final, lo que va incluido. Se usa en el onboarding y en el panel del proyecto.
 */
export function StageOptions({
  idPrefix,
  stage,
  floors,
  options,
  selectedIds,
  regionFactor,
  onSelect,
  disabled = false,
}: {
  idPrefix: string;
  stage: BuildStage;
  floors: number;
  options: readonly ConstructionOption[];
  selectedIds: readonly string[];
  regionFactor: number;
  onSelect: (category: OptionCategory, optionId: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("projects");
  const locale = useLocale() as AppLocale;
  const unitPrice = useUnitPrice();
  const included = includedCategoriesOf(stage).flatMap((category) =>
    optionsOf(options, category).slice(0, 1),
  );

  return (
    <div className="flex flex-col gap-8">
      {userCategoriesOf(stage, floors).map((category) => (
        <fieldset key={category} className="flex flex-col gap-3" disabled={disabled}>
          <legend className="mb-3 font-display text-xl font-semibold">{t(`categories.${category}`)}</legend>
          <div className="grid gap-3 md:grid-cols-2">
            {optionsOf(options, category).map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 bg-card p-4 has-[:checked]:border-brand has-[:checked]:ring-1 has-[:checked]:ring-brand has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70"
              >
                <input
                  type="radio"
                  name={`${idPrefix}-${category}`}
                  value={option.id}
                  checked={selectedIds.includes(option.id)}
                  onChange={() => onSelect(category, option.id)}
                  className="mt-1 size-5 shrink-0 accent-[var(--brand)]"
                />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-bold">{option.name[locale]}</span>
                    {option.isDefault ? <Badge variant="brand">{t("wizard.stage.recommended")}</Badge> : null}
                  </span>
                  <span className="text-muted-foreground">{option.description[locale]}</span>
                  <span className="font-bold tabular-nums">{unitPrice(option, regionFactor)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {included.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-4">
          <p className="font-bold">{t("wizard.stage.included")}</p>
          <ul className="flex flex-col gap-2">
            {included.map((option) => (
              <li key={option.id} className="flex items-start gap-2">
                <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-success" />
                <span>
                  {t.rich("wizard.stage.includedItem", {
                    name: option.name[locale],
                    description: option.description[locale],
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
