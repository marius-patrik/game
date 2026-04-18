import { describe, expect, test } from "bun:test";
import { isAbilityId } from "./abilities";
import {
  ALL_SKILL_IDS,
  SKILL_CATALOG,
  ULTIMATE_COOLDOWN_MULTIPLIER,
  getSkill,
  isSkillId,
  resolveSkillAbility,
  skillEffectiveCooldownMs,
} from "./skills";

describe("skills catalog", () => {
  test("contains at least 6 normal skills and 2 ultimates", () => {
    const normals = ALL_SKILL_IDS.filter((id) => SKILL_CATALOG[id].slotKind === "normal");
    const ultimates = ALL_SKILL_IDS.filter((id) => SKILL_CATALOG[id].slotKind === "ultimate");
    expect(normals.length).toBeGreaterThanOrEqual(6);
    expect(ultimates.length).toBeGreaterThanOrEqual(2);
  });

  test("every skill references a real ability", () => {
    for (const id of ALL_SKILL_IDS) {
      const skill = SKILL_CATALOG[id];
      expect(isAbilityId(skill.abilityId)).toBe(true);
      expect(resolveSkillAbility(id)).toBeDefined();
    }
  });

  test("every skill has positive unlock level + cost", () => {
    for (const id of ALL_SKILL_IDS) {
      const skill = SKILL_CATALOG[id];
      expect(skill.unlockLevel).toBeGreaterThanOrEqual(1);
      expect(skill.costToAllocate).toBeGreaterThan(0);
    }
  });

  test("isSkillId rejects unknown ids", () => {
    expect(isSkillId("nope")).toBe(false);
    expect(isSkillId("skill_cleave")).toBe(true);
  });

  test("getSkill returns undefined on miss", () => {
    expect(getSkill("nope")).toBeUndefined();
  });

  test("ultimate cooldown multiplier stretches ability cooldown", () => {
    const ult = ALL_SKILL_IDS.find((id) => SKILL_CATALOG[id].slotKind === "ultimate");
    expect(ult).toBeDefined();
    if (!ult) return;
    const base = 1000;
    expect(skillEffectiveCooldownMs(ult, base)).toBe(base * ULTIMATE_COOLDOWN_MULTIPLIER);
  });

  test("normal skill cooldown unchanged", () => {
    const normal = ALL_SKILL_IDS.find((id) => SKILL_CATALOG[id].slotKind === "normal");
    expect(normal).toBeDefined();
    if (!normal) return;
    expect(skillEffectiveCooldownMs(normal, 1000)).toBe(1000);
  });

  test("unknown skill falls back to base cooldown", () => {
    expect(skillEffectiveCooldownMs("nope", 500)).toBe(500);
  });
});
