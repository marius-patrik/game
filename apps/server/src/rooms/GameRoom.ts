import { Room, type Client } from "@colyseus/core";
import { GameRoomState, Player } from "@game/shared";

type MoveMessage = { x: number; y: number; z: number };

export class GameRoom extends Room<GameRoomState> {
  maxClients = 64;
  state = new GameRoomState();

  onCreate() {
    this.onMessage<MoveMessage>("move", (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      p.x = msg.x;
      p.y = msg.y;
      p.z = msg.z;
    });

    this.setSimulationInterval((dt) => this.tick(dt), 1000 / 20);
  }

  onJoin(client: Client) {
    const p = new Player();
    p.id = client.sessionId;
    this.state.players.set(client.sessionId, p);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }

  private tick(_dt: number) {
    // 20Hz server tick
  }
}
