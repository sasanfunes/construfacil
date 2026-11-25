import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ImageResponse } from "next/og";

import { routing } from "@/i18n/routing";

/** Imagen para compartir en WhatsApp y redes: la marca y el mensaje central, con la paleta B1. */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Es un Route Handler: aquí no hay root params, así que el idioma sale de `params`.
export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const requested = (await params).locale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const [t, tc] = await Promise.all([
    getTranslations({ locale, namespace: "home.hero" }),
    getTranslations({ locale, namespace: "common" }),
  ]);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#0e2749",
        color: "#ffffff",
      }}
    >
      <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>{tc("brand")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", fontSize: 68, fontWeight: 700, lineHeight: 1.1, maxWidth: 980 }}>
          {t("title")}
        </div>
        <div style={{ display: "flex", fontSize: 32, color: "#d5deec" }}>{t("subtitle")}</div>
      </div>
      <div style={{ display: "flex", width: 160, height: 14, borderRadius: 999, background: "#c2512f" }} />
    </div>,
    size,
  );
}
