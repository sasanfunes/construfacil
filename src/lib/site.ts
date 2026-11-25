import { publicEnv } from "./env";

export const siteConfig = {
  name: "ConstruFácil",
  url: publicEnv.NEXT_PUBLIC_SITE_URL,
  whatsappNumber: publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER ?? null,
  allowIndexing: publicEnv.NEXT_PUBLIC_ALLOW_INDEXING === "true",
  /** EJEMPLO. Horario de atención en hora de Honduras (sin horario de verano). Pasará a ajustes en la Fase 2. */
  supportHours: {
    timeZone: "America/Tegucigalpa",
    weekdays: { open: "08:00", close: "18:00" },
    saturday: { open: "08:00", close: "12:00" },
  },
} as const;

/** Enlace que abre WhatsApp con un mensaje ya escrito. `number` va solo con dígitos. */
export function buildWhatsAppUrl(number: string, message?: string): string {
  const digits = number.replace(/\D/g, "");
  const url = new URL(`https://wa.me/${digits}`);
  if (message) url.searchParams.set("text", message);
  return url.toString();
}

/** Número para mostrar: "+504 0000-0000". */
export function formatWhatsAppNumber(number: string): string {
  const digits = number.replace(/\D/g, "");
  if (digits.startsWith("504") && digits.length === 11)
    return `+504 ${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.startsWith("1") && digits.length === 11) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return `+${digits}`;
}
