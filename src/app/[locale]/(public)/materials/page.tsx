import { ArrowRight, MessageCircle, Package } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { PageIntro, SectionTitle } from "@/components/shared/page-intro";
import { whatsappHref } from "@/components/shared/whatsapp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("content.materials");
  return pageMetadata({
    locale,
    href: "/materials",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

const BUNDLES = ["foundation", "walls", "roof", "finishes"] as const;

export default async function MaterialsPage() {
  const t = await getTranslations("content.materials");
  const whatsapp = whatsappHref(t("whatsappMessage"));
  return (
    <>
      <PageIntro title={t("title")} intro={t("intro")}>
        <Badge variant="accent" className="self-start">
          {t("badge")}
        </Badge>
      </PageIntro>
      <div className="container-page flex flex-col gap-10 pb-16">
        <section aria-labelledby="bundles-title" className="flex flex-col gap-6">
          <SectionTitle id="bundles-title">{t("bundlesTitle")}</SectionTitle>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BUNDLES.map((key) => (
              <li key={key} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
                <Package aria-hidden="true" className="size-8 text-brand" />
                <h3 className="text-lg">{t(`bundles.${key}.title`)}</h3>
                <p className="text-muted-foreground">{t(`bundles.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col items-start gap-4 rounded-3xl bg-muted/50 p-6 md:p-10">
          <p className="max-w-prose text-lg">{t("now")}</p>
          {whatsapp ? (
            <Button asChild size="lg">
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" />
                {t("whatsappCta")}
              </a>
            </Button>
          ) : null}
          <Link
            href="/build/quote"
            className="inline-flex min-h-11 items-center gap-2 font-bold text-brand underline underline-offset-4"
          >
            {t("quoteLink")}
            <ArrowRight aria-hidden="true" className="size-5" />
          </Link>
        </section>
      </div>
    </>
  );
}
