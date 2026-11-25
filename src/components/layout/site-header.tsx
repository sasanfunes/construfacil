import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { LocaleSwitcher } from "./locale-switcher";
import { MobileMenu } from "./mobile-menu";
import { NAV_ITEMS } from "./nav-items";

export async function SiteHeader() {
  const t = await getTranslations("common");

  const links = NAV_ITEMS.map(({ href, key }) => ({ href, label: t(`nav.${key}`) }));

  return (
    <header className="relative z-30 border-b bg-background">
      <div className="container-page flex min-h-16 items-center justify-between gap-3">
        <Link
          href="/"
          aria-label={t("header.homeLabel")}
          className="inline-flex min-h-11 items-center font-display text-xl font-semibold tracking-tight text-brand"
        >
          {t("brand")}
        </Link>

        <nav aria-label={t("header.mainNav")} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center rounded-full px-3 font-bold text-foreground hover:bg-accent"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1">
          <LocaleSwitcher
            label={t("localeSwitcher.label")}
            names={{
              es: { short: t("localeSwitcher.esShort"), full: t("localeSwitcher.es") },
              en: { short: t("localeSwitcher.enShort"), full: t("localeSwitcher.en") },
            }}
          />
          <MobileMenu openLabel={t("header.menu")} closeLabel={t("header.closeMenu")}>
            <nav aria-label={t("header.mainNav")} className="container-page py-3">
              <ul className="flex flex-col">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="flex min-h-12 items-center rounded-xl px-3 text-lg font-bold hover:bg-accent"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}
