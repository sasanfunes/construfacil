"use client";

import { useLocale } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type LocaleSwitcherProps = {
  label: string;
  /** Nombre corto visible ("ES") más el nombre completo para lectores de pantalla ("ES Español"). */
  names: Record<AppLocale, { short: string; full: string }>;
};

export function LocaleSwitcher({ label, names }: LocaleSwitcherProps) {
  const pathname = usePathname();
  const current = useLocale();

  return (
    <nav aria-label={label} className="flex items-center gap-1">
      {routing.locales.map((locale) => {
        const isCurrent = locale === current;
        return (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            lang={locale}
            hrefLang={locale}
            aria-current={isCurrent ? "true" : undefined}
            className={cn(
              "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 text-sm font-bold",
              isCurrent
                ? "bg-brand text-brand-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {names[locale].short}
            <span className="sr-only">{names[locale].full}</span>
          </Link>
        );
      })}
    </nav>
  );
}
