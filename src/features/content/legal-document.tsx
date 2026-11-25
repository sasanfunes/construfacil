import { TriangleAlert } from "lucide-react";
import { getMessages, getTranslations } from "next-intl/server";

import { PageIntro } from "@/components/shared/page-intro";
import type { AppLocale } from "@/i18n/routing";
import { formatDate } from "@/lib/format";

export const LEGAL_DOCS = ["terms", "privacy", "refunds", "payments"] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];

/** Fecha de la última revisión de las plantillas. Se actualiza cuando cambie el texto. */
const LAST_UPDATED = "2026-11-25";

/** Documento legal en plantilla, con aviso visible de que falta la revisión legal. */
export async function LegalDocument({ doc, locale }: { doc: LegalDoc; locale: AppLocale }) {
  const [t, messages] = await Promise.all([getTranslations("legal"), getMessages()]);
  // Secciones numeradas ("1", "2"…): Object.values las da en orden.
  const sections: Array<{ title: string; body: string }> = Object.values(messages.legal[doc].sections);
  return (
    <>
      <PageIntro title={t(`${doc}.title`)} intro={t(`${doc}.intro`)}>
        <p role="note" className="flex max-w-3xl items-start gap-3 rounded-2xl bg-accent p-4 font-bold">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
          {t("draftBanner")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("updated", { date: formatDate(LAST_UPDATED, locale) })}
        </p>
      </PageIntro>
      <article className="container-page flex max-w-3xl flex-col gap-8 pb-16">
        {sections.map((section, index) => (
          <section key={section.title} aria-labelledby={`legal-${index}`} className="flex flex-col gap-3">
            <h2 id={`legal-${index}`} className="text-2xl">
              {section.title}
            </h2>
            {section.body.split("\n\n").map((paragraph) => (
              <p key={paragraph} className="text-lg">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
        <p className="border-t pt-6 text-muted-foreground">{t("contactLine")}</p>
      </article>
    </>
  );
}
