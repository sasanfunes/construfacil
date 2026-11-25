import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("common.notFound");

  return (
    <main
      id="contenido"
      className="container-page flex flex-1 flex-col items-start justify-center gap-4 py-20"
    >
      <h1 className="text-3xl md:text-4xl">{t("title")}</h1>
      <p className="max-w-prose text-muted-foreground">{t("description")}</p>
      <Button asChild variant="brand">
        <Link href="/">{t("cta")}</Link>
      </Button>
    </main>
  );
}
