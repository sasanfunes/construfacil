import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal.placeholder");
  return { title: t("metaTitle") };
}

/** Marcador de la Fase 0. El portal real (sesión, proyectos, avances) llega en la Fase 2. */
export default async function PortalPage() {
  // Espera a la petición: la página no se prerenderiza y recibe el nonce de la CSP.
  await connection();
  const t = await getTranslations("portal.placeholder");

  return (
    <div className="container-page flex flex-1 flex-col items-start justify-center gap-4 py-20">
      <h1 className="text-3xl md:text-4xl">{t("title")}</h1>
      <p className="max-w-prose text-muted-foreground">{t("description")}</p>
      <Button asChild variant="brand">
        <Link href="/">{t("cta")}</Link>
      </Button>
    </div>
  );
}
