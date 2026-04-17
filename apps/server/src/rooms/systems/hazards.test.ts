import { describe, expect, test } from "bun:test";
import { MapSchema } from "@colyseus/schema";
import type { HazardZone } from "@game/shared";
import { type HazardPlayerRef, HazardSystem } from "./hazards";

type Harness = {
  hazards: MapSchema<HazardZone>;
  system: HazardSystem;
  damageLog: Array<{ id: string; dmg: number }>;
};

function makeHarness(players: readonly HazardPlayerRef[], now: () => number): Harness {
  const hazards = new MapSchema<HazardZone>();
  const damageLog: Array<{ id: string; dmg: number }> = [];
  const system = new HazardSystem({
    hazards,
    getPlayers: () => players,
    damagePlayer: (id, dmg) => damageLog.push({ id, dmg }),
    now,
    tickMs: 500,
  });
  return { hazards, system, damageLog };
}

describe("HazardSystem", () => {
  test("player standing inside the radius takes dps * tickSeconds per tick", () => {
    const clock = { now: 1000 };
    const players: HazardPlayerRef[] = [{ id: "p1", x: 0, z: 0, alive: true }];
    const { system, damageLog } = makeHarness(players, () => clock.now);
    system.addHazard({ x: 0, z: 0, radius: 5, dps: 3 });

    // Constructor set lastTickAt = 1000; advance past tickMs and tick.
    clock.now = 1500;
    system.tick(500);
    expect(damageLog).toHaveLength(1);
    expect(damageLog[0]?.id).toBe("p1");
    expect(damageLog[0]?.dmg).toBeCloseTo(1.5); // 3 dps * 0.5s

    clock.now = 2000;
    system.tick(500);
    expect(damageLog).toHaveLength(2);
    // Cumulative 3 HP across two ticks = 1.5 + 1.5.
    const total = damageLog.reduce((sum, entry) => sum + entry.dmg, 0);
    expect(total).toBeCloseTo(3);
  });

  test("player outside the radius takes no damage", () => {
    const clock = { now: 1000 };
    const players: HazardPlayerRef[] = [{ id: "p1", x: 20, z: 20, alive: true }];
    const { system, damageLog } = makeHarness(players, () => clock.now);
    system.addHazard({ x: 0, z: 0, radius: 5, dps: 3 });

    clock.now = 1500;
    system.tick(500);
    clock.now = 2000;
    system.tick(500);

    expect(damageLog).toHaveLength(0);
  });

  test("dead player is skipped even if inside the radius", () => {
    const clock = { now: 1000 };
    const players: HazardPlayerRef[] = [{ id: "p1", x: 0, z: 0, alive: false }];
    const { system, damageLog } = makeHarness(players, () => clock.now);
    system.addHazard({ x: 0, z: 0, radius: 5, dps: 3 });

    clock.now = 1500;
    system.tick(500);
    clock.now = 2000;
    system.tick(500);

    expect(damageLog).toHaveLength(0);
  });
});
