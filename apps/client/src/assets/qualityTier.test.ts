import { describe, expect, test } from "bun:test";
import { pickQualityTier, TIER_BUDGETS } from "./qualityTier";

describe("pickQualityTier", () => {
  test("mobile with weak memory is low", () => {
    expect(
      pickQualityTier({
        pointerCoarse: true,
        devicePixelRatio: 3,
        hardwareConcurrency: 4,
        deviceMemory: 2,
      }),
    ).toBe("low");
  });

  test("mobile with adequate memory is medium", () => {
    expect(
      pickQualityTier({
        pointerCoarse: true,
        devicePixelRatio: 3,
        hardwareConcurrency: 8,
        deviceMemory: 6,
      }),
    ).toBe("medium");
  });

  test("desktop with 8+ cores and 8+ GB is high", () => {
    expect(
      pickQualityTier({
        pointerCoarse: false,
        devicePixelRatio: 2,
        hardwareConcurrency: 12,
        deviceMemory: 16,
      }),
    ).toBe("high");
  });

  test("desktop with low cores falls back to medium", () => {
    expect(
      pickQualityTier({
        pointerCoarse: false,
        devicePixelRatio: 1,
        hardwareConcurrency: 4,
        deviceMemory: 8,
      }),
    ).toBe("medium");
  });

  test("unknown deviceMemory on desktop with 8+ cores still promotes to high", () => {
    expect(
      pickQualityTier({
        pointerCoarse: false,
        devicePixelRatio: 2,
        hardwareConcurrency: 12,
      }),
    ).toBe("high");
  });

  test("unknown deviceMemory on mobile with weak cores is low", () => {
    expect(
      pickQualityTier({
        pointerCoarse: true,
        devicePixelRatio: 2,
        hardwareConcurrency: 4,
      }),
    ).toBe("low");
  });

  test("tier budgets are monotonically increasing", () => {
    expect(TIER_BUDGETS.low.maxDrawCalls).toBeLessThan(TIER_BUDGETS.medium.maxDrawCalls);
    expect(TIER_BUDGETS.medium.maxDrawCalls).toBeLessThan(TIER_BUDGETS.high.maxDrawCalls);
    expect(TIER_BUDGETS.low.maxTextureMB).toBeLessThan(TIER_BUDGETS.medium.maxTextureMB);
    expect(TIER_BUDGETS.medium.maxTextureMB).toBeLessThan(TIER_BUDGETS.high.maxTextureMB);
    expect(TIER_BUDGETS.low.postFX).toBe(false);
    expect(TIER_BUDGETS.medium.postFX).toBe(true);
  });
});
