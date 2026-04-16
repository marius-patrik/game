import { describe, expect, test } from "bun:test";
import { particleMultiplier, scaleParticleCount } from "./particleBudget";

describe("scaleParticleCount", () => {
  test("high tier is 1x", () => {
    expect(scaleParticleCount(200, "high")).toBe(200);
  });

  test("medium tier is 0.5x", () => {
    expect(scaleParticleCount(200, "medium")).toBe(100);
  });

  test("low tier is 0.25x (ADR-0002: mobile 4x reduction)", () => {
    expect(scaleParticleCount(200, "low")).toBe(50);
  });

  test("floors to at least 1 particle", () => {
    expect(scaleParticleCount(1, "low")).toBe(1);
    expect(scaleParticleCount(2, "low")).toBe(1);
    expect(scaleParticleCount(3, "low")).toBe(1);
    expect(scaleParticleCount(4, "low")).toBe(1);
  });

  test("zero base yields 0", () => {
    expect(scaleParticleCount(0, "high")).toBe(0);
  });

  test("negative or NaN yields 0", () => {
    expect(scaleParticleCount(-5, "high")).toBe(0);
    expect(scaleParticleCount(Number.NaN, "high")).toBe(0);
  });

  test("particleMultiplier is monotone across tiers", () => {
    expect(particleMultiplier("low")).toBeLessThan(particleMultiplier("medium"));
    expect(particleMultiplier("medium")).toBeLessThan(particleMultiplier("high"));
  });
});
