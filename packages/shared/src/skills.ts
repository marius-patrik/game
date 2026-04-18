import { type AbilityId, getAbility } from "./abilities";

export type SkillSlotKind = "normal" | "ultimate";
export type SkillSlot = "S1" | "S2" | "U";

export type SkillId =
  | "skill_cleave"
  | "skill_dash"
  | "skill_heal"
  | "skill_bolt"
  | "skill_shield"
  | "skill_regen"
  | "skill_meteor"
  | "skill_blink";

export type SkillDef = {
  id: SkillId;
  name: string;
  description: string;
  abilityId: AbilityId;
  slotKind: SkillSlotKind;
  unlockLevel: number;
  costToAllocate: number;
};

export const SKILL_CATALOG: Record<SkillId, SkillDef> = {
  skill_cleave: {
    id: "skill_cleave",
    name: "Cleave",
    description: "A wide sweeping arc that hits everything in front of you.",
    abilityId: "cleave",
    slotKind: "normal",
    unlockLevel: 2,
    costToAllocate: 1,
  },
  skill_dash: {
    id: "skill_dash",
    name: "Dash",
    description: "Leap forward and slash. Gap closer with light damage.",
    abilityId: "dash_strike",
    slotKind: "normal",
    unlockLevel: 3,
    costToAllocate: 1,
  },
  skill_heal: {
    id: "skill_heal",
    name: "Heal",
    description: "Channel vitality to restore health. Self-cast.",
    abilityId: "thrust",
    slotKind: "normal",
    unlockLevel: 4,
    costToAllocate: 1,
  },
  skill_bolt: {
    id: "skill_bolt",
    name: "Arcane Bolt",
    description: "A snap bolt of arcane energy. Ranged, mana cost.",
    abilityId: "bolt",
    slotKind: "normal",
    unlockLevel: 2,
    costToAllocate: 1,
  },
  skill_shield: {
    id: "skill_shield",
    name: "Shield Bash",
    description: "A heavy overhead chop that staggers the foe.",
    abilityId: "heavy_chop",
    slotKind: "normal",
    unlockLevel: 5,
    costToAllocate: 1,
  },
  skill_regen: {
    id: "skill_regen",
    name: "Regenerate",
    description: "Quick restoring strike that braces you mid-fight.",
    abilityId: "quickstrike",
    slotKind: "normal",
    unlockLevel: 4,
    costToAllocate: 1,
  },
  skill_meteor: {
    id: "skill_meteor",
    name: "Meteor",
    description: "A thunderous arcane detonation. Long cooldown, heavy area damage.",
    abilityId: "blast",
    slotKind: "ultimate",
    unlockLevel: 6,
    costToAllocate: 1,
  },
  skill_blink: {
    id: "skill_blink",
    name: "Blink",
    description: "Tear a hole through space and reappear elsewhere.",
    abilityId: "dash_strike",
    slotKind: "ultimate",
    unlockLevel: 8,
    costToAllocate: 1,
  },
};

export const ALL_SKILL_IDS: readonly SkillId[] = Object.keys(SKILL_CATALOG) as SkillId[];

export function getSkill(id: string): SkillDef | undefined {
  return (SKILL_CATALOG as Record<string, SkillDef>)[id];
}

export function isSkillId(id: string): id is SkillId {
  return id in SKILL_CATALOG;
}

export function resolveSkillAbility(skillId: string) {
  const skill = getSkill(skillId);
  if (!skill) return undefined;
  return getAbility(skill.abilityId);
}

export const ULTIMATE_COOLDOWN_MULTIPLIER = 3;

/**
 * Effective cooldown for a skill-bound ability. Ultimates inherit the
 * ability's base cooldown but are stretched out so they feel "rare".
 */
export function skillEffectiveCooldownMs(skillId: string, baseCooldownMs: number): number {
  const skill = getSkill(skillId);
  if (!skill) return baseCooldownMs;
  return skill.slotKind === "ultimate"
    ? Math.round(baseCooldownMs * ULTIMATE_COOLDOWN_MULTIPLIER)
    : baseCooldownMs;
}
