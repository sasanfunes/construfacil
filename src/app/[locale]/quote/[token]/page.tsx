import { CalendarDays, Lock, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { whatsappHref } from "@/components/shared/whatsapp";
import { Button } from "@/components/ui/button";
import { getCatalog } from "@/features/catalog/data/load";
import { getLeadStore } from "@/features/leads/store";
import { hashQuoteToken, isWellFormedQuoteToken } from "@/features/leads/token";
import { QuoteResultView } from "@/features/quote/components/quote-result";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { formatDate, formatNumber } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("quote.private");
  return { title: t("metaTitle") };
}

/** La cotización guardada, tal como se calculó. Se abre solo con el token del enlace. */
export default async function SavedQuotePage({ params }: PageProps<"/[locale]/quote/[token]">) {
  await connection();
  const { token } = await params;
  if (!isWellFormedQuoteToken(token)) notFound();

  const [quote, catalog, t, locale] = await Promise.all([
    getLeadStore().findQuoteByTokenHash(hashQuoteToken(token)),
    getCatalog(),
    getTranslations("quote.private"),
    getLocale() as Promise<AppLocale>,
  ]);
  if (!quote) notFound();

  const { input, result } = quote;
  const lot = input.lotId ? catalog.lots.find((l) => l.id === input.lotId) : undefined;
  const model =
    input.design.kind === "model"
      ? catalog.models.find((m) => m.id === (input.design as { modelId: string }).modelId)
      : undefined;
  const finish = catalog.finishLevels.find((f) => f.id === input.finishLevelId);
  const department = catalog.departments.find((d) => d.id === input.departmentId);
  const municipality = input.municipalityId
    ? catalog.municipalities.find((m) => m.id === input.municipalityId)
    : undefined;
  const wa = whatsappHref(t("whatsappMessage", { code: quote.code }));
  const next = t.raw("next") as string[];

  const choices = [
    {
      label: t("land"),
      value:
        input.landStatus === "buying_from_us"
          ? t("landStatus.buying_from_us", { code: lot?.code ?? "" })
          : t(`landStatus.${input.landStatus}`),
    },
    ...(input.landAreaM2
      ? [{ label: t("land"), value: t("landArea", { value: formatNumber(input.landAreaM2, locale) }) }]
      : []),
    { label: t("location"), value: [municipality?.name, department?.name].filter(Boolean).join(", ") },
    {
      label: t("design"),
      value:
        input.design.kind === "custom"
          ? t("custom", { area: input.design.areaM2 })
          : (model?.name[locale] ?? ""),
    },
    { label: t("finish"), value: finish?.name[locale] ?? "" },
  ];

  return (
    <div className="container-page flex flex-col gap-10 py-8 md:py-12">
      <header className="flex flex-col gap-3">
        <p className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <Lock aria-hidden="true" className="size-4" />
          {t("code", { code: quote.code })}
        </p>
        <h1 className="text-3xl md:text-5xl">
          {quote.firstName ? t("greeting", { name: quote.firstName }) : t("greetingNoName")}
        </h1>
        <p className="text-muted-foreground">
          {t("created", { date: formatDate(quote.createdAt, locale) })}
          <br />
          {t("validUntil", { date: formatDate(quote.validUntil, locale) })}
        </p>
      </header>

      <section aria-labelledby="choices-title" className="flex flex-col gap-4">
        <h2 id="choices-title" className="text-2xl">
          {t("choicesTitle")}
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {choices.map((choice, index) => (
            <div
              key={`${choice.label}-${index}`}
              className="flex flex-col gap-1 rounded-xl border bg-card p-4"
            >
              <dt className="text-sm text-muted-foreground">{choice.label}</dt>
              <dd className="font-bold">{choice.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <QuoteResultView
        result={result}
        stages={catalog.stages}
        extras={catalog.extras}
        usdToHnl={quote.usdToHnl}
      />

      <section
        aria-labelledby="next-title"
        className="flex flex-col gap-5 rounded-3xl bg-muted/50 p-6 md:p-10"
      >
        <h2 id="next-title" className="text-2xl md:text-3xl">
          {t("nextTitle")}
        </h2>
        <ol className="flex flex-col gap-3">
          {next.map((item, index) => (
            <li key={item} className="flex items-start gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-brand-foreground">
                {index + 1}
              </span>
              <span className="pt-1">{item}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-3">
          {wa ? (
            <Button asChild size="lg">
              <a href={wa} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" />
                {t("whatsappCta")}
              </a>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="lg">
            <Link href="/schedule">
              <CalendarDays aria-hidden="true" />
              {t("scheduleCta")}
            </Link>
          </Button>
        </div>
        <Link
          href="/build/quote"
          className="inline-flex min-h-11 items-center self-start font-bold text-brand underline underline-offset-4"
        >
          {t("newQuote")}
        </Link>
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("privateNote")}
        </p>
      </section>
    </div>
  );
}
