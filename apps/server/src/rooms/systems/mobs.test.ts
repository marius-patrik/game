import { describe, expect, test } from "bun:test";
import { MapSchema } from "@colyseus/schema";
import type { ItemId, Mob, Vec3, Zone } from "@game/shared";
import { MobSystem, type PlayerRef } from "./mobs";

const testZone: Zone = {
  id: "arena",
  name: "arena",
  maxClients: 10,
  spawn: { x: 0, y: 0, z: 0 },
  bounds: { min: { x: -20, y: 0, z: -20 }, max: { x: 20, y: 10, z: 20 } },
  portals: [],
  theme: {
    preset: "sunset",
    ground: "#000",
    gridMajor: "#000",
    gridMinor: "#000",
    fog: { near: 10, far: 40 },
  },
};

type HarnessOpts = {
  mobCount?: number;
  players?: readonly PlayerRef[];
  now: () => number;
};

function makeHarness(opts: HarnessOpts) {
  const mobs = new MapSchema<Mob>();
  const damageLog: Array<{ id: string; dmg: number }> = [];
  const drops: Array<{ itemId: ItemId; pos: Vec3 }> = [];
  const system = new MobSystem({
    mobs,
    zone: testZone,
    getPlayers: () => opts.players ?? [],
    damagePlayer: (id, dmg) => damageLog.push({ id, dmg }),
    spawnDrop: (itemId, _qty, pos) => drops.push({ itemId, pos }),
    now: opts.now,
    // Deterministic RNG keeps spawn positions predictable; individual tests
    // that care about position place mobs manually after spawn.
    rng: () => 0.5,
    mobCount: opts.mobCount ?? 0,
  });
  return { mobs, system, damageLog, drops };
}

function placeMob(mobs: MapSchema<Mob>, id: string, pos: Vec3): Mob {
  const mob = mobs.get(id);
  if (!mob) throw new Error(`mob ${id} missing`);
  mob.x = pos.x;
  mob.y = pos.y;
  mob.z = pos.z;
  return mob;
}

describe("MobSystem healer", () => {
  test("heals mobs within radius but not those outside", () => {
    const clock = { now: 1000 };
    const { mobs, system } = makeHarness({ now: () => clock.now });
    system.spawnSpecificKind("healer");
    system.spawnSpecificKind("grunt");
    system.spawnSpecificKind("grunt");

    const ids = [...mobs.keys()];
    const healerId = ids[0];
    const innerId = ids[1];
    const outerId = ids[2];
    if (!healerId || !innerId || !outerId) throw new Error("expected 3 mobs");

    placeMob(mobs, healerId, { x: 0, y: 0, z: 0 });
    const inner = placeMob(mobs, innerId, { x: 1.5, y: 0, z: 0 });
    const outer = placeMob(mobs, outerId, { x: 10, y: 0, z: 0 });
    // Pre-damage both grunts so heal-tick has headroom to apply.
    inner.hp = 10;
    outer.hp = 10;

    // First tick at t=1000 fires immediately because lastHealAt defaults to 0.
    system.tick(16);
    expect(inner.hp).toBe(14);
    expect(outer.hp).toBe(10);

    // Advance past the 1s cadence and tick again.
    clock.now = 2100;
    system.tick(16);
    expect(inner.hp).toBe(18);
    expect(outer.hp).toBe(10);
  });

  test("healer does not heal itself", () => {
    const clock = { now: 1000 };
    const { mobs, system } = makeHarness({ now: () => clock.now });
    system.spawnSpecificKind("healer");
    const healerId = [...mobs.keys()][0];
    if (!healerId) throw new Error("expected healer");

    const healer = placeMob(mobs, healerId, { x: 0, y: 0, z: 0 });
    healer.hp = 10;
    const before = healer.hp;
    system.tick(16);
    clock.now = 2100;
    system.tick(16);
    expect(healer.hp).toBe(before);
  });

  test("heal tick caps at target maxHp", () => {
    const clock = { now: 1000 };
    const { mobs, system } = makeHarness({ now: () => clock.now });
    system.spawnSpecificKind("healer");
    system.spawnSpecificKind("grunt");
    const ids = [...mobs.keys()];
    const healerId = ids[0];
    const gruntId = ids[1];
    if (!healerId || !gruntId) throw new Error("expected 2 mobs");

    placeMob(mobs, healerId, { x: 0, y: 0, z: 0 });
    const grunt = placeMob(mobs, gruntId, { x: 1.5, y: 0, z: 0 });
    grunt.hp = grunt.maxHp - 1; // only 1 HP of headroom
    system.tick(16);
    expect(grunt.hp).toBe(grunt.maxHp); // capped, not maxHp + (HEALER_TICK_HP - 1)
  });
});
