import { describe, expect, it } from "vitest";

import { squarify } from "./squarify";

describe("squarify", () => {
  const rect = { x: 0, y: 0, w: 10, h: 8 };
  const items = [
    { value: 24 },
    { value: 14 },
    { value: 10 },
    { value: 10 },
    { value: 9 },
    { value: 4.5 },
    { value: 4.5 },
    { value: 4 },
  ];

  it("las áreas son proporcionales y cubren todo el rectángulo", () => {
    const rects = squarify(items, rect);
    const total = items.reduce((s, i) => s + i.value, 0);
    expect(rects).toHaveLength(items.length);
    for (const r of rects) expect(r.w * r.h).toBeCloseTo((r.value / total) * 80, 6);
    expect(rects.reduce((s, r) => s + r.w * r.h, 0)).toBeCloseTo(80, 6);
  });

  it("todo queda dentro del rectángulo", () => {
    for (const r of squarify(items, rect)) {
      expect(r.x).toBeGreaterThanOrEqual(-1e-9);
      expect(r.y).toBeGreaterThanOrEqual(-1e-9);
      expect(r.x + r.w).toBeLessThanOrEqual(10 + 1e-9);
      expect(r.y + r.h).toBeLessThanOrEqual(8 + 1e-9);
    }
  });

  it("sin elementos o con total cero no dibuja nada", () => {
    expect(squarify([], rect)).toEqual([]);
    expect(squarify([{ value: 0 }], rect)).toEqual([]);
  });
});
