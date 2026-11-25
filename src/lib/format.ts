import type { AppLocale } from "@/i18n/routing";

const DATE_LOCALE: Record<AppLocale, string> = { es: "es-HN", en: "en-US" };

/** "jueves, 27 de noviembre de 2026" a partir de "2026-11-27". La fecha no se corre por zona horaria. */
export function formatLongDate(isoDate: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));
}

/** "27 de noviembre de 2026". */
export function formatDate(isoDate: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));
}

/** "noviembre de 2026" para fechas estimadas de entrega. */
export function formatMonthYear(isoDate: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));
}

/** Números con separador de miles: "1,285". */
export function formatNumber(value: number, locale: AppLocale, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(DATE_LOCALE[locale], { maximumFractionDigits }).format(value);
}
