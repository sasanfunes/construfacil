import { useLocale, useTranslations } from "next-intl";

import type { AppLocale } from "@/i18n/routing";
import { formatHnlApprox, formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Precio en dólares con su equivalente aproximado en lempiras debajo.
 * El dólar es el precio oficial; el lempira es solo una referencia.
 */
export function Price({
  usdCents,
  usdToHnl,
  size = "md",
  className,
  onBrand = false,
}: {
  usdCents: number;
  usdToHnl: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  onBrand?: boolean;
}) {
  const t = useTranslations("common.price");
  const locale = useLocale() as AppLocale;
  return (
    <span className={cn("flex flex-col", className)}>
      <span
        className={cn(
          "font-display font-semibold tracking-tight tabular-nums",
          size === "lg" ? "text-3xl md:text-4xl" : size === "md" ? "text-2xl" : "text-xl",
        )}
      >
        {formatUsd(usdCents, locale)}
      </span>
      <span className={cn("text-sm tabular-nums", onBrand ? "text-brand-muted" : "text-muted-foreground")}>
        {t("approxHnl", { amount: formatHnlApprox(usdCents, usdToHnl, locale) })}
      </span>
    </span>
  );
}

/** Solo el monto en dólares, para tablas y listas. */
export function Usd({ usdCents, className }: { usdCents: number; className?: string }) {
  const locale = useLocale() as AppLocale;
  return <span className={cn("tabular-nums", className)}>{formatUsd(usdCents, locale)}</span>;
}
