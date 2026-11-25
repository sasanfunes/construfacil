"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common.error");

  useEffect(() => {
    // El detalle del error queda en los logs del servidor; aquí solo el identificador.
    console.error("Error de página", error.digest ?? error.message);
  }, [error]);

  return (
    <main
      id="contenido"
      className="container-page flex flex-1 flex-col items-start justify-center gap-4 py-20"
    >
      <h1 className="text-3xl md:text-4xl">{t("title")}</h1>
      <p className="max-w-prose text-muted-foreground">{t("description")}</p>
      <Button onClick={reset} variant="brand">
        {t("retry")}
      </Button>
    </main>
  );
}
