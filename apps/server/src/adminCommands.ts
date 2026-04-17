import { matchMaker } from "@colyseus/core";
import { eq } from "drizzle-orm";
import { db as defaultDb } from "./db/client";
import { session as sessionTable } from "./db/schema";

type DB = typeof defaultDb;

const DEFAULT_MUTE_DURATION_MS = 900_000;

export type AdminCommandResult = { ok: true; roomId: string } | { ok: false; reason: "not_found" };

async function findRoomForSession(sessionId: string): Promise<string | undefined> {
  const rooms = await matchMaker.query({ name: "zone" });
  for (const room of rooms) {
    const clientIds = (room as unknown as { clientIds?: string[] }).clientIds;
    if (Array.isArray(clientIds) && clientIds.includes(sessionId)) {
      return room.roomId;
    }
  }
  return undefined;
}

export async function kickSession(sessionId: string): Promise<AdminCommandResult> {
  const roomId = await findRoomForSession(sessionId);
  if (!roomId) return { ok: false, reason: "not_found" };
  await matchMaker.remoteRoomCall(roomId, "_adminKick", [sessionId]);
  return { ok: true, roomId };
}

export async function muteSession(
  sessionId: string,
  durationMs: number = DEFAULT_MUTE_DURATION_MS,
): Promise<AdminCommandResult> {
  const roomId = await findRoomForSession(sessionId);
  if (!roomId) return { ok: false, reason: "not_found" };
  await matchMaker.remoteRoomCall(roomId, "_adminMute", [sessionId, durationMs]);
  return { ok: true, roomId };
}

export async function resolveUserIdForSession(sessionId: string): Promise<string | undefined> {
  const roomId = await findRoomForSession(sessionId);
  if (!roomId) return undefined;
  const userId = (await matchMaker.remoteRoomCall(roomId, "_adminGetUserId", [sessionId])) as
    | string
    | undefined;
  return userId;
}

export async function revokeUserSessions(userId: string, db: DB = defaultDb): Promise<number> {
  const rows = await db.delete(sessionTable).where(eq(sessionTable.userId, userId)).returning({
    id: sessionTable.id,
  });
  return rows.length;
}

export { DEFAULT_MUTE_DURATION_MS };
