import { tokenStore } from "@/auth/client";
import { DEFAULT_ZONE, type GameRoomState, type ZoneId } from "@game/shared";
import { Client, type Room } from "colyseus.js";

const endpoint =
  (typeof window !== "undefined" && (window as unknown as { __WS__?: string }).__WS__) ||
  "ws://localhost:2567";

export const client = new Client(endpoint);

export async function joinZone(zoneId: ZoneId = DEFAULT_ZONE): Promise<Room<GameRoomState>> {
  const token = tokenStore.get() ?? undefined;
  return client.joinOrCreate<GameRoomState>("zone", { zoneId, token });
}

export async function travel(
  current: Room<GameRoomState> | undefined,
  zoneId: ZoneId,
): Promise<Room<GameRoomState>> {
  if (current) await current.leave();
  return joinZone(zoneId);
}
