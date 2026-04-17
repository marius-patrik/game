// One-shot schema heal for #81. Migrations 0003_stats_extras.sql and
// 0004_cooldowns_chat.sql were never registered in meta/_journal.json, so fresh
// SQLite DBs only ever applied 0000-0002 + 0005. SQLite has no
// `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so a plain replay-migration would
// crash existing dev DBs that were healed by hand. This reconciler runs after
// drizzle's migrator and idempotently adds any missing columns/tables.
// New migrations still go through drizzle-kit normally; delete this file once
// every environment has booted against it at least once.

import type { Database } from "bun:sqlite";

type ColumnSpec = {
  readonly name: string;
  readonly ddl: string;
};

const PLAYER_PROGRESS_COLUMNS: readonly ColumnSpec[] = [
  { name: "gold", ddl: "integer DEFAULT 0 NOT NULL" },
  { name: "mana", ddl: "integer DEFAULT 50 NOT NULL" },
  { name: "max_mana", ddl: "integer DEFAULT 50 NOT NULL" },
  { name: "strength", ddl: "integer DEFAULT 5 NOT NULL" },
  { name: "dexterity", ddl: "integer DEFAULT 5 NOT NULL" },
  { name: "vitality", ddl: "integer DEFAULT 5 NOT NULL" },
  { name: "intellect", ddl: "integer DEFAULT 5 NOT NULL" },
  { name: "stat_points", ddl: "integer DEFAULT 0 NOT NULL" },
  { name: "equipment_json", ddl: "text DEFAULT '{}' NOT NULL" },
  { name: "quests_json", ddl: "text DEFAULT '{}' NOT NULL" },
  { name: "skill_cooldowns_json", ddl: "text DEFAULT '{}' NOT NULL" },
];

function existingColumns(client: Database, table: string): Set<string> {
  const rows = client.query<{ name: string }, []>(`PRAGMA table_info(${table})`).all();
  return new Set(rows.map((r) => r.name));
}

export function reconcileSchema(client: Database): void {
  const present = existingColumns(client, "player_progress");
  for (const col of PLAYER_PROGRESS_COLUMNS) {
    if (present.has(col.name)) continue;
    client.exec(`ALTER TABLE player_progress ADD COLUMN ${col.name} ${col.ddl}`);
  }

  // Create character system tables
  client.exec(`
    CREATE TABLE IF NOT EXISTS character (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#66c0f4',
      created_at INTEGER NOT NULL,
      last_played_at INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    );
  `);
  client.exec("CREATE INDEX IF NOT EXISTS idx_character_user ON character (user_id);");

  client.exec(`
    CREATE TABLE IF NOT EXISTS character_progress (
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
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (character_id) REFERENCES character(id) ON DELETE CASCADE
    );
  `);

  client.exec(`
    CREATE TABLE IF NOT EXISTS character_inventory (
      character_id TEXT NOT NULL,
      slot_index INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      qty INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (character_id, slot_index),
      FOREIGN KEY (character_id) REFERENCES character(id) ON DELETE CASCADE
    );
  `);

  client.exec(`
    CREATE TABLE IF NOT EXISTS character_daily_progress (
      character_id TEXT NOT NULL,
      date TEXT NOT NULL,
      quest_id TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER,
      PRIMARY KEY (character_id, date, quest_id),
      FOREIGN KEY (character_id) REFERENCES character(id) ON DELETE CASCADE
    );
  `);

  // Handle player_location transition from user_id to character_id
  const locationColumns = existingColumns(client, "player_location");
  if (locationColumns.has("user_id") && !locationColumns.has("character_id")) {
    client.exec("ALTER TABLE player_location RENAME TO legacy_player_location;");
  }

  client.exec(`
    CREATE TABLE IF NOT EXISTS player_location (
      character_id TEXT NOT NULL,
      zone_id TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      z REAL NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (character_id, zone_id),
      FOREIGN KEY (character_id) REFERENCES character(id) ON DELETE CASCADE
    );
  `);

  // Backfill: migrate legacy user-based progress to characters
  // Only backfill for users who have player_progress but NO character yet.
  const legacyUsers = client
    .query<{ userId: string }, []>(`
    SELECT user_id as userId FROM player_progress 
    WHERE user_id NOT IN (SELECT user_id FROM character WHERE is_deleted = 0)
  `)
    .all();

  if (legacyUsers.length > 0) {
    const now = Date.now();
    for (const { userId } of legacyUsers) {
      const charId = `c_${crypto.randomUUID().replace(/-/g, "").substring(0, 16)}`;
      const name = "Adventurer";

      // Simple stable color from userId
      let hash = 0;
      for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
      }
      const color = `#${((hash & 0x00ffffff) | 0x444444).toString(16).padEnd(6, "0").substring(0, 6)}`;

      // 1. Create character
      client.exec(
        "INSERT INTO character (id, user_id, name, color, created_at, last_played_at) VALUES (?, ?, ?, ?, ?, ?)",
        [charId, userId, name, color, now, now],
      );

      // 2. Copy progress
      client.exec(
        `
        INSERT INTO character_progress (
          character_id, level, xp, equipped_item_id, gold, mana, max_mana, 
          strength, dexterity, vitality, intellect, stat_points, 
          equipment_json, quests_json, skill_cooldowns_json, updated_at
        )
        SELECT ?, level, xp, equipped_item_id, gold, mana, max_mana,
               strength, dexterity, vitality, intellect, stat_points,
               equipment_json, quests_json, skill_cooldowns_json, updated_at
        FROM player_progress WHERE user_id = ?
      `,
        [charId, userId],
      );

      // 3. Copy inventory
      client.exec(
        `
        INSERT INTO character_inventory (character_id, slot_index, item_id, qty, updated_at)
        SELECT ?, slot_index, item_id, qty, updated_at
        FROM player_inventory WHERE user_id = ?
      `,
        [charId, userId],
      );

      // 4. Copy location (from legacy table if it exists)
      const hasLegacyLocation = existingColumns(client, "legacy_player_location").size > 0;
      if (hasLegacyLocation) {
        client.exec(
          `
          INSERT INTO player_location (character_id, zone_id, x, y, z, updated_at)
          SELECT ?, zone_id, x, y, z, updated_at
          FROM legacy_player_location WHERE user_id = ?
        `,
          [charId, userId],
        );
      }
    }
  }

  client.exec(`
    CREATE TABLE IF NOT EXISTS chat_message (
      id text PRIMARY KEY NOT NULL,
      channel text NOT NULL,
      from_user_id text NOT NULL,
      from_name text NOT NULL,
      text text NOT NULL,
      created_at integer NOT NULL
    );
  `);
  client.exec("CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_message (created_at);");
}
