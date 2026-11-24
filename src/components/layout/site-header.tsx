import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { LocaleSwitcher } from "./locale-switcher";

export async function SiteHeader() {
  const t = await getTranslations("common");

  return (
    <header className="bg-background">
      <div className="container-page flex min-h-16 items-center justify-between gap-4">
        <Link
          href="/"
          aria-label={t("header.homeLabel")}
          className="inline-flex min-h-11 items-center font-display text-xl font-semibold tracking-tight text-brand"
        >
          {t("brand")}
        </Link>
        <LocaleSwitcher
          label={t("localeSwitcher.label")}
          names={{
            es: { short: t("localeSwitcher.esShort"), full: t("localeSwitcher.es") },
            en: { short: t("localeSwitcher.enShort"), full: t("localeSwitcher.en") },
          }}
        />
      </div>
    </header>
  );
}
