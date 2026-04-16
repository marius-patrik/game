import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { loadProgress, saveProgress } from "./playerProgress";
import * as schema from "./schema";

function makeDb() {
  const sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec(`
    CREATE TABLE user (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      emailVerified INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      role TEXT NOT NULL DEFAULT 'player',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE player_progress (
      user_id TEXT PRIMARY KEY,
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      equipped_item_id TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    );
    CREATE TABLE player_inventory (
      user_id TEXT NOT NULL,
      slot_index INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      qty INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, slot_index),
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    );
    INSERT INTO user (id, name, email, createdAt, updatedAt) VALUES
      ('u1', 'alice', 'a@x', 0, 0);
  `);
  return drizzle(sqlite, { schema });
}

describe("playerProgress repo", () => {
  let db: ReturnType<typeof makeDb>;
  beforeEach(() => {
    db = makeDb();
  });

  test("loadProgress returns empty when fresh user", async () => {
    const { progress, inventory } = await loadProgress("u1", db);
    expect(progress).toBeUndefined();
    expect(inventory).toEqual([]);
  });

  test("save then load roundtrip", async () => {
    await saveProgress(
      {
        userId: "u1",
        level: 3,
        xp: 40,
        equippedItemId: "sword",
        inventory: [
          { itemId: "heal_potion", qty: 2 },
          { itemId: "sword", qty: 1 },
        ],
        now: new Date(1000),
      },
      db,
    );
    const { progress, inventory } = await loadProgress("u1", db);
    expect(progress).toMatchObject({
      level: 3,
      xp: 40,
      equippedItemId: "sword",
    });
    expect(progress?.updatedAt.getTime()).toBe(1000);
    expect(inventory).toEqual([
      { slotIndex: 0, itemId: "heal_potion", qty: 2 },
      { slotIndex: 1, itemId: "sword", qty: 1 },
    ]);
  });

  test("save replaces existing inventory fully", async () => {
    await saveProgress(
      {
        userId: "u1",
        level: 1,
        xp: 0,
        equippedItemId: "",
        inventory: [
          { itemId: "a", qty: 1 },
          { itemId: "b", qty: 1 },
        ],
        now: new Date(1000),
      },
      db,
    );
    await saveProgress(
      {
        userId: "u1",
        level: 2,
        xp: 10,
        equippedItemId: "a",
        inventory: [{ itemId: "c", qty: 1 }],
        now: new Date(2000),
      },
      db,
    );
    const { progress, inventory } = await loadProgress("u1", db);
    expect(progress?.level).toBe(2);
    expect(progress?.equippedItemId).toBe("a");
    expect(inventory).toEqual([{ slotIndex: 0, itemId: "c", qty: 1 }]);
  });

  test("cascade delete removes inventory + progress", async () => {
    await saveProgress(
      {
        userId: "u1",
        level: 2,
        xp: 5,
        equippedItemId: "",
        inventory: [{ itemId: "a", qty: 1 }],
        now: new Date(1000),
      },
      db,
    );
    db.$client.exec("DELETE FROM user WHERE id = 'u1'");
    const { progress, inventory } = await loadProgress("u1", db);
    expect(progress).toBeUndefined();
    expect(inventory).toEqual([]);
  });
});
