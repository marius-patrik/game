import { describe, expect, test } from "bun:test";
import { MapSchema } from "@colyseus/schema";
import { type ItemId, type Mob, type Vec3, type WeightedEntry, ZONES } from "@game/shared";
import { type MobConfig, MobSystem, type PlayerRef } from "./mobs";

type DropRecord = { itemId: ItemId; qty: number; pos: Vec3 };
type DmgRecord = { playerId: string; dmg: number };

function makeSystem(overrides: {
  players: PlayerRef[];
  now?: () => number;
  rng?: () => number;
  mobCount?: number;
  lootTable?: readonly WeightedEntry<ItemId>[];
  config?: Partial<MobConfig>;
}) {
  const mobs = new MapSchema<Mob>();
  const drops: DropRecord[] = [];
  const damages: DmgRecord[] = [];
  const killed: string[] = [];
  const sys = new MobSystem({
    mobs,
    zone: ZONES.lobby,
    getPlayers: () => overrides.players,
    damagePlayer: (playerId, dmg) => damages.push({ playerId, dmg }),
    onMobKilled: (mobId) => killed.push(mobId),
    spawnDrop: (itemId, qty, pos) => drops.push({ itemId, qty, pos }),
    now: overrides.now ?? (() => 0),
    rng: overrides.rng ?? (() => 0.5),
    mobCount: overrides.mobCount ?? 3,
    lootTable: overrides.lootTable,
    config: overrides.config,
  });
  return { sys, mobs, drops, damages, killed };
}

describe("MobSystem.start", () => {
  test("spawns the target count of mobs", () => {
    const { sys, mobs } = makeSystem({ players: [], mobCount: 5 });
    sys.start();
    expect(mobs.size).toBe(5);
  });

  test("every spawned mob is alive at maxHp within zone bounds", () => {
    const { sys, mobs } = makeSystem({ players: [], mobCount: 3 });
    sys.start();
    for (const [, m] of mobs) {
      expect(m.alive).toBe(true);
      expect(m.hp).toBe(m.maxHp);
      const { min, max } = ZONES.lobby.bounds;
      expect(m.x).toBeGreaterThanOrEqual(min.x);
      expect(m.x).toBeLessThanOrEqual(max.x);
      expect(m.z).toBeGreaterThanOrEqual(min.z);
      expect(m.z).toBeLessThanOrEqual(max.z);
    }
  });
});

describe("MobSystem.tick chase movement", () => {
  test("moves toward nearest player within detect radius", () => {
    const { sys, mobs } = makeSystem({
      players: [{ id: "p1", pos: { x: 5, y: 0, z: 0 }, alive: true }],
      rng: () => 0.5,
      mobCount: 1,
    });
    sys.start();
    const mob = [...mobs.values()][0]!;
    mob.x = 0;
    mob.z = 0;
    const startX = mob.x;
    sys.tick(1000);
    expect(mob.x).toBeGreaterThan(startX);
    expect(mob.x).toBeLessThanOrEqual(5);
  });

  test("does not move if no player within detect radius", () => {
    const { sys, mobs } = makeSystem({
      players: [{ id: "p1", pos: { x: 50, y: 0, z: 50 }, alive: true }],
      rng: () => 0.5,
      mobCount: 1,
    });
    sys.start();
    const mob = [...mobs.values()][0]!;
    mob.x = 0;
    mob.z = 0;
    sys.tick(1000);
    expect(mob.x).toBe(0);
    expect(mob.z).toBe(0);
  });

  test("ignores dead players", () => {
    const { sys, mobs } = makeSystem({
      players: [{ id: "p1", pos: { x: 2, y: 0, z: 0 }, alive: false }],
      rng: () => 0.5,
      mobCount: 1,
    });
    sys.start();
    const mob = [...mobs.values()][0]!;
    mob.x = 0;
    mob.z = 0;
    sys.tick(1000);
    expect(mob.x).toBe(0);
  });
});

describe("MobSystem.tick contact damage", () => {
  test("deals contact damage on first tick within range", () => {
    const t = 0;
    const { sys, mobs, damages } = makeSystem({
      players: [{ id: "p1", pos: { x: 0, y: 0, z: 0 }, alive: true }],
      rng: () => 0.5,
      mobCount: 1,
      now: () => t,
    });
    sys.start();
    const mob = [...mobs.values()][0]!;
    mob.x = 0.5;
    mob.z = 0;
    sys.tick(100);
    expect(damages.length).toBe(1);
    expect(damages[0]!.playerId).toBe("p1");
    expect(damages[0]!.dmg).toBe(5);
  });

  test("respects cooldown between hits from same mob", () => {
    let t = 0;
    const { sys, mobs, damages } = makeSystem({
      players: [{ id: "p1", pos: { x: 0, y: 0, z: 0 }, alive: true }],
      rng: () => 0.5,
      mobCount: 1,
      now: () => t,
    });
    sys.start();
    const mob = [...mobs.values()][0]!;
    mob.x = 0.5;
    mob.z = 0;
    sys.tick(100);
    t = 500;
    sys.tick(100);
    expect(damages.length).toBe(1);
    t = 1100;
    sys.tick(100);
    expect(damages.length).toBe(2);
  });

  test("caps total contact damage per tick per player", () => {
    const t = 0;
    const { sys, mobs, damages } = makeSystem({
      players: [{ id: "p1", pos: { x: 0, y: 0, z: 0 }, alive: true }],
      rng: () => 0.5,
      mobCount: 5,
      now: () => t,
    });
    sys.start();
    for (const [, m] of mobs) {
      m.x = 0.3;
      m.z = 0;
    }
    sys.tick(100);
    const total = damages.reduce((s, d) => s + d.dmg, 0);
    expect(total).toBeLessThanOrEqual(15);
  });
});

describe("MobSystem.applyDamage", () => {
  test("reduces hp, returns killed=false when hp remains", () => {
    const { sys, mobs } = makeSystem({ players: [], mobCount: 1 });
    sys.start();
    const mob = [...mobs.values()][0]!;
    const r = sys.applyDamage(mob.id, 10);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.killed).toBe(false);
      expect(r.newHp).toBe(mob.maxHp - 10);
    }
  });

  test("killing a mob removes it from map, spawns drop, fires onMobKilled", () => {
    const { sys, mobs, drops, killed } = makeSystem({ players: [], mobCount: 1 });
    sys.start();
    const mob = [...mobs.values()][0]!;
    const hp = mob.hp;
    const r = sys.applyDamage(mob.id, hp + 100);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.killed).toBe(true);
      expect(r.newHp).toBe(0);
    }
    expect(mobs.has(mob.id)).toBe(false);
    expect(drops.length).toBe(1);
    expect(killed).toEqual([mob.id]);
  });

  test("returns not_found for missing mob", () => {
    const { sys } = makeSystem({ players: [], mobCount: 1 });
    sys.start();
    const r = sys.applyDamage("nope", 5);
    expect(r).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("MobSystem respawn", () => {
  test("respawns a dead mob after respawnDelayMs", () => {
    let t = 0;
    const { sys, mobs } = makeSystem({
      players: [{ id: "p1", pos: { x: 0, y: 0, z: 0 }, alive: true }],
      rng: () => 0.5,
      mobCount: 1,
      now: () => t,
    });
    sys.start();
    const mob = [...mobs.values()][0]!;
    sys.applyDamage(mob.id, 1000);
    expect(mobs.size).toBe(0);
    t = 4000;
    sys.tick(100);
    expect(mobs.size).toBe(0);
    t = 9000;
    sys.tick(100);
    expect(mobs.size).toBe(1);
  });
});

describe("MobSystem loot table", () => {
  test("picks from loot table using provided rng (heal_potion bucket)", () => {
    const { sys, mobs, drops } = makeSystem({
      players: [],
      rng: () => 0.1,
      mobCount: 1,
      lootTable: [
        { value: "heal_potion", weight: 80 },
        { value: "sword", weight: 18 },
        { value: "soul", weight: 2 },
      ],
    });
    sys.start();
    const mob = [...mobs.values()][0]!;
    sys.applyDamage(mob.id, 1000);
    expect(drops[0]!.itemId).toBe("heal_potion");
    expect(drops[0]!.qty).toBe(1);
  });

  test("picks rare entry at the tail end of the distribution", () => {
    const { sys, mobs, drops } = makeSystem({
      players: [],
      rng: () => 0.99,
      mobCount: 1,
      lootTable: [
        { value: "heal_potion", weight: 80 },
        { value: "sword", weight: 18 },
        { value: "soul", weight: 2 },
      ],
    });
    sys.start();
    const mob = [...mobs.values()][0]!;
    sys.applyDamage(mob.id, 1000);
    expect(drops[0]!.itemId).toBe("soul");
  });
});
