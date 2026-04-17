import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { reconcileSchema } from "./reconcile";

describe("reconcileSchema backfill", () => {
  test("backfills characters from legacy player_progress", () => {
    const sqlite = new Database(":memory:");
    sqlite.exec("PRAGMA foreign_keys = ON;");

    // 1. Setup legacy schema
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
      CREATE TABLE player_location (
        user_id TEXT NOT NULL,
        zone_id TEXT NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        z REAL NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, zone_id),
        FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
      );
    `);

    // 2. Insert legacy data
    sqlite.exec(`
      INSERT INTO user (id, name, email, createdAt, updatedAt) VALUES ('u1', 'alice', 'a@x', 0, 0);
      INSERT INTO player_progress (user_id, level, xp, gold, updated_at) VALUES ('u1', 5, 100, 50, 1000);
      INSERT INTO player_inventory (user_id, slot_index, item_id, qty, updated_at) VALUES ('u1', 0, 'potion', 3, 1000);
      INSERT INTO player_location (user_id, zone_id, x, y, z, updated_at) VALUES ('u1', 'lobby', 10, 20, 30, 1000);
    `);

    // 3. Run reconciler
    reconcileSchema(sqlite);

    // 4. Verify character created
    const char = sqlite.query("SELECT * FROM character WHERE user_id = 'u1'").get() as {
      id: string;
      name: string;
    };
    expect(char).toBeDefined();
    expect(char.name).toBe("Adventurer");
    expect(char.id).toStartWith("c_");

    // 5. Verify character_progress created
    const progress = sqlite
      .query("SELECT * FROM character_progress WHERE character_id = ?")
      .get(char.id) as { level: number; xp: number; gold: number };
    expect(progress).toBeDefined();
    expect(progress!.level).toBe(5);
    expect(progress!.xp).toBe(100);
    expect(progress!.gold).toBe(50);

    // 6. Verify character_inventory created
    const inventory = sqlite
      .query("SELECT * FROM character_inventory WHERE character_id = ?")
      .all(char.id) as { item_id: string; qty: number }[];
    expect(inventory).toHaveLength(1);
    expect(inventory[0]!.item_id).toBe("potion");
    expect(inventory[0]!.qty).toBe(3);

    // 7. Verify player_location migrated
    const location = sqlite
      .query("SELECT * FROM player_location WHERE character_id = ?")
      .get(char.id) as { zone_id: string; x: number };
    expect(location).toBeDefined();
    expect(location!.zone_id).toBe("lobby");
    expect(location!.x).toBe(10);

    // 8. Verify legacy table renamed
    const tables = sqlite.query("SELECT name FROM sqlite_master WHERE type='table'").all() as {
      name: string;
    }[];
    expect(tables.map((t) => t.name)).toContain("legacy_player_location");
  });
});
