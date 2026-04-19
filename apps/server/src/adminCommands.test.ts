import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { isCharacterConnected, revokeUserSessions } from "./adminCommands";
import * as schema from "./db/schema";

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
    CREATE TABLE session (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expiresAt INTEGER NOT NULL,
      ipAddress TEXT,
      userAgent TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
    );
    INSERT INTO user (id, name, email, createdAt, updatedAt) VALUES
      ('u1', 'alice', 'a@x', 0, 0),
      ('u2', 'bob', 'b@x', 0, 0);
    INSERT INTO session (id, userId, token, expiresAt, createdAt, updatedAt) VALUES
      ('s1', 'u1', 't1', 9999999999, 0, 0),
      ('s2', 'u1', 't2', 9999999999, 0, 0),
      ('s3', 'u2', 't3', 9999999999, 0, 0);
  `);
  return drizzle(sqlite, { schema });
}

describe("revokeUserSessions", () => {
  test("deletes only sessions for the given userId", async () => {
    const db = makeDb();
    const removed = await revokeUserSessions("u1", db);
    expect(removed).toBe(2);
    const remaining = db.$client.query("SELECT id, userId FROM session").all() as Array<{
      id: string;
      userId: string;
    }>;
    expect(remaining).toEqual([{ id: "s3", userId: "u2" }]);
  });

  test("returns 0 when no sessions exist for the user", async () => {
    const db = makeDb();
    const removed = await revokeUserSessions("ghost", db);
    expect(removed).toBe(0);
    const remaining = db.$client.query("SELECT id FROM session").all();
    expect(remaining).toHaveLength(3);
  });
});

describe("isCharacterConnected", () => {
  test("returns true when any live zone has the character active", async () => {
    const calls: string[] = [];
    const connected = await isCharacterConnected("c_live", {
      async query(filter) {
        expect(filter).toEqual({ name: "zone" });
        return [{ roomId: "room-a" }, { roomId: "room-b" }];
      },
      async remoteRoomCall(roomId, method, args) {
        calls.push(roomId);
        expect(method).toBe("_hasCharacter");
        expect(args).toEqual(["c_live"]);
        return roomId === "room-b";
      },
    });

    expect(connected).toBe(true);
    expect(calls).toEqual(["room-a", "room-b"]);
  });

  test("returns false when no live zone has the character active", async () => {
    const connected = await isCharacterConnected("c_offline", {
      async query() {
        return [{ roomId: "room-a" }];
      },
      async remoteRoomCall(roomId, method, args) {
        expect(roomId).toBe("room-a");
        expect(method).toBe("_hasCharacter");
        expect(args).toEqual(["c_offline"]);
        return false;
      },
    });

    expect(connected).toBe(false);
  });
});
