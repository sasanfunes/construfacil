import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { atkinson, lexend } from "@/app/fonts";
import { routing } from "@/i18n/routing";
import { siteConfig } from "@/lib/site";

import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");

  return {
    metadataBase: new URL(siteConfig.url),
    title: { default: t("title"), template: t("titleTemplate") },
    description: t("description"),
    applicationName: siteConfig.name,
    // Hasta el lanzamiento el sitio muestra datos de ejemplo: no se indexa.
    robots: siteConfig.allowIndexing ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#0e2749",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations("common");
  // Al navegador solo viajan los textos que usan los componentes de cliente.
  const { common } = await getMessages();

  return (
    <html lang={locale} className={`${atkinson.variable} ${lexend.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#contenido"
          className="sr-only z-50 rounded-full bg-brand px-5 py-3 font-bold text-brand-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider messages={{ common }}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
