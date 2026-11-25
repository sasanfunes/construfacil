import { CalendarDays, Clock, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { LocalHours } from "@/components/layout/local-hours";
import { PageIntro } from "@/components/shared/page-intro";
import { whatsappHref } from "@/components/shared/whatsapp";
import { Button } from "@/components/ui/button";
import { LeadForm } from "@/features/leads/components/lead-form";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { formatWhatsAppNumber, siteConfig } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("content.contact");
  return pageMetadata({ locale, href: "/contact", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function ContactPage() {
  const [t, tc] = await Promise.all([getTranslations("content.contact"), getTranslations("common")]);
  const whatsapp = whatsappHref(tc("whatsapp.defaultMessage"));
  const { weekdays, saturday, timeZone } = siteConfig.supportHours;

  return (
    <>
      <PageIntro title={t("title")} intro={t("intro")} />
      <div className="container-page grid grid-cols-1 gap-10 pb-16 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="form-title" className="flex min-w-0 flex-col gap-4">
          <h2 id="form-title" className="text-2xl">
            {t("formTitle")}
          </h2>
          <LeadForm intent="contact" whatsappHref={whatsapp} />
        </section>

        <aside className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
            <h2 className="flex items-center gap-2 text-xl">
              <MessageCircle aria-hidden="true" className="size-6 text-whatsapp" />
              {t("whatsappTitle")}
            </h2>
            {whatsapp && siteConfig.whatsappNumber ? (
              <>
                <p className="text-muted-foreground">{t("whatsappBody")}</p>
                <p className="text-lg font-bold">{formatWhatsAppNumber(siteConfig.whatsappNumber)}</p>
                <Button asChild variant="outline">
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                    {t("whatsappCta")}
                  </a>
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">{t("noWhatsapp")}</p>
            )}
          </div>

          <div className="on-brand flex flex-col gap-2 rounded-2xl bg-brand p-5 text-brand-foreground">
            <h2 className="flex items-center gap-2 text-xl">
              <Clock aria-hidden="true" className="size-6" />
              {t("hoursTitle")}
            </h2>
            <p className="text-sm text-brand-muted">{tc("footer.hoursTitle")}</p>
            <p>{tc("footer.hoursWeekdays", { open: weekdays.open, close: weekdays.close })}</p>
            <p>{tc("footer.hoursSaturday", { open: saturday.open, close: saturday.close })}</p>
            <LocalHours
              open={weekdays.open}
              close={weekdays.close}
              sourceTimeZone={timeZone}
              template={tc("footer.yourTime")}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
            <h2 className="flex items-center gap-2 text-xl">
              <CalendarDays aria-hidden="true" className="size-6 text-brand" />
              {t("scheduleTitle")}
            </h2>
            <p className="text-muted-foreground">{t("scheduleBody")}</p>
            <Button asChild variant="outline">
              <Link href="/schedule">{t("scheduleCta")}</Link>
            </Button>
          </div>
        </aside>
      </div>
    </>
  );
}
