import type { EquipSlot, ItemDef } from "./items";

export type StatKey = "strength" | "dexterity" | "vitality" | "intellect";

export type Stats = {
  strength: number;
  dexterity: number;
  vitality: number;
  intellect: number;
};

export const BASE_STATS: Stats = {
  strength: 5,
  dexterity: 5,
  vitality: 5,
  intellect: 5,
};

export const STAT_POINTS_PER_LEVEL = 3;

/** Base + per-point scaling for derived stats. Kept simple so tuning is just numbers. */
export function maxHpFromStats(vitality: number, base = 80): number {
  return Math.floor(base + vitality * 8);
}

export function maxManaFromStats(intellect: number, base = 30): number {
  return Math.floor(base + intellect * 6);
}

export function damageBonusFromStats(strength: number): number {
  // +1 damage per 2 STR
  return Math.floor(strength / 2);
}

export function attackCooldownMs(dexterity: number, baseMs = 800): number {
  // -15 ms per DEX point, clamped at 250ms min
  return Math.max(250, Math.floor(baseMs - dexterity * 15));
}

export function manaRegenPerSec(intellect: number): number {
  return 1 + intellect * 0.15;
}

/** Crit chance curve: 10% base + 0.5% per DEX, capped at 70%. */
export function critChance(dexterity: number): number {
  return Math.max(0, Math.min(0.7, 0.1 + dexterity / 200));
}

/** Returns true if this swing is a crit. `rng` defaults to Math.random. */
export function rollCrit(dexterity: number, rng: () => number = Math.random): boolean {
  return rng() < critChance(dexterity);
}

/** Crits deal 2× damage. */
export const CRIT_MULTIPLIER = 2;

export type EquippedStats = Stats & { damageBonus: number };

export function equipBonus(
  defs: readonly (ItemDef | undefined)[],
): Stats & { damageBonus: number } {
  const out = { strength: 0, dexterity: 0, vitality: 0, intellect: 0, damageBonus: 0 };
  for (const d of defs) {
    if (!d) continue;
    out.strength += d.strBonus ?? 0;
    out.dexterity += d.dexBonus ?? 0;
    out.vitality += d.vitBonus ?? 0;
    out.intellect += d.intBonus ?? 0;
    out.damageBonus += d.damageBonus ?? 0;
  }
  return out;
}

export const EQUIP_SLOTS: readonly EquipSlot[] = ["weapon", "head", "chest", "ring"];
