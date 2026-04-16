import { describe, expect, test } from "bun:test";
import { DEFAULT_COMBAT } from "./config";
import { type Combatant, resolveAttack } from "./resolveAttack";

function c(id: string, x: number, z: number, extra: Partial<Combatant> = {}): Combatant {
  return { id, pos: { x, y: 0, z }, alive: extra.alive ?? true, hp: extra.hp ?? 100 };
}

describe("resolveAttack", () => {
  test("hits nearest alive target within range", () => {
    const attacker = c("A", 0, 0);
    const r = resolveAttack(attacker, [c("B", 2, 0), c("C", 10, 0)], DEFAULT_COMBAT);
    expect(r).toMatchObject({ ok: true, targetId: "B", newHp: 85, killed: false });
  });

  test("no target in range rejects", () => {
    const attacker = c("A", 0, 0);
    const r = resolveAttack(attacker, [c("B", 10, 0)], DEFAULT_COMBAT);
    expect(r).toEqual({ ok: false, reason: "no_target_in_range" });
  });

  test("no other players rejects with self_target_only", () => {
    const attacker = c("A", 0, 0);
    const r = resolveAttack(attacker, [c("A", 0, 0)], DEFAULT_COMBAT);
    expect(r).toEqual({ ok: false, reason: "self_target_only" });
  });

  test("dead attacker rejects", () => {
    const attacker = c("A", 0, 0, { alive: false });
    const r = resolveAttack(attacker, [c("B", 1, 0)], DEFAULT_COMBAT);
    expect(r).toEqual({ ok: false, reason: "attacker_dead" });
  });

  test("ignores dead candidates", () => {
    const attacker = c("A", 0, 0);
    const r = resolveAttack(
      attacker,
      [c("B", 1, 0, { alive: false }), c("C", 2, 0)],
      DEFAULT_COMBAT,
    );
    expect(r).toMatchObject({ ok: true, targetId: "C" });
  });

  test("killing blow sets killed=true and newHp=0", () => {
    const attacker = c("A", 0, 0);
    const r = resolveAttack(attacker, [c("B", 1, 0, { hp: 10 })], DEFAULT_COMBAT);
    expect(r).toMatchObject({ ok: true, targetId: "B", newHp: 0, killed: true });
  });

  test("range is inclusive at exact distance", () => {
    const attacker = c("A", 0, 0);
    const r = resolveAttack(attacker, [c("B", DEFAULT_COMBAT.attackRange, 0)], DEFAULT_COMBAT);
    expect(r).toMatchObject({ ok: true, targetId: "B" });
  });

  test("picks the closer of two targets", () => {
    const attacker = c("A", 0, 0);
    const r = resolveAttack(attacker, [c("B", 2.4, 0), c("C", 1, 0)], DEFAULT_COMBAT);
    expect(r).toMatchObject({ ok: true, targetId: "C" });
  });
});
