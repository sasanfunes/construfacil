import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { JsonLd } from "@/components/shared/json-ld";
import { PageIntro, SectionTitle } from "@/components/shared/page-intro";
import { FAQ_CATEGORIES, faqJsonLd, FaqList } from "@/features/content/faq";
import type { AppLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("content.faq");
  return pageMetadata({ locale, href: "/faq", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function FaqPage() {
  const t = await getTranslations("content.faq");
  const categories = Object.entries(FAQ_CATEGORIES) as Array<
    [keyof typeof FAQ_CATEGORIES, (typeof FAQ_CATEGORIES)[keyof typeof FAQ_CATEGORIES]]
  >;
  const all = categories.flatMap(([, keys]) =>
    keys.map((key) => ({ q: t(`items.${key}.q`), a: t(`items.${key}.a`) })),
  );

  return (
    <>
      <JsonLd data={faqJsonLd(all)} />
      <PageIntro title={t("title")} intro={t("intro")} />
      <div className="container-page flex flex-col gap-12 pb-16">
        {categories.map(([category, keys]) => (
          <section key={category} aria-labelledby={`faq-${category}`} className="flex flex-col gap-4">
            <SectionTitle id={`faq-${category}`}>{t(`categories.${category}`)}</SectionTitle>
            <FaqList keys={keys} />
          </section>
        ))}
      </div>
    </>
  );
}
