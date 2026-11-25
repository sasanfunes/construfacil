import { getTranslations } from "next-intl/server";
import { cacheLife } from "next/cache";

import { Link } from "@/i18n/navigation";
import { buildWhatsAppUrl, formatWhatsAppNumber, siteConfig } from "@/lib/site";

import { LocalHours } from "./local-hours";

/** Con Cache Components no se puede leer la fecha durante el prerender; se cachea por días. */
async function getCurrentYear(): Promise<string> {
  "use cache";
  cacheLife("days");
  return String(new Date().getFullYear());
}

const COLUMNS = [
  {
    title: "explore",
    links: [
      { href: "/homes", key: "nav.homes" },
      { href: "/land", key: "nav.land" },
      { href: "/build", key: "nav.build" },
      { href: "/calculator", key: "nav.calculator" },
      { href: "/materials", key: "nav.materials" },
    ],
  },
  {
    title: "company",
    links: [
      { href: "/how-it-works", key: "nav.howItWorks" },
      { href: "/why-trust-us", key: "nav.whyTrust" },
      { href: "/faq", key: "nav.faq" },
      { href: "/contact", key: "nav.contact" },
      { href: "/schedule", key: "nav.schedule" },
    ],
  },
  {
    title: "legal",
    links: [
      { href: "/legal/terms", key: "legalLinks.terms" },
      { href: "/legal/privacy", key: "legalLinks.privacy" },
      { href: "/legal/refunds", key: "legalLinks.refunds" },
      { href: "/legal/payments", key: "legalLinks.payments" },
    ],
  },
] as const;

export async function SiteFooter() {
  const t = await getTranslations("common");
  const year = await getCurrentYear();
  const { weekdays, saturday, timeZone } = siteConfig.supportHours;
  const whatsapp = siteConfig.whatsappNumber;

  return (
    <footer className="on-brand mt-auto bg-brand text-brand-foreground">
      <div className="container-page grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-3">
          <p className="font-display text-2xl font-semibold tracking-tight">{t("brand")}</p>
          <p className="max-w-prose text-brand-muted">{t("footer.tagline")}</p>
          <div className="flex flex-col gap-1">
            <p className="font-bold">{t("footer.hoursTitle")}</p>
            <p className="text-sm text-brand-muted">
              {t("footer.hoursWeekdays", { open: weekdays.open, close: weekdays.close })}
            </p>
            <p className="text-sm text-brand-muted">
              {t("footer.hoursSaturday", { open: saturday.open, close: saturday.close })}
            </p>
            <LocalHours
              open={weekdays.open}
              close={weekdays.close}
              sourceTimeZone={timeZone}
              template={t("footer.yourTime")}
            />
          </div>
          {whatsapp ? (
            <a
              href={buildWhatsAppUrl(whatsapp, t("whatsapp.defaultMessage"))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center font-bold underline underline-offset-4"
            >
              {t("footer.whatsapp", { number: formatWhatsAppNumber(whatsapp) })}
            </a>
          ) : null}
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={t(`footer.${column.title}`)}>
            <p className="mb-3 font-bold">{t(`footer.${column.title}`)}</p>
            <ul className="flex flex-col">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-11 items-center text-brand-muted underline-offset-4 hover:text-brand-foreground hover:underline"
                  >
                    {t(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/15">
        <div className="container-page flex flex-col gap-2 py-6 text-sm text-brand-muted">
          <p>{t("footer.legalEntity")}</p>
          <p>{t("footer.underConstruction")}</p>
          <p>{t("footer.rights", { year })}</p>
        </div>
      </div>
    </footer>
  );
}
