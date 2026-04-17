import { tokenStore } from "@/auth/client";
import { resolveWsEndpoint } from "@/lib/endpoint";
import { DEFAULT_ZONE, type GameRoomState, type ZoneId } from "@game/shared";
import { Client, type Room } from "colyseus.js";

const endpoint = resolveWsEndpoint();

export const client = new Client(endpoint);

export async function joinZone(
  zoneId: ZoneId = DEFAULT_ZONE,
  characterId?: string,
): Promise<Room<GameRoomState>> {
  const token = tokenStore.get() ?? undefined;
  return client.joinOrCreate<GameRoomState>("zone", { zoneId, token, characterId });
}

export async function travel(
  current: Room<GameRoomState> | undefined,
  zoneId: ZoneId,
  characterId?: string,
): Promise<Room<GameRoomState>> {
  if (current) await current.leave();
  return joinZone(zoneId, characterId);
}
