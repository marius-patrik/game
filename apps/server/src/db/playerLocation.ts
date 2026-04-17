import type { Vec3 } from "@game/shared";
import { and, eq } from "drizzle-orm";
import { db as defaultDb } from "./client";
import { playerLocation } from "./schema";

type DB = typeof defaultDb;

export type PlayerLocationRow = {
  characterId: string;
  zoneId: string;
  x: number;
  y: number;
  z: number;
  updatedAt: Date;
};

export async function getPlayerLocation(
  characterId: string,
  zoneId: string,
  db: DB = defaultDb,
): Promise<PlayerLocationRow | undefined> {
  const rows = await db
    .select()
    .from(playerLocation)
    .where(and(eq(playerLocation.characterId, characterId), eq(playerLocation.zoneId, zoneId)))
    .limit(1);
  return rows[0];
}

export async function savePlayerLocation(
  characterId: string,
  zoneId: string,
  pos: Vec3,
  now: Date = new Date(),
  db: DB = defaultDb,
): Promise<void> {
  await db
    .insert(playerLocation)
    .values({ characterId, zoneId, x: pos.x, y: pos.y, z: pos.z, updatedAt: now })
    .onConflictDoUpdate({
      target: [playerLocation.characterId, playerLocation.zoneId],
      set: { x: pos.x, y: pos.y, z: pos.z, updatedAt: now },
    });
}
