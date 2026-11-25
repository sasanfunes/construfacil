/**
 * Treemap "squarified" (Bruls, Huizing y van Wijk): reparte un rectángulo en rectángulos
 * con áreas proporcionales a los valores, lo más cuadrados posible. Sirve para dibujar un
 * plano ilustrativo a partir de la lista de ambientes y sus m².
 */
export type Rect = { x: number; y: number; w: number; h: number };

export function squarify<T extends { value: number }>(items: readonly T[], rect: Rect): Array<T & Rect> {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (items.length === 0 || total <= 0) return [];
  const scale = (rect.w * rect.h) / total;
  const queue = [...items]
    .sort((a, b) => b.value - a.value)
    .map((item) => ({ item, area: item.value * scale }));

  const result: Array<T & Rect> = [];
  let free = { ...rect };
  let row: typeof queue = [];

  const worst = (areas: number[], side: number) => {
    const sum = areas.reduce((a, b) => a + b, 0);
    const max = Math.max(...areas);
    const min = Math.min(...areas);
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };

  const layoutRow = () => {
    const sum = row.reduce((acc, r) => acc + r.area, 0);
    const horizontal = free.w >= free.h; // la fila ocupa el lado corto
    if (horizontal) {
      const width = sum / free.h;
      let y = free.y;
      for (const { item, area } of row) {
        const h = area / width;
        result.push({ ...item, x: free.x, y, w: width, h });
        y += h;
      }
      free = { x: free.x + width, y: free.y, w: free.w - width, h: free.h };
    } else {
      const height = sum / free.w;
      let x = free.x;
      for (const { item, area } of row) {
        const w = area / height;
        result.push({ ...item, x, y: free.y, w, h: height });
        x += w;
      }
      free = { x: free.x, y: free.y + height, w: free.w, h: free.h - height };
    }
    row = [];
  };

  for (const entry of queue) {
    const side = Math.min(free.w, free.h);
    const current = row.map((r) => r.area);
    if (row.length === 0 || worst([...current, entry.area], side) <= worst(current, side)) {
      row.push(entry);
    } else {
      layoutRow();
      row.push(entry);
    }
  }
  if (row.length > 0) layoutRow();
  return result;
}
