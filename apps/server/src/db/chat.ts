import { desc } from "drizzle-orm";
import { db as defaultDb } from "./client";
import { chatMessage } from "./schema";

type DB = typeof defaultDb;

export type StoredChatMessage = {
  id: string;
  channel: string;
  fromUserId: string;
  fromName: string;
  text: string;
  createdAt: Date;
};

const MAX_HISTORY = 200;
const LOAD_LIMIT = 40;

export async function insertChat(
  msg: {
    id: string;
    channel: string;
    fromUserId: string;
    fromName: string;
    text: string;
    now?: Date;
  },
  db: DB = defaultDb,
): Promise<void> {
  const now = msg.now ?? new Date();
  await db.insert(chatMessage).values({
    id: msg.id,
    channel: msg.channel,
    fromUserId: msg.fromUserId,
    fromName: msg.fromName,
    text: msg.text,
    createdAt: now,
  });
  // Keep the history bounded — prune all but the most recent MAX_HISTORY rows.
  // Sqlite doesn't have LIMIT on DELETE directly, so pull the cutoff row's
  // createdAt and delete everything older than it.
  const cutoff = await db
    .select({ createdAt: chatMessage.createdAt })
    .from(chatMessage)
    .orderBy(desc(chatMessage.createdAt))
    .limit(1)
    .offset(MAX_HISTORY);
  if (cutoff[0]) {
    const ts = cutoff[0].createdAt.getTime();
    const { sql } = await import("drizzle-orm");
    await db.run(sql`DELETE FROM chat_message WHERE created_at < ${ts}`);
  }
}

export async function loadRecentChat(db: DB = defaultDb): Promise<StoredChatMessage[]> {
  const rows = await db
    .select()
    .from(chatMessage)
    .orderBy(desc(chatMessage.createdAt))
    .limit(LOAD_LIMIT);
  rows.reverse();
  return rows;
}
