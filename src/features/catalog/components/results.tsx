import { List, MapIcon, SearchX } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export function ViewToggle({
  listHref,
  mapHref,
  current,
}: {
  listHref: string;
  mapHref: string;
  current: "list" | "map";
}) {
  const t = useTranslations("catalog.view");
  const item = (href: string, view: "list" | "map", Icon: typeof List) => (
    <a
      href={href}
      aria-current={current === view ? "page" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-bold",
        current === view ? "bg-brand text-brand-foreground" : "text-brand hover:bg-accent",
      )}
    >
      <Icon aria-hidden="true" className="size-5" />
      {t(view)}
    </a>
  );
  return (
    <nav aria-label={t("label")} className="inline-flex gap-1 rounded-full border bg-card p-1">
      {item(listHref, "list", List)}
      {item(mapHref, "map", MapIcon)}
    </nav>
  );
}

export function EmptyResults({
  title,
  body,
  clearHref,
  clearLabel,
  whatsappHref,
  whatsappLabel,
}: {
  title: string;
  body: string;
  clearHref: string;
  clearLabel: string;
  whatsappHref: string | null;
  whatsappLabel: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed bg-card p-8">
      <SearchX aria-hidden="true" className="size-10 text-brand" />
      <p className="font-display text-2xl font-semibold">{title}</p>
      <p className="max-w-prose text-muted-foreground">{body}</p>
      <div className="flex flex-wrap gap-4">
        <a
          href={clearHref}
          className="inline-flex min-h-11 items-center font-bold text-brand underline underline-offset-4"
        >
          {clearLabel}
        </a>
        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center font-bold text-brand underline underline-offset-4"
          >
            {whatsappLabel}
          </a>
        ) : null}
      </div>
    </div>
  );
}

/** Esqueleto mientras cargan los resultados. */
export function ResultsSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex flex-col overflow-hidden rounded-2xl border bg-card">
          <div className="aspect-[16/10] animate-pulse bg-muted" />
          <div className="flex flex-col gap-3 p-5">
            <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-8 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
