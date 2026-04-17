import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { getPlayerLocation, savePlayerLocation } from "./playerLocation";
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
      created_at INTEGER NOT NULL DEFAULT 0,
      last_played_at INTEGER NOT NULL DEFAULT 0,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    );
    CREATE TABLE player_location (
      character_id TEXT NOT NULL,
      zone_id TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      z REAL NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (character_id, zone_id),
      FOREIGN KEY (character_id) REFERENCES character(id) ON DELETE CASCADE
    );
    INSERT INTO user (id, name, email, createdAt, updatedAt) VALUES
      ('u1', 'alice', 'a@x', 0, 0),
      ('u2', 'bob',   'b@x', 0, 0);
    INSERT INTO character (id, user_id, name) VALUES
      ('c1', 'u1', 'hero'),
      ('c2', 'u2', 'adventurer');
  `);
  return drizzle(sqlite, { schema });
}

describe("playerLocation repo", () => {
  let db: ReturnType<typeof makeDb>;
  beforeEach(() => {
    db = makeDb();
  });

  test("returns undefined when no row exists", async () => {
    const row = await getPlayerLocation("c1", "lobby", db);
    expect(row).toBeUndefined();
  });

  test("save then get roundtrips the position", async () => {
    await savePlayerLocation("c1", "lobby", { x: 1.5, y: 0.5, z: -2 }, new Date(1000), db);
    const row = await getPlayerLocation("c1", "lobby", db);
    expect(row).toMatchObject({ characterId: "c1", zoneId: "lobby", x: 1.5, y: 0.5, z: -2 });
    expect(row?.updatedAt.getTime()).toBe(1000);
  });

  test("upsert updates existing row instead of inserting duplicate", async () => {
    await savePlayerLocation("c1", "lobby", { x: 1, y: 0, z: 0 }, new Date(1000), db);
    await savePlayerLocation("c1", "lobby", { x: 5, y: 0, z: 7 }, new Date(2000), db);
    const row = await getPlayerLocation("c1", "lobby", db);
    expect(row?.x).toBe(5);
    expect(row?.z).toBe(7);
    expect(row?.updatedAt.getTime()).toBe(2000);
  });

  test("per-(character, zone) isolation", async () => {
    await savePlayerLocation("c1", "lobby", { x: 1, y: 0, z: 0 }, new Date(1000), db);
    await savePlayerLocation("c1", "arena", { x: 2, y: 0, z: 0 }, new Date(1000), db);
    await savePlayerLocation("c2", "lobby", { x: 3, y: 0, z: 0 }, new Date(1000), db);

    expect((await getPlayerLocation("c1", "lobby", db))?.x).toBe(1);
    expect((await getPlayerLocation("c1", "arena", db))?.x).toBe(2);
    expect((await getPlayerLocation("c2", "lobby", db))?.x).toBe(3);
    expect(await getPlayerLocation("c2", "arena", db)).toBeUndefined();
  });

  test("cascade: deleting character removes their locations", async () => {
    await savePlayerLocation("c1", "lobby", { x: 1, y: 0, z: 0 }, new Date(1000), db);
    db.$client.exec("DELETE FROM character WHERE id = 'c1'");
    const row = await getPlayerLocation("c1", "lobby", db);
    expect(row).toBeUndefined();
  });
});
