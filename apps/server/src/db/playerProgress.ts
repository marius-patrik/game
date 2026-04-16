import { eq } from "drizzle-orm";
import { db as defaultDb } from "./client";
import { playerInventory, playerProgress } from "./schema";

type DB = typeof defaultDb;

export type ProgressRow = {
  userId: string;
  level: number;
  xp: number;
  equippedItemId: string;
  updatedAt: Date;
};

export type InventoryRow = { slotIndex: number; itemId: string; qty: number };

export type LoadedProgress = {
  progress: ProgressRow | undefined;
  inventory: InventoryRow[];
};

export async function loadProgress(userId: string, db: DB = defaultDb): Promise<LoadedProgress> {
  const progressRows = await db
    .select()
    .from(playerProgress)
    .where(eq(playerProgress.userId, userId))
    .limit(1);
  const invRows = await db
    .select({
      slotIndex: playerInventory.slotIndex,
      itemId: playerInventory.itemId,
      qty: playerInventory.qty,
    })
    .from(playerInventory)
    .where(eq(playerInventory.userId, userId));
  invRows.sort((a, b) => a.slotIndex - b.slotIndex);
  return { progress: progressRows[0], inventory: invRows };
}

export type SaveProgressInput = {
  userId: string;
  level: number;
  xp: number;
  equippedItemId: string;
  inventory: readonly { itemId: string; qty: number }[];
  now?: Date;
};

export async function saveProgress(input: SaveProgressInput, db: DB = defaultDb): Promise<void> {
  const now = input.now ?? new Date();
  await db
    .insert(playerProgress)
    .values({
      userId: input.userId,
      level: input.level,
      xp: input.xp,
      equippedItemId: input.equippedItemId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: playerProgress.userId,
      set: {
        level: input.level,
        xp: input.xp,
        equippedItemId: input.equippedItemId,
        updatedAt: now,
      },
    });

  await db.delete(playerInventory).where(eq(playerInventory.userId, input.userId));
  if (input.inventory.length > 0) {
    await db.insert(playerInventory).values(
      input.inventory.map((slot, slotIndex) => ({
        userId: input.userId,
        slotIndex,
        itemId: slot.itemId,
        qty: slot.qty,
        updatedAt: now,
      })),
    );
  }
}
