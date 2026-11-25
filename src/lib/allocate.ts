/**
 * Reparte un entero entre varias partes en proporción a sus pesos, sin perder ni sobrar
 * una unidad (método del resto mayor). Sirve para repartir centavos o semanas.
 *
 *   allocate(100, [1, 1, 1]) → [34, 33, 33]
 */
export function allocate(total: number, weights: readonly number[]): number[] {
  if (!Number.isSafeInteger(total) || total < 0) throw new RangeError(`Total inválido: ${total}`);
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) throw new RangeError("Los pesos deben ser >= 0");

  const sum = weights.reduce((acc, w) => acc + w, 0);
  if (weights.length === 0) return [];
  if (sum === 0) {
    if (total === 0) return weights.map(() => 0);
    throw new RangeError("No se puede repartir un total positivo con pesos en cero");
  }

  const exact = weights.map((w) => (total * w) / sum);
  const result = exact.map(Math.floor);
  let remainder = total - result.reduce((acc, n) => acc + n, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (const { index } of order) {
    if (remainder === 0) break;
    result[index]! += 1;
    remainder -= 1;
  }
  return result;
}
