import { Check, Hammer, Home, MapPinned, Package, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { buildWhatsAppUrl, siteConfig } from "@/lib/site";

const PATHS = [
  { key: "readyHome", icon: Home },
  { key: "build", icon: Hammer },
  { key: "land", icon: MapPinned },
  { key: "materials", icon: Package },
] as const satisfies ReadonlyArray<{ key: string; icon: LucideIcon }>;

/**
 * Inicio provisional de la Fase 0: comprueba paleta, tipografías e idiomas.
 * La página completa (cómo funciona, calculadora, confianza, FAQ) llega en la Fase 1.
 */
export default async function HomePage() {
  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");

  return (
    <>
      <section className="on-brand bg-brand text-brand-foreground">
        <div className="container-page flex flex-col items-start gap-5 py-12 md:py-20">
          <h1 className="max-w-3xl text-4xl md:text-6xl">{t("hero.title")}</h1>
          <p className="max-w-xl text-lg text-brand-muted md:text-xl">{t("hero.subtitle")}</p>
          {siteConfig.whatsappNumber ? (
            <Button asChild size="lg">
              <a
                href={buildWhatsAppUrl(siteConfig.whatsappNumber, tCommon("whatsapp.defaultMessage"))}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("hero.cta")}
              </a>
            </Button>
          ) : null}
        </div>
      </section>

      <section className="container-page flex flex-col gap-8 py-10 md:py-16">
        <p className="flex items-center gap-3 font-bold">
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check aria-hidden="true" className="size-4" strokeWidth={3} />
          </span>
          {t("hero.trust")}
        </p>

        <h2 className="text-2xl md:text-3xl">{t("paths.title")}</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PATHS.map(({ key, icon: Icon }) => (
            <li key={key} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent text-brand">
                  <Icon aria-hidden="true" className="size-6" />
                </span>
                <span className="rounded-full bg-muted px-3 py-1 text-sm font-bold text-muted-foreground">
                  {t("paths.soon")}
                </span>
              </div>
              <h3 className="text-xl">{t(`paths.${key}.title`)}</h3>
              <p className="text-muted-foreground">{t(`paths.${key}.description`)}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
