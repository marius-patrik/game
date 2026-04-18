import { describe, expect, test } from "bun:test";
import {
  ABILITY_CATALOG,
  ALL_ABILITY_IDS,
  getAbility,
  isAbilityId,
  UNARMED_PRIMARY,
  UNARMED_SECONDARY,
} from "./abilities";

describe("ability catalog", () => {
  test("registry contains required base abilities", () => {
    const required = [
      "strike",
      "punch",
      "slash",
      "thrust",
      "bolt",
      "blast",
      "quickstrike",
      "dash_strike",
    ];
    for (const id of required) {
      expect(isAbilityId(id)).toBe(true);
      expect(ABILITY_CATALOG[id as keyof typeof ABILITY_CATALOG]).toBeDefined();
    }
  });

  test("every ability has non-negative damage and cooldown", () => {
    for (const id of ALL_ABILITY_IDS) {
      const def = ABILITY_CATALOG[id];
      expect(def.damage).toBeGreaterThanOrEqual(0);
      expect(def.cooldownMs).toBeGreaterThan(0);
      expect(def.range).toBeGreaterThan(0);
      expect(def.manaCost).toBeGreaterThanOrEqual(0);
    }
  });

  test("unarmed defaults are valid ability ids", () => {
    expect(isAbilityId(UNARMED_PRIMARY)).toBe(true);
    expect(isAbilityId(UNARMED_SECONDARY)).toBe(true);
  });

  test("getAbility returns undefined for unknown id", () => {
    expect(getAbility("nonexistent")).toBeUndefined();
  });
});
