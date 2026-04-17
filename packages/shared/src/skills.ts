export type SkillId = "basic" | "cleave" | "heal" | "dash";

export type SkillDef = {
  id: SkillId;
  name: string;
  description: string;
  manaCost: number;
  cooldownMs: number;
  range: number;
  color: string;
};

export const SKILL_CATALOG: Record<SkillId, SkillDef> = {
  basic: {
    id: "basic",
    name: "Strike",
    description: "Hit the nearest hostile in range. No mana cost.",
    manaCost: 0,
    cooldownMs: 600,
    range: 3,
    color: "#fbbf24",
  },
  cleave: {
    id: "cleave",
    name: "Cleave",
    description: "Damage every hostile mob in a 3m radius.",
    manaCost: 15,
    cooldownMs: 3500,
    range: 3,
    color: "#f97316",
  },
  heal: {
    id: "heal",
    name: "Heal",
    description: "Restore 40 HP to yourself.",
    manaCost: 25,
    cooldownMs: 5000,
    range: 0,
    color: "#22c55e",
  },
  dash: {
    id: "dash",
    name: "Dash",
    description: "Blink 6 meters in your facing direction.",
    manaCost: 10,
    cooldownMs: 2500,
    range: 6,
    color: "#38bdf8",
  },
};

export const SKILL_BAR: readonly SkillId[] = ["basic", "cleave", "heal", "dash"];
