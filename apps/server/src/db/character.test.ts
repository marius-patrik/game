import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";
import {
  createCharacter,
  listCharacters,
  loadCharacter,
  saveCharacter,
  softDeleteCharacter,
} from "./character";
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
    CREATE TABLE character (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#66c0f4',
      created_at INTEGER NOT NULL,
      last_played_at INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    );
    CREATE TABLE character_progress (
      character_id TEXT PRIMARY KEY NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      equipped_item_id TEXT NOT NULL DEFAULT '',
      gold INTEGER NOT NULL DEFAULT 0,
      mana INTEGER NOT NULL DEFAULT 50,
      max_mana INTEGER NOT NULL DEFAULT 50,
      strength INTEGER NOT NULL DEFAULT 5,
      dexterity INTEGER NOT NULL DEFAULT 5,
      vitality INTEGER NOT NULL DEFAULT 5,
      intellect INTEGER NOT NULL DEFAULT 5,
      stat_points INTEGER NOT NULL DEFAULT 0,
      equipment_json TEXT NOT NULL DEFAULT '{}',
      quests_json TEXT NOT NULL DEFAULT '{}',
      skill_cooldowns_json TEXT NOT NULL DEFAULT '{}',
      skills_equipped_json TEXT NOT NULL DEFAULT '[]',
      ultimate_skill TEXT NOT NULL DEFAULT '',
      skill_points INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (character_id) REFERENCES character(id) ON DELETE CASCADE
    );
    CREATE TABLE character_inventory (
      character_id TEXT NOT NULL,
      slot_index INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      qty INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (character_id, slot_index),
      FOREIGN KEY (character_id) REFERENCES character(id) ON DELETE CASCADE
    );
    INSERT INTO user (id, name, email, createdAt, updatedAt) VALUES
      ('u1', 'alice', 'a@x', 0, 0);
  `);
  return drizzle(sqlite, { schema });
}

describe("character repo", () => {
  let db: ReturnType<typeof makeDb>;
  beforeEach(() => {
    db = makeDb();
  });

  test("create and list characters", async () => {
    const c1 = await createCharacter({ userId: "u1", name: "Hero", color: "#ff0000" }, db);
    const c2 = await createCharacter({ userId: "u1", name: "Mage", color: "#0000ff" }, db);

    const list = await listCharacters("u1", db);
    expect(list).toHaveLength(2);
    expect(list.map((c) => c.name)).toContain("Hero");
    expect(list.map((c) => c.name)).toContain("Mage");
  });

  test("soft delete character", async () => {
    const c1 = await createCharacter({ userId: "u1", name: "Hero", color: "#ff0000" }, db);
    await softDeleteCharacter(c1.id, "u1", db);

    const list = await listCharacters("u1", db);
    expect(list).toHaveLength(0);

    const loaded = await loadCharacter(c1.id, db);
    expect(loaded.character).toBeUndefined();
  });

  test("save and load character", async () => {
    const c1 = await createCharacter({ userId: "u1", name: "Hero", color: "#ff0000" }, db);
    await saveCharacter(
      {
        characterId: c1.id,
        level: 5,
        xp: 100,
        equippedItemId: "sword_1",
        inventory: [{ itemId: "potion", qty: 5 }],
        now: new Date(1000),
      },
      db,
    );

    const loaded = await loadCharacter(c1.id, db);
    expect(loaded.character!.name).toBe("Hero");
    expect(loaded.progress!.level).toBe(5);
    expect(loaded.inventory).toHaveLength(1);
    expect(loaded.inventory[0]!.itemId).toBe("potion");
    expect(loaded.character!.lastPlayedAt.getTime()).toBe(1000);
  });
});
