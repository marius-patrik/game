import type { Vec3 } from "@game/shared";
import type { CombatConfig } from "./config";

export type Combatant = { id: string; pos: Vec3; alive: boolean; hp: number };

export type AttackResult =
  | { ok: true; targetId: string; newHp: number; killed: boolean }
  | {
      ok: false;
      reason: "attacker_dead" | "no_target_in_range" | "self_target_only";
    };

function distSq(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export function resolveAttack(
  attacker: Combatant,
  candidates: readonly Combatant[],
  cfg: CombatConfig,
): AttackResult {
  if (!attacker.alive) return { ok: false, reason: "attacker_dead" };
  const rangeSq = cfg.attackRange * cfg.attackRange;
  let best: Combatant | null = null;
  let bestDistSq = rangeSq;
  for (const c of candidates) {
    if (c.id === attacker.id) continue;
    if (!c.alive) continue;
    const d = distSq(attacker.pos, c.pos);
    if (d <= bestDistSq) {
      bestDistSq = d;
      best = c;
    }
  }
  if (!best) {
    return {
      ok: false,
      reason: candidates.some((c) => c.id !== attacker.id)
        ? "no_target_in_range"
        : "self_target_only",
    };
  }
  const newHp = Math.max(0, best.hp - cfg.attackDamage);
  return { ok: true, targetId: best.id, newHp, killed: newHp === 0 };
}
