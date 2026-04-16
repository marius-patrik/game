import { describe, expect, test } from "bun:test";
import { applyXp, xpToNextLevel } from "@game/shared/progression";

describe("xpToNextLevel", () => {
  test("level 1 base cost", () => {
    expect(xpToNextLevel(1)).toBe(100);
  });
  test("grows with level", () => {
    const l1 = xpToNextLevel(1);
    const l5 = xpToNextLevel(5);
    expect(l5).toBeGreaterThan(l1);
  });
  test("guards invalid level", () => {
    expect(xpToNextLevel(0)).toBe(100);
    expect(xpToNextLevel(-1)).toBe(100);
    expect(xpToNextLevel(Number.NaN)).toBe(100);
  });
});

describe("applyXp", () => {
  test("accumulates without leveling up", () => {
    const r = applyXp(1, 20, 30);
    expect(r).toMatchObject({ level: 1, xp: 50, leveledUp: false, newLevels: 0 });
  });

  test("levels up exactly at threshold", () => {
    const r = applyXp(1, 50, 50);
    expect(r.leveledUp).toBe(true);
    expect(r.level).toBe(2);
    expect(r.xp).toBe(0);
  });

  test("carries remainder into new level", () => {
    const r = applyXp(1, 80, 40);
    expect(r.level).toBe(2);
    expect(r.xp).toBe(20);
    expect(r.leveledUp).toBe(true);
  });

  test("multi-level jump on huge xp", () => {
    const r = applyXp(1, 0, 10_000);
    expect(r.level).toBeGreaterThan(2);
    expect(r.newLevels).toBe(r.level - 1);
    expect(r.xp).toBeGreaterThanOrEqual(0);
  });

  test("guards negative gained", () => {
    const r = applyXp(1, 50, -10);
    expect(r).toMatchObject({ level: 1, xp: 50, leveledUp: false });
  });
});
