import { describe, expect, it } from "vitest";

import { allocate } from "./allocate";

describe("allocate", () => {
  it("reparte sin perder unidades", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(10, [3, 7])).toEqual([3, 7]);
    const parts = allocate(123_457, [15, 25, 15, 14, 23, 4]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(123_457);
  });

  it("respeta los ceros", () => {
    expect(allocate(50, [0, 1, 0, 1])).toEqual([0, 25, 0, 25]);
  });

  it("valida la entrada", () => {
    expect(() => allocate(-1, [1])).toThrow(RangeError);
    expect(() => allocate(1.5, [1])).toThrow(RangeError);
    expect(() => allocate(5, [0, 0])).toThrow(RangeError);
    expect(allocate(0, [0, 0])).toEqual([0, 0]);
    expect(allocate(5, [])).toEqual([]);
  });
});
