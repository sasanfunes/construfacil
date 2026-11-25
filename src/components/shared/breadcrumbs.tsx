import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

import { Link } from "@/i18n/navigation";

type Href = ComponentProps<typeof Link>["href"];

export function Breadcrumbs({ items }: { items: ReadonlyArray<{ label: string; href?: Href }> }) {
  const t = useTranslations("common.breadcrumb");
  const all = [{ label: t("home"), href: "/" as Href }, ...items];
  return (
    <nav aria-label={t("label")} className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        {all.map((item, index) => {
          const last = index === all.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center underline-offset-4 hover:text-foreground hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={last ? "font-bold text-foreground" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!last ? <ChevronRight aria-hidden="true" className="size-4" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
