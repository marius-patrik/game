import type { GameRoomState } from "@game/shared";
import { Client, type Room } from "colyseus.js";

const endpoint =
  (typeof window !== "undefined" && (window as unknown as { __WS__?: string }).__WS__) ||
  "ws://localhost:2567";

export const client = new Client(endpoint);

export async function joinGame(): Promise<Room<GameRoomState>> {
  return client.joinOrCreate<GameRoomState>("game");
}
