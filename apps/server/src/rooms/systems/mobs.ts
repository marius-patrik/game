import type { MapSchema } from "@colyseus/schema";
import {
  clampToBounds,
  type ItemId,
  Mob,
  pickWeighted,
  type Vec3,
  type WeightedEntry,
  type Zone,
} from "@game/shared";

export type MobKind = "grunt" | "caster" | "boss" | "healer";

export type MobArchetype = {
  kind: MobKind;
  speed: number;
  maxHp: number;
  contactRange: number;
  contactDamage: number;
  contactCooldownMs: number;
  detectRadius: number;
  lootTable: readonly WeightedEntry<ItemId>[];
  xpBonus: number; // extra XP on kill
  goldDrop: [number, number]; // min..max gold
  spawnWeight: number;
};

const GRUNT: MobArchetype = {
  kind: "grunt",
  speed: 1.8,
  maxHp: 30,
  contactRange: 1.2,
  contactDamage: 5,
  contactCooldownMs: 1000,
  detectRadius: 8,
  lootTable: [
    { value: "heal_potion", weight: 80 },
    { value: "mana_potion", weight: 30 },
    { value: "sword", weight: 12 },
    { value: "helm", weight: 10 },
    { value: "soul", weight: 2 },
  ],
  xpBonus: 0,
  goldDrop: [2, 6],
  spawnWeight: 70,
};

const CASTER: MobArchetype = {
  kind: "caster",
  speed: 1.2,
  maxHp: 22,
  contactRange: 1.2,
  contactDamage: 7,
  contactCooldownMs: 900,
  detectRadius: 10,
  lootTable: [
    { value: "mana_potion", weight: 80 },
    { value: "ring_spark", weight: 12 },
    { value: "soul", weight: 6 },
  ],
  xpBonus: 5,
  goldDrop: [4, 10],
  spawnWeight: 25,
};

const BOSS: MobArchetype = {
  kind: "boss",
  speed: 1.4,
  maxHp: 140,
  contactRange: 1.6,
  contactDamage: 14,
  contactCooldownMs: 1200,
  detectRadius: 14,
  lootTable: [
    { value: "greataxe", weight: 35 },
    { value: "cuirass", weight: 30 },
    { value: "ring_spark", weight: 20 },
    { value: "soul", weight: 10 },
    { value: "heal_potion", weight: 5 },
  ],
  xpBonus: 60,
  goldDrop: [25, 60],
  spawnWeight: 5,
};

// Healer: low-HP support mob that radiates healing to nearby allies. Doesn't
// chase or melee; stays put and ticks a small HP refund on other mobs in range.
// Excluded from the random spawn mix — only enters via spawnSpecificKind().
const HEALER: MobArchetype = {
  kind: "healer",
  speed: 0.8,
  maxHp: 20,
  contactRange: 0.8,
  contactDamage: 0,
  contactCooldownMs: 99_999,
  detectRadius: 6,
  lootTable: [
    { value: "mana_potion", weight: 70 },
    { value: "ring_spark", weight: 20 },
    { value: "soul", weight: 5 },
  ],
  xpBonus: 10,
  goldDrop: [3, 8],
  spawnWeight: 0,
};

/** Boss enters an enraged "charge" mode once HP drops below this fraction —
 * speed + attack cadence ramp up so the final push feels harder. */
const BOSS_ENRAGE_HP_FRACTION = 0.5;
const BOSS_ENRAGE_SPEED = 2.6;
const BOSS_ENRAGE_CONTACT_COOLDOWN_MS = 720;
const BOSS_ENRAGE_TELEGRAPH_MS = 400;

const ARCHETYPES: Record<MobKind, MobArchetype> = {
  grunt: GRUNT,
  caster: CASTER,
  boss: BOSS,
  healer: HEALER,
};

// Healer tuning. Radius is the AoE around the healer; heal tick is applied
// to each ally inside the radius every HEALER_TICK_MS, capped at mob maxHp.
const HEALER_HEAL_RADIUS = 3;
const HEALER_HEAL_RADIUS_SQ = HEALER_HEAL_RADIUS * HEALER_HEAL_RADIUS;
const HEALER_TICK_HP = 4;
const HEALER_TICK_MS = 1000;

// spawn distribution per zone: [kind, weight] — weights sum to 100 roughly.
const ZONE_SPAWN_MIX: Record<string, ReadonlyArray<WeightedEntry<MobKind>>> = {
  lobby: [{ value: "grunt", weight: 100 }],
  arena: [
    { value: "grunt", weight: 55 },
    { value: "caster", weight: 35 },
    { value: "boss", weight: 10 },
  ],
};

const ZONE_MOB_COUNTS: Record<string, number> = {
  lobby: 3,
  arena: 6,
};

export type PlayerRef = { id: string; pos: Vec3; alive: boolean };

export type MobHitResult =
  | { ok: false; reason: "not_found" | "already_dead" }
  | {
      ok: true;
      targetId: string;
      newHp: number;
      killed: boolean;
      dropPos: Vec3;
      kind: MobKind;
      xpBonus: number;
      gold: number;
    };

export type MobDamageSource = { mobId: string; kind: MobKind };

export type CasterBoltEvent = {
  id: string;
  mobId: string;
  from: Vec3;
  to: Vec3;
  targetId: string;
  durationMs: number;
  damage: number;
};

export type MobSystemDeps = {
  mobs: MapSchema<Mob>;
  zone: Zone;
  getPlayers: () => readonly PlayerRef[];
  damagePlayer: (playerId: string, dmg: number, source: MobDamageSource) => void;
  onMobKilled?: (mobId: string, pos: Vec3, kind: MobKind) => void;
  onTelegraph?: (mobId: string, pos: Vec3, radius: number, durationMs: number) => void;
  onCasterBolt?: (bolt: CasterBoltEvent) => void;
  spawnDrop: (itemId: ItemId, qty: number, pos: Vec3) => void;
  rng?: () => number;
  now?: () => number;
  mobCount?: number;
};

const BOSS_TELEGRAPH_MS = 600;
const BOSS_TELEGRAPH_RADIUS = 2.2;

// Caster mobs stand off at ~5m and fire bolts; contact damage is disabled
// so closing the distance becomes a useful kiting strategy for the player.
const CASTER_KITE_RANGE = 5;
const CASTER_BACKPEDAL_RANGE = 3;
const CASTER_BOLT_SPEED = 9; // m/s — translates to a roughly 550ms flight at max range
const CASTER_BOLT_MAX_FLIGHT_MS = 1200;
const CASTER_BOLT_DAMAGE = 8;

type MobRuntime = {
  lastAttackAt: number;
  kind: MobKind;
  /** timestamp at which a pending boss strike should resolve; undefined when not winding */
  windingStrikeAt?: number;
  windingTargetId?: string;
  windingOrigin?: Vec3;
  /** healer: last heal-tick timestamp; used to gate the HEALER_TICK_MS cadence */
  lastHealAt?: number;
};

export class MobSystem {
  private readonly mobs: MapSchema<Mob>;
  private readonly zone: Zone;
  private readonly getPlayers: () => readonly PlayerRef[];
  private readonly damagePlayer: (playerId: string, dmg: number, source: MobDamageSource) => void;
  private readonly onMobKilled: (mobId: string, pos: Vec3, kind: MobKind) => void;
  private readonly onTelegraph: (
    mobId: string,
    pos: Vec3,
    radius: number,
    durationMs: number,
  ) => void;
  private readonly onCasterBolt: (bolt: CasterBoltEvent) => void;
  private readonly spawnDrop: (itemId: ItemId, qty: number, pos: Vec3) => void;
  private readonly rng: () => number;
  private readonly now: () => number;
  private readonly targetCount: number;
  private readonly runtime = new Map<string, MobRuntime>();
  private readonly respawnAt = new Map<string, number>();
  /** Mob ids that were explicitly spawned via spawnSpecificKind — when they
   * die, respawn as the same kind instead of picking from the zone mix. */
  private readonly respawnKind = new Map<string, MobKind>();
  private counter = 0;
  private boltCounter = 0;
  private lastPlayerPresenceAt = 0;
  private readonly idlePauseAfterEmptyMs = 30_000;
  private readonly spawnInsetFromPlayer = 4;
  private readonly respawnDelayMs = 8000;
  private readonly maxContactDmgPerTick = 15;

  constructor(deps: MobSystemDeps) {
    this.mobs = deps.mobs;
    this.zone = deps.zone;
    this.getPlayers = deps.getPlayers;
    this.damagePlayer = deps.damagePlayer;
    this.onMobKilled = deps.onMobKilled ?? (() => {});
    this.onTelegraph = deps.onTelegraph ?? (() => {});
    this.onCasterBolt = deps.onCasterBolt ?? (() => {});
    this.spawnDrop = deps.spawnDrop;
    this.rng = deps.rng ?? Math.random;
    this.now = deps.now ?? (() => Date.now());
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
    this.respawnKind.clear();
  }

  onPlayerLeave(_sessionId: string): void {
    /* noop */
  }

  applyDamage(mobId: string, amount: number): MobHitResult {
    const mob = this.mobs.get(mobId);
    if (!mob) return { ok: false, reason: "not_found" };
    if (!mob.alive) return { ok: false, reason: "already_dead" };
    const newHp = Math.max(0, mob.hp - amount);
    mob.hp = newHp;
    const killed = newHp === 0;
    const pos: Vec3 = { x: mob.x, y: mob.y, z: mob.z };
    const runtime = this.runtime.get(mobId);
    const kind = runtime?.kind ?? "grunt";
    const arche = ARCHETYPES[kind];
    if (killed) this.killMob(mob, kind);
    const goldMin = arche.goldDrop[0];
    const goldMax = arche.goldDrop[1];
    const gold = killed ? Math.floor(goldMin + this.rng() * (goldMax - goldMin + 1)) : 0;
    return {
      ok: true,
      targetId: mobId,
      newHp,
      killed,
      dropPos: pos,
      kind,
      xpBonus: killed ? arche.xpBonus : 0,
      gold,
    };
  }

  /** Damage all mobs within `radius` of `origin`. Returns per-hit results. */
  applyRadialDamage(origin: Vec3, radius: number, amount: number): MobHitResult[] {
    const out: MobHitResult[] = [];
    const r2 = radius * radius;
    for (const [, mob] of this.mobs) {
      if (!mob.alive) continue;
      const dx = mob.x - origin.x;
      const dz = mob.z - origin.z;
      if (dx * dx + dz * dz > r2) continue;
      out.push(this.applyDamage(mob.id, amount));
    }
    return out;
  }

  tick(dtMs: number): void {
    const now = this.now();
    const players = this.getPlayers().filter((p) => p.alive);

    if (players.length > 0) this.lastPlayerPresenceAt = now;
    const paused = now - this.lastPlayerPresenceAt > this.idlePauseAfterEmptyMs;

    if (!paused) {
      const due: string[] = [];
      for (const [mobId, readyAt] of this.respawnAt) {
        if (now >= readyAt) due.push(mobId);
      }
      for (const mobId of due) {
        this.respawnAt.delete(mobId);
        const forcedKind = this.respawnKind.get(mobId);
        if (forcedKind !== undefined) {
          this.respawnKind.delete(mobId);
          const newId = this.spawnMob(forcedKind);
          this.respawnKind.set(newId, forcedKind);
        } else {
          this.spawnMob();
        }
      }
    }

    const dtSec = dtMs / 1000;
    const playerDamageThisTick = new Map<string, number>();

    for (const [, mob] of this.mobs) {
      if (!mob.alive) continue;
      const runtime = this.runtime.get(mob.id);
      const kind = runtime?.kind ?? "grunt";
      const arche = ARCHETYPES[kind];

      // Healer: stand still and radiate heal-ticks to nearby mobs. No player
      // interaction at all — contact damage is 0 and chasing is skipped.
      if (kind === "healer") {
        const rt = this.ensureRuntime(mob.id, kind);
        const lastHealAt = rt.lastHealAt ?? 0;
        if (now - lastHealAt >= HEALER_TICK_MS) {
          this.applyHealTick(mob);
          rt.lastHealAt = now;
        }
        continue;
      }

      const nearest = this.findNearestPlayer(mob, players, arche.detectRadius);
      if (!nearest) continue;
      const enraged = kind === "boss" && mob.hp <= mob.maxHp * BOSS_ENRAGE_HP_FRACTION;
      const speed = enraged ? BOSS_ENRAGE_SPEED : arche.speed;
      const contactCooldownMs = enraged ? BOSS_ENRAGE_CONTACT_COOLDOWN_MS : arche.contactCooldownMs;
      const telegraphMs = enraged ? BOSS_ENRAGE_TELEGRAPH_MS : BOSS_TELEGRAPH_MS;

      const dx = nearest.pos.x - mob.x;
      const dz = nearest.pos.z - mob.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= 0.0001) continue;
      // Casters kite: hold in a band 3-5m from the target, and back away
      // instead of charging in if the player closes. Non-casters (including
      // an enraged boss) use the `speed` computed above.
      let stepSigned = Math.min(speed * dtSec, dist);
      if (kind === "caster") {
        if (dist <= CASTER_KITE_RANGE && dist >= CASTER_BACKPEDAL_RANGE) {
          stepSigned = 0; // stand and shoot
        } else if (dist < CASTER_BACKPEDAL_RANGE) {
          stepSigned = -Math.min(arche.speed * dtSec, CASTER_BACKPEDAL_RANGE - dist);
        }
      }
      const nx = mob.x + (dx / dist) * stepSigned;
      const nz = mob.z + (dz / dist) * stepSigned;
      const clamped = clampToBounds({ x: nx, y: mob.y, z: nz }, this.zone);
      mob.x = clamped.x;
      mob.z = clamped.z;

      const nowDist = Math.hypot(nearest.pos.x - mob.x, nearest.pos.z - mob.z);
      const rt = this.ensureRuntime(mob.id, kind);

      // Caster: fire a tracked bolt on cooldown. Contact damage is disabled
      // for casters so the pattern is "close the gap to silence them".
      if (kind === "caster") {
        if (now - rt.lastAttackAt >= arche.contactCooldownMs && nowDist <= arche.detectRadius) {
          rt.lastAttackAt = now;
          const flightMs = Math.min(
            CASTER_BOLT_MAX_FLIGHT_MS,
            Math.max(200, (nowDist / CASTER_BOLT_SPEED) * 1000),
          );
          this.boltCounter += 1;
          const boltId = `b${this.boltCounter.toString(36)}`;
          this.onCasterBolt({
            id: boltId,
            mobId: mob.id,
            from: { x: mob.x, y: mob.y + 0.6, z: mob.z },
            to: { x: nearest.pos.x, y: nearest.pos.y + 0.6, z: nearest.pos.z },
            targetId: nearest.id,
            durationMs: flightMs,
            damage: CASTER_BOLT_DAMAGE,
          });
        }
        continue;
      }

      // Boss AOE: broadcast a telegraph before the damage resolves, then
      // deliver damage to anyone still in the marked radius.
      if (kind === "boss") {
        if (rt.windingStrikeAt !== undefined) {
          if (now >= rt.windingStrikeAt) {
            const origin = rt.windingOrigin ?? { x: mob.x, y: mob.y, z: mob.z };
            const r2 = BOSS_TELEGRAPH_RADIUS * BOSS_TELEGRAPH_RADIUS;
            for (const pl of players) {
              const pdx = pl.pos.x - origin.x;
              const pdz = pl.pos.z - origin.z;
              if (pdx * pdx + pdz * pdz > r2) continue;
              const already = playerDamageThisTick.get(pl.id) ?? 0;
              const room = this.maxContactDmgPerTick - already;
              if (room > 0) {
                const dmg = Math.min(arche.contactDamage, room);
                this.damagePlayer(pl.id, dmg, { mobId: mob.id, kind });
                playerDamageThisTick.set(pl.id, already + dmg);
              }
            }
            rt.lastAttackAt = now;
            rt.windingStrikeAt = undefined;
            rt.windingTargetId = undefined;
            rt.windingOrigin = undefined;
          }
        } else if (nowDist <= arche.contactRange + 0.8) {
          if (now - rt.lastAttackAt >= contactCooldownMs) {
            rt.windingStrikeAt = now + telegraphMs;
            rt.windingTargetId = nearest.id;
            rt.windingOrigin = { x: mob.x, y: mob.y, z: mob.z };
            this.onTelegraph(mob.id, rt.windingOrigin, BOSS_TELEGRAPH_RADIUS, telegraphMs);
          }
        }
        continue;
      }

      if (nowDist <= arche.contactRange) {
        if (now - rt.lastAttackAt >= contactCooldownMs) {
          const already = playerDamageThisTick.get(nearest.id) ?? 0;
          const room = this.maxContactDmgPerTick - already;
          if (room > 0) {
            const dmg = Math.min(arche.contactDamage, room);
            this.damagePlayer(nearest.id, dmg, { mobId: mob.id, kind });
            playerDamageThisTick.set(nearest.id, already + dmg);
            rt.lastAttackAt = now;
          }
        }
      }
    }
  }

  /** Spawn one mob of a specific kind, regardless of the zone's spawn weights.
   * Used for scripted arena spawns (e.g. the healer that the arena seeds on
   * create). The mob lives inside the same respawn + runtime lifecycle as
   * weighted spawns; when it dies it respawns as the same kind. */
  spawnSpecificKind(kind: MobKind): void {
    const id = this.spawnMob(kind);
    this.respawnKind.set(id, kind);
  }

  /** Healer heal-tick. Iterates all mobs and heals each non-self mob whose
   * XZ distance is within HEALER_HEAL_RADIUS, capped at that mob's maxHp. */
  private applyHealTick(healer: Mob): void {
    for (const [, other] of this.mobs) {
      if (other.id === healer.id) continue;
      if (!other.alive) continue;
      const dx = other.x - healer.x;
      const dz = other.z - healer.z;
      if (dx * dx + dz * dz > HEALER_HEAL_RADIUS_SQ) continue;
      other.hp = Math.min(other.maxHp, other.hp + HEALER_TICK_HP);
    }
  }

  private findNearestPlayer(
    mob: Mob,
    players: readonly PlayerRef[],
    detectRadius: number,
  ): PlayerRef | null {
    let best: PlayerRef | null = null;
    let bestDistSq = detectRadius * detectRadius;
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

  private killMob(mob: Mob, kind: MobKind): void {
    const pos: Vec3 = { x: mob.x, y: mob.y, z: mob.z };
    mob.alive = false;
    const arche = ARCHETYPES[kind];
    const itemId = pickWeighted(arche.lootTable, this.rng);
    this.spawnDrop(itemId, 1, pos);
    this.onMobKilled(mob.id, pos, kind);
    this.mobs.delete(mob.id);
    this.runtime.delete(mob.id);
    this.respawnAt.set(mob.id, this.now() + this.respawnDelayMs);
  }

  private pickKind(): MobKind {
    const mix = ZONE_SPAWN_MIX[this.zone.id] ?? [{ value: "grunt" as MobKind, weight: 1 }];
    return pickWeighted(mix, this.rng);
  }

  private spawnMob(forcedKind?: MobKind): string {
    this.counter += 1;
    const kind = forcedKind ?? this.pickKind();
    const arche = ARCHETYPES[kind];
    const id = `m${this.counter.toString(36)}`;
    const pos = this.pickSpawnPos();
    const mob = new Mob();
    mob.id = id;
    mob.kind = kind;
    mob.x = pos.x;
    mob.y = pos.y;
    mob.z = pos.z;
    mob.hp = arche.maxHp;
    mob.maxHp = arche.maxHp;
    mob.alive = true;
    this.mobs.set(id, mob);
    this.runtime.set(id, { lastAttackAt: Number.NEGATIVE_INFINITY, kind });
    return id;
  }

  private pickSpawnPos(): Vec3 {
    const { min, max } = this.zone.bounds;
    const spawn = this.zone.spawn;
    const inset = this.spawnInsetFromPlayer;
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

  private ensureRuntime(mobId: string, kind: MobKind): MobRuntime {
    const existing = this.runtime.get(mobId);
    if (existing) return existing;
    const next = { lastAttackAt: Number.NEGATIVE_INFINITY, kind };
    this.runtime.set(mobId, next);
    return next;
  }
}
