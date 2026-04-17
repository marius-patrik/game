import type { MapSchema } from "@colyseus/schema";
import {
  type ItemId,
  Mob,
  type Vec3,
  type WeightedEntry,
  type Zone,
  clampToBounds,
  pickWeighted,
} from "@game/shared";

export type MobConfig = {
  detectRadius: number;
  speed: number;
  contactRange: number;
  contactCooldownMs: number;
  contactDamage: number;
  maxContactDmgPerTick: number;
  maxHp: number;
  respawnDelayMs: number;
  idlePauseAfterEmptyMs: number;
  spawnInsetFromPlayer: number;
};

export const DEFAULT_MOB_CONFIG: MobConfig = {
  detectRadius: 8,
  speed: 1.8,
  contactRange: 1.2,
  contactCooldownMs: 1000,
  contactDamage: 5,
  maxContactDmgPerTick: 15,
  maxHp: 30,
  respawnDelayMs: 8000,
  idlePauseAfterEmptyMs: 30_000,
  spawnInsetFromPlayer: 4,
};

const ZONE_MOB_COUNTS: Record<string, number> = {
  lobby: 3,
  arena: 6,
};

const DEFAULT_LOOT_TABLE: readonly WeightedEntry<ItemId>[] = [
  { value: "heal_potion", weight: 80 },
  { value: "sword", weight: 18 },
  { value: "soul", weight: 2 },
];

export type PlayerRef = { id: string; pos: Vec3; alive: boolean };

export type MobHitResult =
  | { ok: false; reason: "not_found" | "already_dead" }
  | { ok: true; targetId: string; newHp: number; killed: boolean; dropPos: Vec3 };

export type MobSystemDeps = {
  mobs: MapSchema<Mob>;
  zone: Zone;
  getPlayers: () => readonly PlayerRef[];
  damagePlayer: (playerId: string, dmg: number) => void;
  onMobKilled?: (mobId: string, pos: Vec3) => void;
  spawnDrop: (itemId: ItemId, qty: number, pos: Vec3) => void;
  rng?: () => number;
  now?: () => number;
  config?: Partial<MobConfig>;
  lootTable?: readonly WeightedEntry<ItemId>[];
  mobCount?: number;
};

type MobRuntime = {
  lastAttackAt: number;
};

export class MobSystem {
  private readonly mobs: MapSchema<Mob>;
  private readonly zone: Zone;
  private readonly getPlayers: () => readonly PlayerRef[];
  private readonly damagePlayer: (playerId: string, dmg: number) => void;
  private readonly onMobKilled: (mobId: string, pos: Vec3) => void;
  private readonly spawnDrop: (itemId: ItemId, qty: number, pos: Vec3) => void;
  private readonly rng: () => number;
  private readonly now: () => number;
  private readonly config: MobConfig;
  private readonly lootTable: readonly WeightedEntry<ItemId>[];
  private readonly targetCount: number;
  private readonly runtime = new Map<string, MobRuntime>();
  private readonly respawnAt = new Map<string, number>();
  private counter = 0;
  private lastPlayerPresenceAt = 0;

  constructor(deps: MobSystemDeps) {
    this.mobs = deps.mobs;
    this.zone = deps.zone;
    this.getPlayers = deps.getPlayers;
    this.damagePlayer = deps.damagePlayer;
    this.onMobKilled = deps.onMobKilled ?? (() => {});
    this.spawnDrop = deps.spawnDrop;
    this.rng = deps.rng ?? Math.random;
    this.now = deps.now ?? (() => Date.now());
    this.config = { ...DEFAULT_MOB_CONFIG, ...(deps.config ?? {}) };
    this.lootTable = deps.lootTable ?? DEFAULT_LOOT_TABLE;
    this.targetCount = deps.mobCount ?? ZONE_MOB_COUNTS[deps.zone.id] ?? 3;
    this.lastPlayerPresenceAt = this.now();
  }

  start(): void {
    while (this.mobs.size < this.targetCount) this.spawnMob();
  }

  stop(): void {
    this.mobs.clear();
    this.runtime.clear();
    this.respawnAt.clear();
  }

  onPlayerLeave(_sessionId: string): void {
    // Targets are re-picked each tick from live players, so no runtime state needs clearing.
  }

  applyDamage(mobId: string, amount: number): MobHitResult {
    const mob = this.mobs.get(mobId);
    if (!mob) return { ok: false, reason: "not_found" };
    if (!mob.alive) return { ok: false, reason: "already_dead" };
    const newHp = Math.max(0, mob.hp - amount);
    mob.hp = newHp;
    const killed = newHp === 0;
    const pos: Vec3 = { x: mob.x, y: mob.y, z: mob.z };
    if (killed) this.killMob(mob);
    return { ok: true, targetId: mobId, newHp, killed, dropPos: pos };
  }

  tick(dtMs: number): void {
    const now = this.now();
    const players = this.getPlayers().filter((p) => p.alive);

    if (players.length > 0) this.lastPlayerPresenceAt = now;
    const paused = now - this.lastPlayerPresenceAt > this.config.idlePauseAfterEmptyMs;

    if (!paused) {
      const due: string[] = [];
      for (const [mobId, readyAt] of this.respawnAt) {
        if (now >= readyAt) due.push(mobId);
      }
      for (const mobId of due) {
        this.respawnAt.delete(mobId);
        this.spawnMob();
      }
    }

    const dtSec = dtMs / 1000;
    const playerDamageThisTick = new Map<string, number>();

    for (const [, mob] of this.mobs) {
      if (!mob.alive) continue;
      const nearest = this.findNearestPlayer(mob, players);
      if (!nearest) continue;
      const dx = nearest.pos.x - mob.x;
      const dz = nearest.pos.z - mob.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= 0.0001) continue;
      const step = Math.min(this.config.speed * dtSec, dist);
      const nx = mob.x + (dx / dist) * step;
      const nz = mob.z + (dz / dist) * step;
      const clamped = clampToBounds({ x: nx, y: mob.y, z: nz }, this.zone);
      mob.x = clamped.x;
      mob.z = clamped.z;

      const nowDist = Math.hypot(nearest.pos.x - mob.x, nearest.pos.z - mob.z);
      if (nowDist <= this.config.contactRange) {
        const rt = this.ensureRuntime(mob.id);
        if (now - rt.lastAttackAt >= this.config.contactCooldownMs) {
          const already = playerDamageThisTick.get(nearest.id) ?? 0;
          const room = this.config.maxContactDmgPerTick - already;
          if (room > 0) {
            const dmg = Math.min(this.config.contactDamage, room);
            this.damagePlayer(nearest.id, dmg);
            playerDamageThisTick.set(nearest.id, already + dmg);
            rt.lastAttackAt = now;
          }
        }
      }
    }
  }

  private findNearestPlayer(mob: Mob, players: readonly PlayerRef[]): PlayerRef | null {
    let best: PlayerRef | null = null;
    let bestDistSq = this.config.detectRadius * this.config.detectRadius;
    for (const p of players) {
      const dx = p.pos.x - mob.x;
      const dz = p.pos.z - mob.z;
      const d = dx * dx + dz * dz;
      if (d <= bestDistSq) {
        bestDistSq = d;
        best = p;
      }
    }
    return best;
  }

  private killMob(mob: Mob): void {
    const pos: Vec3 = { x: mob.x, y: mob.y, z: mob.z };
    mob.alive = false;
    const itemId = pickWeighted(this.lootTable, this.rng);
    this.spawnDrop(itemId, 1, pos);
    this.onMobKilled(mob.id, pos);
    this.mobs.delete(mob.id);
    this.runtime.delete(mob.id);
    this.respawnAt.set(mob.id, this.now() + this.config.respawnDelayMs);
  }

  private spawnMob(): void {
    this.counter += 1;
    const id = `m${this.counter.toString(36)}`;
    const pos = this.pickSpawnPos();
    const mob = new Mob();
    mob.id = id;
    mob.kind = "default";
    mob.x = pos.x;
    mob.y = pos.y;
    mob.z = pos.z;
    mob.hp = this.config.maxHp;
    mob.maxHp = this.config.maxHp;
    mob.alive = true;
    this.mobs.set(id, mob);
    this.runtime.set(id, { lastAttackAt: Number.NEGATIVE_INFINITY });
  }

  private pickSpawnPos(): Vec3 {
    const { min, max } = this.zone.bounds;
    const spawn = this.zone.spawn;
    const inset = this.config.spawnInsetFromPlayer;
    const insetSq = inset * inset;
    for (let i = 0; i < 8; i++) {
      const x = min.x + this.rng() * (max.x - min.x);
      const z = min.z + this.rng() * (max.z - min.z);
      const dx = x - spawn.x;
      const dz = z - spawn.z;
      if (dx * dx + dz * dz >= insetSq) return { x, y: 0, z };
    }
    const fallbackX = min.x + this.rng() * (max.x - min.x);
    const fallbackZ = min.z + this.rng() * (max.z - min.z);
    return { x: fallbackX, y: 0, z: fallbackZ };
  }

  private ensureRuntime(mobId: string): MobRuntime {
    const existing = this.runtime.get(mobId);
    if (existing) return existing;
    const next = { lastAttackAt: Number.NEGATIVE_INFINITY };
    this.runtime.set(mobId, next);
    return next;
  }
}
