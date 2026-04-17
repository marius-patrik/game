import { describe, expect, test } from "bun:test";
import { pickWeighted } from "./loot";

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

describe("pickWeighted", () => {
  test("always returns the only non-zero entry", () => {
    const r = pickWeighted([
      { value: "a", weight: 0 },
      { value: "b", weight: 1 },
    ]);
    expect(r).toBe("b");
  });

  test("throws on empty table", () => {
    expect(() => pickWeighted([])).toThrow();
  });

  test("throws on all-zero weights", () => {
    expect(() => pickWeighted([{ value: "x", weight: 0 }])).toThrow();
  });

  test("returns first entry for rng=0", () => {
    const r = pickWeighted(
      [
        { value: "a", weight: 1 },
        { value: "b", weight: 1 },
      ],
      () => 0,
    );
    expect(r).toBe("a");
  });

  test("distribution tracks weights within tolerance", () => {
    const rng = seeded(42);
    let a = 0;
    let b = 0;
    let c = 0;
    const table = [
      { value: "a" as const, weight: 80 },
      { value: "b" as const, weight: 18 },
      { value: "c" as const, weight: 2 },
    ];
    const N = 20_000;
    for (let i = 0; i < N; i++) {
      const v = pickWeighted(table, rng);
      if (v === "a") a += 1;
      else if (v === "b") b += 1;
      else c += 1;
    }
    expect(a / N).toBeGreaterThan(0.75);
    expect(a / N).toBeLessThan(0.85);
    expect(b / N).toBeGreaterThan(0.14);
    expect(b / N).toBeLessThan(0.22);
    expect(c / N).toBeGreaterThan(0.005);
    expect(c / N).toBeLessThan(0.04);
  });
});
