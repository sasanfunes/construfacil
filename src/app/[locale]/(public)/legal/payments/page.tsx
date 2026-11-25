import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { LegalDocument } from "@/features/content/legal-document";
import type { AppLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("legal.payments");
  return pageMetadata({ locale, href: "/legal/payments", title: t("metaTitle"), description: t("intro") });
}

export default async function LegalPaymentsPage() {
  const locale = (await getLocale()) as AppLocale;
  return <LegalDocument doc="payments" locale={locale} />;
}
