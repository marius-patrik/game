import { describe, expect, test } from "bun:test";
import { scaleCinematicDuration } from "./durations";
import { clamp01, easeInOutCubic, easeOutCubic, lerp } from "./easings";

describe("clamp01", () => {
  test("clamps below 0", () => expect(clamp01(-1)).toBe(0));
  test("clamps above 1", () => expect(clamp01(2)).toBe(1));
  test("passes through interior", () => expect(clamp01(0.42)).toBe(0.42));
  test("NaN returns 0", () => expect(clamp01(Number.NaN)).toBe(0));
});

describe("easings", () => {
  test("easeOutCubic starts at 0 and ends at 1", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  test("easeOutCubic is monotone", () => {
    expect(easeOutCubic(0.25)).toBeLessThan(easeOutCubic(0.5));
    expect(easeOutCubic(0.5)).toBeLessThan(easeOutCubic(0.75));
  });

  test("easeInOutCubic is symmetric", () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5);
  });

  test("lerp blends endpoints", () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
    expect(lerp(10, 20, 0.5)).toBe(15);
  });
});

describe("scaleCinematicDuration", () => {
  test("high tier keeps full duration", () => {
    expect(scaleCinematicDuration(4000, "high")).toBe(4000);
  });

  test("medium tier cuts 25%", () => {
    expect(scaleCinematicDuration(4000, "medium")).toBe(3000);
  });

  test("low tier halves duration (ADR-0002 mobile budget)", () => {
    expect(scaleCinematicDuration(4000, "low")).toBe(2000);
  });

  test("floors to 250ms minimum", () => {
    expect(scaleCinematicDuration(100, "low")).toBe(250);
  });

  test("zero or negative yields 0", () => {
    expect(scaleCinematicDuration(0, "high")).toBe(0);
    expect(scaleCinematicDuration(-500, "high")).toBe(0);
  });

  test("NaN yields 0", () => {
    expect(scaleCinematicDuration(Number.NaN, "high")).toBe(0);
  });
});
