import { resolve } from "node:path";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "./client";

export function runMigrations() {
  migrate(db, { migrationsFolder: resolve(import.meta.dir, "../../drizzle") });
}
