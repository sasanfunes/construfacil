import type { AppLocale } from "@/i18n/routing";

/**
 * Dinero. Reglas del proyecto:
 * - Todo monto se guarda y se calcula en centavos de dólar, como entero.
 * - El precio oficial es en USD. El lempira es una referencia aproximada.
 * - Los números se escriben como en Honduras y EE. UU.: coma para miles, punto para decimales.
 */

const NUMBER_LOCALE: Record<AppLocale, string> = { es: "es-HN", en: "en-US" };

export function assertCents(cents: number): void {
  if (!Number.isSafeInteger(cents)) {
    throw new TypeError(`Monto inválido: se esperaba un entero en centavos y llegó ${cents}`);
  }
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** "$48,500" o "$1,234.50". Sin decimales cuando el monto es de dólares cerrados. */
export function formatUsd(cents: number, locale: AppLocale = "es"): string {
  assertCents(cents);
  const hasCents = cents % 100 !== 0;
  const formatted = new Intl.NumberFormat(NUMBER_LOCALE[locale], {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(Math.abs(cents) / 100);
  return `${cents < 0 ? "-" : ""}$${formatted}`;
}

/** Convierte centavos de dólar a lempiras enteros con la tasa de referencia. */
export function usdCentsToHnl(cents: number, usdToHnl: number): number {
  assertCents(cents);
  if (!Number.isFinite(usdToHnl) || usdToHnl <= 0) {
    throw new RangeError(`Tipo de cambio inválido: ${usdToHnl}`);
  }
  return Math.round((cents / 100) * usdToHnl);
}

/**
 * Redondea para mostrar como "aprox.": un equivalente con centavos exactos daría
 * una precisión falsa, porque la tasa cambia a diario.
 */
export function roundHnlForDisplay(lempiras: number): number {
  const abs = Math.abs(lempiras);
  const step = abs >= 100_000 ? 1_000 : abs >= 10_000 ? 100 : abs >= 1_000 ? 10 : 1;
  return Math.round(lempiras / step) * step;
}

/** "L 1,285,000". El texto "aprox." lo pone el componente, desde las traducciones. */
export function formatHnlApprox(cents: number, usdToHnl: number, locale: AppLocale = "es"): string {
  const lempiras = roundHnlForDisplay(usdCentsToHnl(cents, usdToHnl));
  return `L ${new Intl.NumberFormat(NUMBER_LOCALE[locale], { maximumFractionDigits: 0 }).format(lempiras)}`;
}
