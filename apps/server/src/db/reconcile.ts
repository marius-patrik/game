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
