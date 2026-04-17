# Plan: #96 — Character system (customizer + persistence + multi-character)

**Status:** draft
**Owner agent:** execution (generalist — cuts shared + server + client + DB)
**Branch:** `feat/character-system`

## Context

Users currently have one implicit character tied to their account. The ask is:
1. **Multi-character per account** — explicit character list, create/delete/switch.
2. **Customizer** — at least a name + color (with room to expand).
3. **Persistence through updates** — schema changes must migrate existing users' single-character state into the new shape without data loss.

This PR is the schema foundation. Everything downstream (#93 HUD, #97 equipment, #98 skills, #101 quests) keys on the `characterId` introduced here.

## Options considered

1. **Re-key `player_progress.user_id` → `character_id`** in place (via table-rename). One table, conceptually simple.
   - ❌ SQLite forces a full table recreation for PK changes. High risk of subtle data loss on migration if something goes sideways. Hard to rollback.
2. **New `character` + `character_progress` + `character_inventory` tables alongside the old ones** — old tables stay untouched; all new queries key on character. Reconciler backfills.
   - ✅ Additive. Zero risk to existing data.
   - ✅ Old tables remain as implicit backup for one release.
   - ⚠️ Schema doubles in size until cleanup.
3. **Single `player_progress` table gets a new `character_id` column** — composite key `(user_id, character_id)`. Backward-compatible if a legacy `user_id` row without `character_id` means "default character".
   - ⚠️ Ambiguous queries during the transition window.

## Chosen approach

**Option 2.** Additive new tables; reconciler backfills from the legacy ones.

### New schema

```sql
CREATE TABLE character (
  id TEXT PRIMARY KEY NOT NULL,                -- uuid-like, e.g. "c_<nanoid>"
  user_id TEXT NOT NULL,                       -- owning account
  name TEXT NOT NULL,                          -- user-chosen, 3-24 chars, trimmed
  color TEXT NOT NULL DEFAULT '#66c0f4',       -- hex, matches customizer
  created_at INTEGER NOT NULL,
  last_played_at INTEGER NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,       -- soft-delete
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);
CREATE INDEX idx_character_user ON character (user_id);

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
```

### Reconciler (apps/server/src/db/reconcile.ts)

After `migrate()`:
1. `CREATE TABLE IF NOT EXISTS character | character_progress | character_inventory` + their indexes.
2. Backfill: for each row in the legacy `player_progress` that has no matching `character` row under the same user: create a `character` with `name = "Adventurer"` + a stable color derived from `user_id` hash; insert into `character_progress` with the legacy row's values; move any `player_inventory` rows under the same `user_id` into `character_inventory` keyed by the new `character.id`.
3. Idempotent: re-running the reconciler sees the character rows and skips backfill.

The legacy `player_progress` / `player_inventory` rows are **not deleted** here — they remain for one release cycle as implicit backup. A follow-up PR deletes them after we're confident.

### Shared schema

- `Player.characterId: string` (on Colyseus schema) — populated at room join.
- `Player.name: string` already exists — swap source: now comes from `character.name` rather than `user.name`.
- `Player.customizationColor: string` — if #92 landed it, re-use; else add here.

### Server

- `GameRoom.onJoin(client, options)` reads `options.characterId` (string) — must be non-empty + owned by the authenticated user.
- `loadProgress` / `saveProgress` migrate to the new tables — still accept a key arg, but now it's `characterId`, not `userId`. Rename to `loadCharacter` / `saveCharacter`.
- NPC / mob logic already keys on Colyseus session id, so no change there.
- New REST endpoints (authenticated):
  - `GET /api/characters` → list of `{ id, name, color, level, lastPlayedAt }` for the current user.
  - `POST /api/characters` → `{ name, color }` → create. Reject dup names per-user. Return the new character.
  - `DELETE /api/characters/:id` → soft-delete (`is_deleted = 1`). User must own it. Can't delete if currently in-game.

### Client

- New route `/characters` (wouter). Card list + "Create" button + per-card "Play" + "Delete".
- New `/characters/new` (modal or inline step): customizer — name input (validated) + color swatch picker (fixed palette of ~8 colors for now, easily extensible). Cube preview.
- The router: if authenticated and has no character, redirect to `/characters/new`. If authenticated and has ≥1 character, redirect to `/characters` (unless a characterId is in the URL query — then enter game directly).
- `useRoom` receives the selected `characterId` + passes it in Colyseus `joinOrCreate("zone", { characterId })`.
- Scene: the player cube renders using `Player.customizationColor` from the schema. The per-zone random color is removed (fix already landed in #92; confirm + keep clean).

## File impact

**New**
- `apps/server/src/db/schema.ts` — add `character`, `characterProgress`, `characterInventory` table defs.
- `apps/server/src/db/reconcile.ts` — extend with the three CREATE-IF-NOT-EXISTS + the backfill block.
- `apps/server/src/db/character.ts` — CRUD helpers (`createCharacter`, `listCharacters`, `softDeleteCharacter`, `loadCharacter`, `saveCharacter`).
- `apps/server/src/api/characters.ts` — REST handlers.
- `apps/client/src/routes/CharacterSelect.tsx` — list page.
- `apps/client/src/routes/CharacterNew.tsx` — customizer.
- `apps/client/src/lib/charactersApi.ts` — REST client.

**Edit**
- `packages/shared/src/schema.ts` — `Player.characterId: string` + `Player.customizationColor: string` (if not already from #92).
- `apps/server/src/rooms/GameRoom.ts` — onJoin accepts + validates characterId; load/save calls update.
- `apps/server/src/index.ts` — mount the new REST router.
- `apps/client/src/net/useRoom.ts` — pass characterId to join.
- `apps/client/src/app.tsx` (router) — redirect logic.
- `apps/client/src/game/Players.tsx` — consume `customizationColor` from schema.

**Tests (new)**
- `apps/server/src/db/character.test.ts` — CRUD + ownership.
- `apps/server/src/api/characters.test.ts` — REST handler happy path + unauthorized + non-owner.
- Reconciler backfill test — set up a legacy `player_progress` row, run the reconciler, assert a `character` + `character_progress` row exist with matching values.

## Verify

1. Fresh signup → redirected to `/characters/new` → customizer → create → redirected to `/characters` → one card → Play → enter game.
2. Reload mid-game → re-login → `/characters` → Play same → name + color + level/xp/inventory intact.
3. Existing user (legacy DB with `player_progress` row, no `character` row) → login → reconciler auto-creates "Adventurer" with their progress → card appears → Play → everything intact.
4. Create a second character → two cards → Switch between → each retains its own state.
5. Delete a character → card disappears → their progress is not accessible → re-login still works.
6. Multiplayer: two users each pick different characters → names + colors render correctly to each other.
7. `bun run check` + `bun run typecheck` + full suite + new tests clean.
8. Mobile: character-select list renders vertically, no horizontal scroll, customizer fits 390×844.

## Risks

- **Reconciler race at first boot**: if multiple users log in simultaneously on first deploy with legacy data, the backfill could attempt duplicate inserts. Mitigate with `INSERT OR IGNORE` patterns + per-user-lock in the reconciler.
- **Nanoid dep**: we don't currently use nanoid. `Bun.randomUUIDv7()` exists since Bun 1.1, use that — avoids a new dep.
- **Character name uniqueness**: per-user only (not globally). Stricter rules can come later.
- **In-game character-switch UX**: out of scope — switching requires returning to `/characters`. Good enough for v1.

## Out of scope

- Character deletion undelete / trash.
- Global character name uniqueness.
- Character appearance beyond name + color (body shape, helm visibility, etc.).
- In-game character switcher (must return to `/characters`).
- Friend lists / profiles beyond character.

## Retro
_(filled after merge)_
