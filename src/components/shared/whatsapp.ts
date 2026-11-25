import { buildWhatsAppUrl, siteConfig } from "@/lib/site";

/** Enlace de WhatsApp con un mensaje ya escrito, o null si no hay número configurado. */
export function whatsappHref(message: string): string | null {
  return siteConfig.whatsappNumber ? buildWhatsAppUrl(siteConfig.whatsappNumber, message) : null;
}
