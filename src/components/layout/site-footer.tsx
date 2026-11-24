import { getTranslations } from "next-intl/server";
import { cacheLife } from "next/cache";

/** Con Cache Components no se puede leer la fecha durante el prerender; se cachea por días. */
async function getCurrentYear(): Promise<string> {
  "use cache";
  cacheLife("days");
  return String(new Date().getFullYear());
}

export async function SiteFooter() {
  const t = await getTranslations("common");
  const year = await getCurrentYear();

  return (
    <footer className="on-brand mt-auto bg-brand text-brand-foreground">
      <div className="container-page flex flex-col gap-3 py-10">
        <p className="font-display text-xl font-semibold tracking-tight">{t("brand")}</p>
        <p className="max-w-prose text-brand-muted">{t("footer.tagline")}</p>
        <p className="text-sm text-brand-muted">{t("footer.underConstruction")}</p>
        <p className="text-sm text-brand-muted">{t("footer.rights", { year })}</p>
      </div>
    </footer>
  );
}
