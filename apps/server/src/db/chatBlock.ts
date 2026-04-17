import { and, eq } from "drizzle-orm";
import { db as defaultDb } from "./client";
import { chatBlock } from "./schema";

type DB = typeof defaultDb;

export async function addBlock(
  userId: string,
  blockedUserId: string,
  db: DB = defaultDb,
  now: Date = new Date(),
): Promise<void> {
  await db
    .insert(chatBlock)
    .values({ userId, blockedUserId, createdAt: now })
    .onConflictDoNothing({ target: [chatBlock.userId, chatBlock.blockedUserId] });
}

export async function removeBlock(
  userId: string,
  blockedUserId: string,
  db: DB = defaultDb,
): Promise<void> {
  await db
    .delete(chatBlock)
    .where(and(eq(chatBlock.userId, userId), eq(chatBlock.blockedUserId, blockedUserId)));
}

export async function isBlocked(
  userId: string,
  blockedUserId: string,
  db: DB = defaultDb,
): Promise<boolean> {
  const rows = await db
    .select({ userId: chatBlock.userId })
    .from(chatBlock)
    .where(and(eq(chatBlock.userId, userId), eq(chatBlock.blockedUserId, blockedUserId)))
    .limit(1);
  return rows.length > 0;
}

export async function getBlockedBy(userId: string, db: DB = defaultDb): Promise<string[]> {
  const rows = await db
    .select({ blockedUserId: chatBlock.blockedUserId })
    .from(chatBlock)
    .where(eq(chatBlock.userId, userId));
  return rows.map((r) => r.blockedUserId);
}
