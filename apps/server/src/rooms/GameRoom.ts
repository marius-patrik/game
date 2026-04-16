import { type AuthContext, type Client, Room } from "@colyseus/core";
import { DEFAULT_ZONE, GameRoomState, Player, type Vec3, type Zone, getZone } from "@game/shared";
import { auth } from "../auth";
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

export class GameRoom extends Room<GameRoomState> {
  override maxClients = 64;
  override state = new GameRoomState();
  private zone!: Zone;
  private security: SecurityConfig = DEFAULT_SECURITY;
  private rateLimiter = new RateLimiter(this.security.rateLimits);
  private violations = new ViolationTracker(this.security.violations);
  private playerSec = new Map<string, PlayerSecurityState>();

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

    this.setSimulationInterval((dt) => this.tick(dt), 1000 / 20);
  }

  override onJoin(client: Client<unknown, SessionUser>) {
    const p = new Player();
    p.id = client.sessionId;
    p.name = client.auth?.name ?? "";
    p.x = this.zone.spawn.x;
    p.y = this.zone.spawn.y;
    p.z = this.zone.spawn.z;
    this.state.players.set(client.sessionId, p);
    this.playerSec.set(client.sessionId, {
      lastPos: { x: p.x, y: p.y, z: p.z },
      lastMoveAt: Date.now(),
    });
  }

  override onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.playerSec.delete(client.sessionId);
    this.rateLimiter.forget(client.sessionId);
    this.violations.forget(client.sessionId);
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

  private tick(_dt: number) {
    // 20Hz server tick
  }
}
