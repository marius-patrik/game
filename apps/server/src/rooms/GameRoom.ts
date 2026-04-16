import { type AuthContext, type Client, Room } from "@colyseus/core";
import { DEFAULT_ZONE, GameRoomState, Player, type Vec3, type Zone, getZone } from "@game/shared";
import { auth } from "../auth";
import { type CombatConfig, type Combatant, DEFAULT_COMBAT, resolveAttack } from "../combat";
import { getPlayerLocation, savePlayerLocation } from "../db/playerLocation";
import { log } from "../logger";
import {
  DEFAULT_SECURITY,
  RateLimiter,
  type SecurityConfig,
  ViolationTracker,
  validateMovement,
} from "../security";

type MoveMessage = { x: number; y: number; z: number };
type JoinOptions = { token?: string; zoneId?: string };
export type SessionUser = { id: string; name: string; role: string };

type PlayerSecurityState = { lastPos: Vec3; lastMoveAt: number };
type PlayerCombatState = { invulnerableUntil: number };

const SAVE_INTERVAL_MS = 10_000;

export class GameRoom extends Room<GameRoomState> {
  override maxClients = 64;
  override state = new GameRoomState();
  private zone!: Zone;
  private security: SecurityConfig = DEFAULT_SECURITY;
  private combat: CombatConfig = DEFAULT_COMBAT;
  private rateLimiter = new RateLimiter(this.security.rateLimits);
  private violations = new ViolationTracker(this.security.violations);
  private playerSec = new Map<string, PlayerSecurityState>();
  private playerCombat = new Map<string, PlayerCombatState>();
  private saveInterval?: ReturnType<typeof setInterval>;

  override async onAuth(_client: Client, options: JoinOptions, ctx: AuthContext) {
    const headers = new Headers();
    const cookie = ctx.headers.cookie;
    if (typeof cookie === "string") headers.set("cookie", cookie);
    if (options?.token) headers.set("authorization", `Bearer ${options.token}`);

    const session = await auth.api.getSession({ headers });
    if (!session?.user) throw new Error("unauthorized");

    const user: SessionUser = {
      id: session.user.id,
      name: session.user.name,
      role: (session.user as { role?: string }).role ?? "player",
    };
    return user;
  }

  override onCreate(options: JoinOptions = {}) {
    const zone = getZone(options.zoneId ?? DEFAULT_ZONE);
    if (!zone) throw new Error(`unknown zoneId ${options.zoneId}`);
    this.zone = zone;
    this.maxClients = zone.maxClients;
    this.setMetadata({ zoneId: zone.id, name: zone.name });

    this.onMessage<MoveMessage>("move", (client, msg) => {
      this.handleMove(client, msg);
    });

    this.onMessage("attack", (client) => {
      this.handleAttack(client);
    });

    this.setSimulationInterval((dt) => this.tick(dt), 1000 / 20);
    this.saveInterval = setInterval(() => this.flushAllPositions(), SAVE_INTERVAL_MS);
  }

  override async onJoin(client: Client<unknown, SessionUser>) {
    const p = new Player();
    p.id = client.sessionId;
    p.name = client.auth?.name ?? "";

    const userId = client.auth?.id;
    let spawn: Vec3 = { x: this.zone.spawn.x, y: this.zone.spawn.y, z: this.zone.spawn.z };
    if (userId) {
      try {
        const saved = await getPlayerLocation(userId, this.zone.id);
        if (saved) {
          spawn = { x: saved.x, y: saved.y, z: saved.z };
        }
      } catch (err) {
        log.warn({ err, userId, zoneId: this.zone.id }, "failed to load player location");
      }
    }
    p.x = spawn.x;
    p.y = spawn.y;
    p.z = spawn.z;
    p.hp = this.combat.maxHp;
    p.maxHp = this.combat.maxHp;
    p.alive = true;
    this.state.players.set(client.sessionId, p);
    this.playerSec.set(client.sessionId, {
      lastPos: { x: p.x, y: p.y, z: p.z },
      lastMoveAt: Date.now(),
    });
    this.playerCombat.set(client.sessionId, {
      invulnerableUntil: Date.now() + this.combat.invulnerableAfterRespawnMs,
    });
  }

  override async onLeave(client: Client<unknown, SessionUser>) {
    const p = this.state.players.get(client.sessionId);
    const userId = client.auth?.id;
    if (p && userId) {
      try {
        await savePlayerLocation(userId, this.zone.id, { x: p.x, y: p.y, z: p.z });
      } catch (err) {
        log.warn({ err, userId, zoneId: this.zone.id }, "failed to save player location on leave");
      }
    }
    this.state.players.delete(client.sessionId);
    this.playerSec.delete(client.sessionId);
    this.playerCombat.delete(client.sessionId);
    this.rateLimiter.forget(client.sessionId);
    this.violations.forget(client.sessionId);
  }

  override async onDispose() {
    if (this.saveInterval) clearInterval(this.saveInterval);
    await this.flushAllPositions();
  }

  private handleMove(client: Client<unknown, SessionUser>, msg: MoveMessage) {
    const p = this.state.players.get(client.sessionId);
    const sec = this.playerSec.get(client.sessionId);
    if (!p || !sec) return;

    if (!this.rateLimiter.consume(client.sessionId, "move")) {
      this.recordViolation(client, p, "rate_limit:move");
      return;
    }

    const now = Date.now();
    const dtMs = now - sec.lastMoveAt;
    const result = validateMovement({
      prev: sec.lastPos,
      next: { x: msg.x, y: msg.y, z: msg.z },
      dtMs,
      zone: this.zone,
      maxSpeed: this.security.movement.maxSpeed,
      tolerance: this.security.movement.tolerance,
    });

    p.x = result.position.x;
    p.y = result.position.y;
    p.z = result.position.z;
    sec.lastPos = { ...result.position };
    sec.lastMoveAt = now;

    if (!result.ok) {
      this.recordViolation(client, p, `movement:${result.reason}`);
    }
  }

  private handleAttack(client: Client<unknown, SessionUser>) {
    const attacker = this.state.players.get(client.sessionId);
    if (!attacker || !attacker.alive) return;

    if (!this.rateLimiter.consume(client.sessionId, "attack")) {
      this.recordViolation(client, attacker, "rate_limit:attack");
      return;
    }

    const candidates: Combatant[] = [];
    this.state.players.forEach((p, id) => {
      candidates.push({ id, pos: { x: p.x, y: p.y, z: p.z }, alive: p.alive, hp: p.hp });
    });
    const attackerC: Combatant = {
      id: client.sessionId,
      pos: { x: attacker.x, y: attacker.y, z: attacker.z },
      alive: attacker.alive,
      hp: attacker.hp,
    };
    const result = resolveAttack(attackerC, candidates, this.combat);
    if (!result.ok) return;

    const target = this.state.players.get(result.targetId);
    const targetCombat = this.playerCombat.get(result.targetId);
    if (!target || !targetCombat) return;
    if (Date.now() < targetCombat.invulnerableUntil) return;

    target.hp = result.newHp;
    if (result.killed) {
      target.alive = false;
      const targetClient = this.clients.find((c) => c.sessionId === result.targetId);
      this.scheduleRespawn(result.targetId, targetClient);
    }

    this.broadcast(
      "attack",
      { attackerId: client.sessionId, targetId: result.targetId, killed: result.killed },
      { except: [] },
    );
  }

  private scheduleRespawn(targetId: string, client: Client | undefined) {
    this.clock.setTimeout(() => {
      const p = this.state.players.get(targetId);
      const combatState = this.playerCombat.get(targetId);
      if (!p || !combatState) return;
      p.x = this.zone.spawn.x;
      p.y = this.zone.spawn.y;
      p.z = this.zone.spawn.z;
      p.hp = this.combat.maxHp;
      p.alive = true;
      combatState.invulnerableUntil = Date.now() + this.combat.invulnerableAfterRespawnMs;
      const sec = this.playerSec.get(targetId);
      if (sec) {
        sec.lastPos = { x: p.x, y: p.y, z: p.z };
        sec.lastMoveAt = Date.now();
      }
      if (client) {
        client.send("respawned", { x: p.x, y: p.y, z: p.z });
      }
    }, this.combat.respawnDelayMs);
  }

  private recordViolation(client: Client, p: Player, reason: string) {
    const { count, shouldKick } = this.violations.record(client.sessionId);
    p.violations = count;
    log.warn(
      { sessionId: client.sessionId, userId: (client.auth as SessionUser)?.id, reason, count },
      "anti-cheat violation",
    );
    if (shouldKick) {
      log.warn(
        { sessionId: client.sessionId, userId: (client.auth as SessionUser)?.id, count },
        "anti-cheat kick",
      );
      client.leave(4003);
    }
  }

  private async flushAllPositions() {
    const saves: Promise<void>[] = [];
    for (const client of this.clients) {
      const typed = client as Client<unknown, SessionUser>;
      const p = this.state.players.get(typed.sessionId);
      const userId = typed.auth?.id;
      if (!p || !userId) continue;
      saves.push(
        savePlayerLocation(userId, this.zone.id, { x: p.x, y: p.y, z: p.z }).catch((err) => {
          log.warn({ err, userId, zoneId: this.zone.id }, "periodic save failed");
        }),
      );
    }
    await Promise.all(saves);
  }

  private tick(_dt: number) {
    // 20Hz server tick
  }
}
