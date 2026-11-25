import { CircleHelp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";

import { GLOSSARY_TERMS, type GlossaryTerm } from "./glossary";

/**
 * Palabra con su explicación ("obra gris", "escritura"…). Usa el atributo `popover` del
 * navegador: funciona sin JavaScript, se cierra con Esc o tocando fuera, y es accesible.
 */
export function Term({ term, children }: { term: GlossaryTerm; children?: React.ReactNode }) {
  const t = useTranslations("common.glossary");
  const id = `term-${useId().replace(/:/g, "")}`;
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        className="inline-flex items-baseline gap-1 font-bold underline decoration-primary decoration-dotted decoration-2 underline-offset-4"
      >
        {children ?? t(`${term}.term`)}
        <CircleHelp aria-hidden="true" className="size-4 self-center" />
        <span className="sr-only">{t("whatIs")}</span>
      </button>
      <div
        id={id}
        popover="auto"
        className="m-auto max-w-sm rounded-2xl border bg-card p-5 text-card-foreground shadow-xl backdrop:bg-black/30"
      >
        <p className="mb-2 font-display text-lg font-semibold">{t(`${term}.term`)}</p>
        <p className="text-base">{t(`${term}.definition`)}</p>
        <button
          type="button"
          popoverTarget={id}
          popoverTargetAction="hide"
          className="mt-4 min-h-11 font-bold text-brand underline underline-offset-4"
        >
          {t("close")}
        </button>
      </div>
    </>
  );
}

export { GLOSSARY_TERMS };
