import {
  type AbilityDef,
  type AbilityId,
  UNARMED_PRIMARY,
  UNARMED_SECONDARY,
  type WeaponSlotKey,
  getAbility,
} from "@game/shared/abilities";
import { getItem } from "@game/shared/items";

/**
 * Equipment view slim enough for pure resolution + testing. The server
 * passes a `player.equipment` MapSchema but we only read `weapon`.
 */
export type EquipmentView = {
  get(slot: "weapon"): string | undefined;
};

/**
 * Resolve the ability bound to a weapon hotbar slot. W1 → weapon's
 * `primaryAbilityId`, W2 → `secondaryAbilityId`. When the weapon slot
 * is empty, falls back to the unarmed defaults (`strike` / `punch`).
 * Returns `undefined` if a slot is somehow pointing at an unknown
 * ability (shouldn't happen once the catalog is authoritative).
 */
export function resolveWeaponAbility(
  equipment: EquipmentView,
  slot: WeaponSlotKey,
): AbilityDef | undefined {
  const weaponId = equipment.get("weapon");
  if (!weaponId || weaponId.length === 0) {
    return getAbility(slot === "W1" ? UNARMED_PRIMARY : UNARMED_SECONDARY);
  }
  const def = getItem(weaponId);
  if (!def || def.kind !== "weapon") {
    return getAbility(slot === "W1" ? UNARMED_PRIMARY : UNARMED_SECONDARY);
  }
  const abilityId: AbilityId | undefined =
    slot === "W1" ? def.primaryAbilityId : def.secondaryAbilityId;
  if (!abilityId) {
    return getAbility(slot === "W1" ? UNARMED_PRIMARY : UNARMED_SECONDARY);
  }
  return getAbility(abilityId);
}

export type AbilityCheckResult =
  | { ok: true; ability: AbilityDef; nextCooldownMs: number; manaCost: number }
  | { ok: false; reason: "unknown_ability" | "cooldown" | "mana" | "dead" };

/**
 * Pure validation used by the server to gate an ability use. Does NOT
 * mutate any state — callers apply the returned mana cost and cooldown
 * themselves so the dispatcher stays testable.
 */
export function checkAbilityReady(args: {
  ability: AbilityDef | undefined;
  now: number;
  readyAt: number;
  mana: number;
  alive: boolean;
}): AbilityCheckResult {
  const { ability, now, readyAt, mana, alive } = args;
  if (!ability) return { ok: false, reason: "unknown_ability" };
  if (!alive) return { ok: false, reason: "dead" };
  if (now < readyAt) return { ok: false, reason: "cooldown" };
  if (mana < ability.manaCost) return { ok: false, reason: "mana" };
  return {
    ok: true,
    ability,
    nextCooldownMs: ability.cooldownMs,
    manaCost: ability.manaCost,
  };
}
