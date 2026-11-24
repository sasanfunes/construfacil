import { publicEnv } from "./env";

export const siteConfig = {
  name: "ConstruFácil",
  url: publicEnv.NEXT_PUBLIC_SITE_URL,
  whatsappNumber: publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER ?? null,
  allowIndexing: publicEnv.NEXT_PUBLIC_ALLOW_INDEXING === "true",
} as const;

/** Enlace que abre WhatsApp con un mensaje ya escrito. `number` va solo con dígitos. */
export function buildWhatsAppUrl(number: string, message?: string): string {
  const digits = number.replace(/\D/g, "");
  const url = new URL(`https://wa.me/${digits}`);
  if (message) url.searchParams.set("text", message);
  return url.toString();
}
