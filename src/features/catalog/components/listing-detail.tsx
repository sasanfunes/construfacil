import { CalendarDays, Check, FileCheck2, MessageCircle, PlayCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps, ReactNode } from "react";

import { Price, Usd } from "@/components/shared/price";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import type { SuggestedPayment } from "../payment-plan";
import type { HomeFeature } from "../types";

/** Bloques de la ficha de una casa o terreno. */

export function DetailSection({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id ? `${id}-title` : undefined}
      id={id}
      className="flex scroll-mt-24 flex-col gap-4"
    >
      <h2 id={id ? `${id}-title` : undefined} className="text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function FactsList({ items }: { items: ReadonlyArray<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-1 rounded-xl border bg-card p-4">
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="text-lg font-bold">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FeatureList({ features }: { features: readonly HomeFeature[] }) {
  const t = useTranslations("catalog.features");
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {features.map((feature) => (
        <li key={feature} className="flex items-center gap-3">
          <Check aria-hidden="true" className="size-5 shrink-0 text-success" />
          {t(feature)}
        </li>
      ))}
    </ul>
  );
}

export function SuggestedPlan({
  payments,
  kind,
}: {
  payments: readonly SuggestedPayment[];
  kind: "home" | "lot";
}) {
  const t = useTranslations("catalog");
  const hint = (key: SuggestedPayment["key"]) =>
    key === "deed" && kind === "lot" ? t("payments.deedLotHint") : t(`payments.${key}Hint`);
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {payments.map((payment, index) => (
          <li key={payment.key} className="flex items-start gap-4 rounded-xl border bg-card p-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-brand-foreground">
              {index + 1}
            </span>
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-bold">{t(`payments.${payment.key}`)}</span>
                <Usd usdCents={payment.amountUsdCents} className="text-lg font-bold" />
              </div>
              <span className="text-sm text-muted-foreground">{hint(payment.key)}</span>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">{t("paymentNote")}</p>
    </div>
  );
}

export function DocumentsList({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <FileCheck2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function MediaLinks({ videoUrl, tourUrl }: { videoUrl: string | null; tourUrl: string | null }) {
  const t = useTranslations("catalog.homes.detail");
  if (!videoUrl && !tourUrl) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {[
        [videoUrl, t("videoCta")],
        [tourUrl, t("tourCta")],
      ].map(([href, label]) =>
        href ? (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 font-bold text-brand underline underline-offset-4"
          >
            <PlayCircle aria-hidden="true" className="size-5" />
            {label}
          </a>
        ) : null,
      )}
    </div>
  );
}

type Href = ComponentProps<typeof Link>["href"];

/** Columna de precio y acciones. Un solo botón teja: la acción principal de la ficha. */
export function ListingActions({
  priceUsdCents,
  usdToHnl,
  primary,
  secondary,
  scheduleHref,
  scheduleLabel,
  whatsappHref,
  whatsappLabel,
  trustLine,
}: {
  priceUsdCents: number;
  usdToHnl: number;
  primary: { label: string; href: Href };
  secondary?: { label: string; href: Href };
  scheduleHref: Href;
  scheduleLabel: string;
  whatsappHref: string | null;
  whatsappLabel: string;
  trustLine: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm">
      <Price usdCents={priceUsdCents} usdToHnl={usdToHnl} size="lg" />
      <Button asChild size="lg">
        <Link href={primary.href}>{primary.label}</Link>
      </Button>
      {secondary ? (
        <Button asChild variant="outline">
          <Link href={secondary.href}>{secondary.label}</Link>
        </Button>
      ) : null}
      <Button asChild variant="outline">
        <Link href={scheduleHref}>
          <CalendarDays aria-hidden="true" />
          {scheduleLabel}
        </Link>
      </Button>
      {whatsappHref ? (
        <Button asChild variant="ghost">
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden="true" />
            {whatsappLabel}
          </a>
        </Button>
      ) : null}
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
        {trustLine}
      </p>
    </div>
  );
}
