import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

export const FAQ_CATEGORIES = {
  payments: ["secure", "stages", "howToPay", "finalPrice"],
  build: ["duration", "seeProgress", "changes", "family"],
  legal: ["travel", "powerOfAttorney", "verifyTitle", "whereWork"],
} as const;

export type FaqKey = (typeof FAQ_CATEGORIES)[keyof typeof FAQ_CATEGORIES][number];

export const HOME_FAQ: readonly FaqKey[] = [
  "secure",
  "stages",
  "seeProgress",
  "travel",
  "finalPrice",
  "whereWork",
];

/** Preguntas con su respuesta plegable. <details> funciona sin JavaScript y con teclado. */
export function FaqList({ keys }: { keys: readonly FaqKey[] }) {
  const t = useTranslations("content.faq.items");
  return (
    <div className="flex flex-col gap-3">
      {keys.map((key) => (
        <details key={key} className="group rounded-2xl border bg-card">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-lg font-bold [&::-webkit-details-marker]:hidden">
            {t(`${key}.q`)}
            <ChevronDown
              aria-hidden="true"
              className="size-5 shrink-0 text-brand transition-transform group-open:rotate-180"
            />
          </summary>
          <p className="px-5 pb-5 text-base text-muted-foreground">{t(`${key}.a`)}</p>
        </details>
      ))}
    </div>
  );
}

/** Datos estructurados para buscadores (FAQPage). Es JSON, no un script ejecutable. */
export function faqJsonLd(items: ReadonlyArray<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
