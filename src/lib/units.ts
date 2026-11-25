/**
 * Unidades de superficie. En Honduras los terrenos se anuncian en varas cuadradas.
 * Una vara castellana mide 0.8359 m, así que una vara cuadrada son 0.69873 m².
 */
export const SQUARE_METERS_PER_SQUARE_VARA = 0.8359 * 0.8359;

export function squareMetersToVaras(m2: number): number {
  return m2 / SQUARE_METERS_PER_SQUARE_VARA;
}

export function squareVarasToMeters(varas: number): number {
  return varas * SQUARE_METERS_PER_SQUARE_VARA;
}

/** Semanas a meses (52 semanas = 12 meses). */
export function weeksToMonths(weeks: number): number {
  return (weeks * 12) / 52;
}
