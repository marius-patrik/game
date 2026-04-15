import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { user } from "../db/schema";

const email = process.argv[2];
if (!email) {
  console.error("usage: bun run grant-admin <email>");
  process.exit(1);
}

const rows = await db
  .update(user)
  .set({ role: "admin", updatedAt: new Date() })
  .where(eq(user.email, email))
  .returning({ id: user.id, email: user.email, role: user.role });

const row = rows[0];
if (!row) {
  console.error(`no user with email ${email}`);
  process.exit(1);
}

console.log(`granted admin to ${row.email} (${row.id})`);
