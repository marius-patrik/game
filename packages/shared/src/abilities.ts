export type AbilityKind = "melee" | "ranged" | "aoe" | "movement" | "self";

export type AbilityId =
  | "strike"
  | "punch"
  | "slash"
  | "thrust"
  | "cleave"
  | "heavy_chop"
  | "bolt"
  | "blast"
  | "quickstrike"
  | "dash_strike";

export type AbilityDef = {
  id: AbilityId;
  name: string;
  description: string;
  kind: AbilityKind;
  cooldownMs: number;
  manaCost: number;
  damage: number;
  range: number;
  color: string;
  animationKey?: string;
};

export const ABILITY_CATALOG: Record<AbilityId, AbilityDef> = {
  strike: {
    id: "strike",
    name: "Strike",
    description: "An unarmed shove. Low damage, always available.",
    kind: "melee",
    cooldownMs: 700,
    manaCost: 0,
    damage: 6,
    range: 2.2,
    color: "#fbbf24",
    animationKey: "strike",
  },
  punch: {
    id: "punch",
    name: "Punch",
    description: "Throw a bare-knuckle jab. Fast, barely any damage.",
    kind: "melee",
    cooldownMs: 500,
    manaCost: 0,
    damage: 4,
    range: 1.8,
    color: "#f97316",
    animationKey: "punch",
  },
  slash: {
    id: "slash",
    name: "Slash",
    description: "A wide sword slash. Solid single-target damage.",
    kind: "melee",
    cooldownMs: 650,
    manaCost: 0,
    damage: 14,
    range: 2.6,
    color: "#60a5fa",
    animationKey: "slash",
  },
  thrust: {
    id: "thrust",
    name: "Thrust",
    description: "A reaching point-strike. Slightly slower, longer reach.",
    kind: "melee",
    cooldownMs: 900,
    manaCost: 5,
    damage: 18,
    range: 3.0,
    color: "#38bdf8",
    animationKey: "thrust",
  },
  cleave: {
    id: "cleave",
    name: "Cleave",
    description: "A sweeping arc hitting everything in front of you.",
    kind: "aoe",
    cooldownMs: 2200,
    manaCost: 12,
    damage: 16,
    range: 3.2,
    color: "#f97316",
    animationKey: "cleave",
  },
  heavy_chop: {
    id: "heavy_chop",
    name: "Heavy Chop",
    description: "A slow, two-handed overhead chop.",
    kind: "melee",
    cooldownMs: 1400,
    manaCost: 10,
    damage: 26,
    range: 2.4,
    color: "#a855f7",
    animationKey: "chop",
  },
  bolt: {
    id: "bolt",
    name: "Bolt",
    description: "A snap arcane bolt. Ranged, spends mana.",
    kind: "ranged",
    cooldownMs: 750,
    manaCost: 10,
    damage: 12,
    range: 8.0,
    color: "#a78bfa",
    animationKey: "bolt",
  },
  blast: {
    id: "blast",
    name: "Blast",
    description: "Detonate a short-range arcane ring at a target point.",
    kind: "aoe",
    cooldownMs: 3500,
    manaCost: 25,
    damage: 22,
    range: 7.0,
    color: "#c084fc",
    animationKey: "blast",
  },
  quickstrike: {
    id: "quickstrike",
    name: "Quickstrike",
    description: "A lightning-fast dagger jab. Little damage, tiny cooldown.",
    kind: "melee",
    cooldownMs: 350,
    manaCost: 0,
    damage: 9,
    range: 1.9,
    color: "#34d399",
    animationKey: "quickstrike",
  },
  dash_strike: {
    id: "dash_strike",
    name: "Dash-Strike",
    description: "Leap forward and slash. Gap closer with moderate damage.",
    kind: "movement",
    cooldownMs: 2800,
    manaCost: 15,
    damage: 18,
    range: 5.5,
    color: "#22d3ee",
    animationKey: "dash_strike",
  },
};

export const ALL_ABILITY_IDS = Object.keys(ABILITY_CATALOG) as AbilityId[];

export function getAbility(id: string): AbilityDef | undefined {
  return (ABILITY_CATALOG as Record<string, AbilityDef>)[id];
}

export function isAbilityId(id: string): id is AbilityId {
  return id in ABILITY_CATALOG;
}

/** Weapon slots W1 (primary) and W2 (secondary) — the two bindings on the hotbar. */
export type WeaponSlotKey = "W1" | "W2";

export const UNARMED_PRIMARY: AbilityId = "strike";
export const UNARMED_SECONDARY: AbilityId = "punch";

export type WeaponAbilityResolver = {
  getWeaponId(): string | undefined;
  getPrimaryAbilityId(weaponId: string): AbilityId | undefined;
  getSecondaryAbilityId(weaponId: string): AbilityId | undefined;
};

/**
 * Shared resolver: given an equipped weapon id + a lookup that returns the
 * `primaryAbilityId` / `secondaryAbilityId` for any item, returns the
 * ability def for the requested weapon slot. Empty or unknown weapon →
 * unarmed fallback.
 */
export function resolveWeaponAbilityId(
  weaponId: string | undefined,
  slot: WeaponSlotKey,
  lookup: (
    weaponId: string,
  ) => { primaryAbilityId?: AbilityId; secondaryAbilityId?: AbilityId } | undefined,
): AbilityId {
  if (!weaponId || weaponId.length === 0) {
    return slot === "W1" ? UNARMED_PRIMARY : UNARMED_SECONDARY;
  }
  const def = lookup(weaponId);
  if (!def) return slot === "W1" ? UNARMED_PRIMARY : UNARMED_SECONDARY;
  const id = slot === "W1" ? def.primaryAbilityId : def.secondaryAbilityId;
  if (!id) return slot === "W1" ? UNARMED_PRIMARY : UNARMED_SECONDARY;
  return id;
}
