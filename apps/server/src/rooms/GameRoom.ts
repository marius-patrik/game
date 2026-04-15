import { type AuthContext, type Client, Room } from "@colyseus/core";
import {
  DEFAULT_ZONE,
  GameRoomState,
  Player,
  type Zone,
  clampToBounds,
  getZone,
} from "@game/shared";
import { auth } from "../auth";

type MoveMessage = { x: number; y: number; z: number };
type JoinOptions = { token?: string; zoneId?: string };
export type SessionUser = { id: string; name: string; role: string };

export class GameRoom extends Room<GameRoomState> {
  override maxClients = 64;
  override state = new GameRoomState();
  private zone!: Zone;

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
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const clamped = clampToBounds({ x: msg.x, y: msg.y, z: msg.z }, this.zone);
      p.x = clamped.x;
      p.y = clamped.y;
      p.z = clamped.z;
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
  }

  override onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }

  private tick(_dt: number) {
    // 20Hz server tick
  }
}
