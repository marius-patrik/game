# Plan: #81 — Reconcile missing drizzle migrations 0003 + 0004

**Status:** shipped
**Owner agent:** backend (aa04cdae — rate-limited mid-run; overseer finished ~20%)
**Branch:** `fix/reconcile-migrations`

## Context

Two drizzle migrations shipped in prior PRs (`0003_stats_extras.sql` from #55, `0004_cooldowns_chat.sql` from #59) but **neither was registered in `apps/server/drizzle/meta/_journal.json`**. Drizzle's `readMigrationFiles` only iterates the journal — unlisted SQL files are silently skipped.

Consequence: a fresh SQLite DB only applies 0000 + 0001 + 0002. It never gets the `gold / mana / max_mana / strength / dexterity / vitality / intellect / stat_points / equipment_json / quests_json` columns on `player_progress`, the `skill_cooldowns_json` column, nor the `chat_message` table. Existing dev DBs happen to have these columns because the maintainer migrated them via some informal path (manual SQL or a previous journal version).

Symptoms:
- `bun test apps/server/src/db/playerProgress.test.ts` → 3 failures: `SQLiteError: table player_progress has no column named gold`. The test hand-rolls its `CREATE TABLE` DDL with only the 0000+0002 column set, which is the direct cause of these specific failures.
- Any fresh `bun run dev:server` against a nuked `data/game.db` would hit the same error during first login.

## Options considered

1. **Naive journal patch** — append 0003 + 0004 to `_journal.json` as-is.
   - ✅ One-line fix. Fresh DBs work.
   - ❌ Existing dev DBs that already have the columns crash on next boot with `duplicate column name: gold`. The user explicitly called this out in the #81 body: "drizzle would then try to re-`CREATE TABLE chat_message` on already-populated DBs and crash."

2. **Single `0006_reconcile.sql` with `ADD COLUMN IF NOT EXISTS`** (issue's Option A).
   - ❌ **SQLite does not support `IF NOT EXISTS` on `ALTER TABLE ADD COLUMN`.** This option isn't viable as pure SQL.

3. **Regenerate the migration chain from scratch** (issue's Option B).
   - ✅ Clean history.
   - ❌ Breaks every existing dev DB. History-breaking. Overkill for the fix.

4. **Procedural TS reconciler (chosen)** — add a `reconcileSchema()` step in `migrate.ts` that runs **after** the drizzle migrator, reads `PRAGMA table_info(player_progress)` + `sqlite_master`, and conditionally executes each missing `ALTER TABLE ADD COLUMN` + `CREATE TABLE IF NOT EXISTS chat_message`. No new .sql migration is registered — the journal stays at 0000-0002 and drift is healed at runtime.
   - ✅ Truly idempotent on SQLite. Works for both fresh and drifted existing DBs.
   - ✅ No new journal entry → doesn't conflict with the pitfall warning.
   - ✅ Self-documenting: the TS helper spells out exactly which columns/tables it heals.
   - ⚠️ Slightly unusual — future migrations must go through drizzle-kit normally, reconciler is a one-shot patch. Leave a comment in the reconciler explaining why it exists and flag "delete once all environments have re-migrated cleanly" as a future cleanup.

## Chosen approach

**Option 4.** Procedural reconciler that runs after `migrate()`.

Also **fix the test** separately: update `playerProgress.test.ts` to hand-roll the *current* schema (all columns from 0000 → 0004). This is the direct cause of the 3 failing tests and is independent of the migration-journal issue. Alternative would be to run the real migrator against `:memory:` in the test, but that's a bigger change — defer. One-line-per-column update is the minimal fix.

## File impact

**New logic**
- `apps/server/src/db/reconcile.ts` — **new**. Exports `reconcileSchema(client: bun:sqlite Database)` that:
  1. `PRAGMA table_info(player_progress)` → set of existing column names.
  2. For each of `gold`, `mana`, `max_mana`, `strength`, `dexterity`, `vitality`, `intellect`, `stat_points`, `equipment_json`, `quests_json`, `skill_cooldowns_json`: if missing, `ALTER TABLE player_progress ADD COLUMN <col> <type> DEFAULT <default> NOT NULL;` (exact types/defaults from 0003 + 0004).
  3. `CREATE TABLE IF NOT EXISTS chat_message (…)` + `CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_message (created_at);`.
  4. Top-of-file comment: **why** this file exists, pointer to #81, note that it's a one-shot heal layer and new migrations should go through drizzle-kit.

**Wire-up**
- `apps/server/src/db/migrate.ts` — **edit**. After `migrate(db, { migrationsFolder: folder })`, call `reconcileSchema(db.$client)`. Add an import.

**Test fix**
- `apps/server/src/db/playerProgress.test.ts` — **edit**. Extend the inline `CREATE TABLE player_progress (…)` DDL with the 11 missing columns (matching the drizzle schema defaults). No other test-body changes needed — `saveProgress` / `loadProgress` already handle the new columns internally.

**No changes to**
- `apps/server/drizzle/meta/_journal.json` — stays at 0000-0002. This is the point.
- `apps/server/drizzle/0003_stats_extras.sql` / `0004_cooldowns_chat.sql` — leave on disk so git history is preserved but they remain un-registered. Reconciler covers the intent.
- `apps/server/scripts/generate-migrations.ts` — no change. It already re-embeds whatever's in the journal.
- `apps/server/src/static/embedded.ts` / `migrations-embedded.ts` — regenerate as part of `bun run build:release` only; not committed (stubbed).

## Risks / unknowns

- **Reconciler runs on every boot.** It's cheap (two PRAGMA reads + conditional DDL), but still worth keeping fast. No risk of data loss — ADD COLUMN with a DEFAULT is safe, and `CREATE TABLE IF NOT EXISTS` is idempotent.
- **Drizzle schema.ts already includes all columns** (confirmed — [apps/server/src/db/schema.ts](../../apps/server/src/db/schema.ts:71-99) has `gold` through `skillCooldownsJson`, plus `chatMessage` at L92-99). So after reconciliation, drizzle queries match the DB.
- **What if drizzle-kit is later re-run to generate 0005?** It would snapshot from the (now-complete) live DB and produce a diff against `0002_snapshot.json`, which would include all of 0003+0004's contents as one big migration. Fresh DBs boot from 0000-0002-then-0005 would work; but existing DBs (post-reconciler) would hit the same "duplicate column" error that #81 warned about. **Mitigation:** add a short note at the top of `reconcile.ts` and in `migrate.ts` pointing to #81 so the next generator sees the land-mine. Don't try to pre-emptively fix this — it's a known soft invariant.
- **Unused .sql files on disk.** 0003 + 0004 remain in `apps/server/drizzle/` but aren't used by the migrator. That's fine — they document what the reconciler heals. Consider deleting them in a follow-up after a few months of stable boots.

## Acceptance mapping (from #81)

1. ✅ `bun test apps/server/src/db/playerProgress.test.ts` passes (3 previously-failing tests) — fixed by the test-schema update.
2. ✅ `bun apps/server/scripts/generate-migrations.ts` re-embeds the chain — unchanged; journal still at 0000-0002 so the embed is consistent.
3. ✅ `bun run build:release` produces a binary that boots against a fresh DB and a legacy DB without SQL errors — reconciler covers both cases.
4. ✅ Biome + typecheck clean.

## Verification checklist for the agent

1. `cd apps/server && bun test src/db/playerProgress.test.ts` → 4 pass / 0 fail.
2. Fresh-DB smoke: `rm -f data/game.db* && bun run dev:server` → boots, `/health` responds, schema has all 15 `player_progress` columns + `chat_message` table.
   - Verify via: `sqlite3 data/game.db ".schema player_progress"` and `.schema chat_message` (or use `PRAGMA table_info` via a one-off script if sqlite3 isn't available in dev).
3. "Legacy" DB smoke: any pre-existing `data/game.db` from before this fix boots without `duplicate column` errors. If no such DB exists, simulate by applying 0000-0002 only, then manually running 0003 + 0004 SQL, then running the server (reconciler should no-op).
4. Build smoke: `bun run build:release` succeeds and the resulting `dist/game-server` boots against a fresh `data/` dir.
5. `bun run check` + `bun run typecheck` clean.

## Out of scope

- Deleting the orphaned `0003_stats_extras.sql` / `0004_cooldowns_chat.sql` files — keep them for traceability.
- Refactoring tests to use the real migration runner — defer; the per-column list in the test is small and matches the schema.
- Drizzle-kit re-snapshot — not needed now; if done later, follow the mitigation noted in Risks.

## Retro

**Shipped as planned.** Procedural `reconcileSchema()` in `apps/server/src/db/reconcile.ts` runs after `migrate()`, PRAGMA-checks `player_progress`, and ALTERs in missing columns; `CREATE TABLE IF NOT EXISTS chat_message` idempotently creates the chat table. Test fix was the one-line-per-column extension as planned — no rewrite to the real migrator needed.

**Diverged from plan:**
- Agent hit the Anthropic account rate limit before committing. Files were uncommitted in the agent worktree (`.claude/worktrees/agent-aa04cdae`). Overseer finished from seat: dropped a scratch `scripts/smoke-reconcile.ts` the agent had written for manual verification (not in the plan's file impact; biome flagged it for formatting; its idempotency coverage is subsumed by a test we ran ephemerally and by the reconciler's own design), added a `_fresh-smoke.test.ts` one-shot to prove `migrate() + reconcileSchema()` against a real fresh DB (4/0 pass including idempotency assertion), deleted it after running. Committed the three production files only.
- Idempotency verified two ways: (a) second `reconcileSchema()` call leaves column count unchanged, (b) running against a "legacy" DB that already has the columns is a no-op (no DDL emitted, no errors).

**Lessons for pitfalls.md:** the existing "rate-limited agent recovery" entry already documents this pattern; this run confirms ~20% was left by the agent, with a truncated final tool call as the only surface signal (no explicit rate-limit message). Worth noting that a truncated result string mid-sentence ("Let me write a file-based smoke test:") is a tell.

**Follow-ups:** after all environments have booted against the reconciler at least once, the 11-column helper in `reconcile.ts` + the orphaned `0003_stats_extras.sql` / `0004_cooldowns_chat.sql` files can be deleted in a cleanup PR. Not now.
