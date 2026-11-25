import { MessageCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { buildWhatsAppUrl, siteConfig } from "@/lib/site";

/**
 * Botón flotante de WhatsApp. Va en todas las páginas públicas.
 * Si todavía no hay número configurado, no se muestra.
 */
export async function WhatsAppButton() {
  if (!siteConfig.whatsappNumber) return null;
  const t = await getTranslations("common.whatsapp");

  return (
    <a
      href={buildWhatsAppUrl(siteConfig.whatsappNumber, t("defaultMessage"))}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("label")}
      data-testid="whatsapp-button"
      className="fixed right-4 bottom-4 z-40 inline-flex size-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-lg shadow-black/25 transition-transform hover:scale-105 md:right-6 md:bottom-6"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <MessageCircle aria-hidden="true" className="size-7" strokeWidth={2.25} />
    </a>
  );
}
