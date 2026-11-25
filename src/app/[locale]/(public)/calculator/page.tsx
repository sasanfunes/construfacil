import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import { PageIntro } from "@/components/shared/page-intro";
import { getCatalog } from "@/features/catalog/data/load";
import { RemittanceCalculator } from "@/features/remittance-calculator/components/remittance-calculator";
import { toCalculatorData } from "@/features/remittance-calculator/data";
import type { AppLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("calculator");
  return pageMetadata({
    locale,
    href: "/calculator",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function CalculatorPage() {
  const [t, catalog, messages] = await Promise.all([
    getTranslations("calculator"),
    getCatalog(),
    getMessages(),
  ]);
  return (
    <>
      <PageIntro title={t("title")} intro={t("intro")} />
      <div className="container-page pb-16">
        <NextIntlClientProvider messages={{ common: messages.common, calculator: messages.calculator }}>
          <RemittanceCalculator data={toCalculatorData(catalog)} />
        </NextIntlClientProvider>
      </div>
    </>
  );
}
