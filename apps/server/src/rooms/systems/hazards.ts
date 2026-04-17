import type { MapSchema } from "@colyseus/schema";
import { HazardZone } from "@game/shared/schema";

export type HazardPlayerRef = { id: string; x: number; z: number; alive: boolean };

export type HazardSystemDeps = {
  hazards: MapSchema<HazardZone>;
  getPlayers: () => readonly HazardPlayerRef[];
  damagePlayer: (playerId: string, dmg: number) => void;
  now?: () => number;
  tickMs?: number;
};

export type HazardSpec = {
  x: number;
  z: number;
  radius: number;
  dps: number;
};

/** Static damage-on-enter circles. Each hazard applies `dps * (tickMs / 1000)`
 * HP damage to any alive player whose XZ distance is within its radius, on a
 * `tickMs`-gated cadence (default 500ms). Hazards are a first-class schema
 * entity so the client can render them from the same state stream. */
export class HazardSystem {
  private readonly hazards: MapSchema<HazardZone>;
  private readonly getPlayers: () => readonly HazardPlayerRef[];
  private readonly damagePlayer: (playerId: string, dmg: number) => void;
  private readonly now: () => number;
  private readonly tickMs: number;
  private counter = 0;
  private lastTickAt = 0;

  constructor(deps: HazardSystemDeps) {
    this.hazards = deps.hazards;
    this.getPlayers = deps.getPlayers;
    this.damagePlayer = deps.damagePlayer;
    this.now = deps.now ?? (() => Date.now());
    this.tickMs = deps.tickMs ?? 500;
    this.lastTickAt = this.now();
  }

  addHazard(spec: HazardSpec): string {
    this.counter += 1;
    const id = `h${this.counter.toString(36)}`;
    const zone = new HazardZone();
    zone.id = id;
    zone.x = spec.x;
    zone.z = spec.z;
    zone.radius = spec.radius;
    zone.dps = spec.dps;
    this.hazards.set(id, zone);
    return id;
  }

  stop(): void {
    this.hazards.clear();
  }

  tick(_dtMs: number): void {
    const now = this.now();
    if (now - this.lastTickAt < this.tickMs) return;
    this.lastTickAt = now;
    if (this.hazards.size === 0) return;

    const players = this.getPlayers().filter((p) => p.alive);
    if (players.length === 0) return;

    const tickSeconds = this.tickMs / 1000;
    for (const [, hazard] of this.hazards) {
      const r2 = hazard.radius * hazard.radius;
      const dmg = hazard.dps * tickSeconds;
      for (const p of players) {
        const dx = p.x - hazard.x;
        const dz = p.z - hazard.z;
        if (dx * dx + dz * dz > r2) continue;
        this.damagePlayer(p.id, dmg);
      }
    }
  }
}
