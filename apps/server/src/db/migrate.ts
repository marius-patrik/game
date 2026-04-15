import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "./client";
import { embeddedMigrations } from "./migrations-embedded";

const SOURCE_DIR = resolve(import.meta.dir, "../../drizzle");

async function materializeEmbeddedMigrations(): Promise<string> {
  const tmpRoot = join(process.env.TMPDIR ?? "/tmp", `game-drizzle-${process.pid}-${Date.now()}`);
  for (const [rel, embeddedPath] of Object.entries(embeddedMigrations)) {
    const outPath = join(tmpRoot, rel);
    mkdirSync(dirname(outPath), { recursive: true });
    const bytes = await Bun.file(embeddedPath).arrayBuffer();
    await Bun.write(outPath, bytes);
  }
  return tmpRoot;
}

export async function runMigrations(): Promise<void> {
  const journalOnDisk = await Bun.file(join(SOURCE_DIR, "meta/_journal.json")).exists();
  const folder = journalOnDisk ? SOURCE_DIR : await materializeEmbeddedMigrations();
  migrate(db, { migrationsFolder: folder });
}
