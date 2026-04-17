# Plan: #72 — Chat moderation (profanity, /block, DMs)

**Status:** in review (PR #80, CI green)
**Owner agent:** backend (execution — cuts across shared + server + a small client patch)
**Branch:** `feat/chat-moderation`

## Context
Chat landed in #49 (global + zone) and got persistence in #59. Moderation is the next obvious gap — disruptive language goes out unfiltered, there's no way to ignore a specific user, and there are no private messages.

## Chosen approach
Ship all three as one PR since they share `handleChat` and the command-parser. Profanity filter runs at ingest on the server (authority principle). Blocks persist in a new `chat_block` Drizzle table keyed by `(userId, blockedUserId)` pair. DMs reuse the global cross-zone pattern (`matchMaker.query` + `remoteRoomCall`) but target a specific session.

## File impact

**Shared (`packages/shared/src/`)**
- `chat.ts` — **edit**:
  - Add `"dm"` to `ChatChannel`.
  - Add `"muted" | "blocked"` to the `ChatError["reason"]` union (note: `"muted"` also added by #71; coordinate on rebase — whoever lands second merges cleanly).
  - New helper `parseChatCommand(text: string): { kind: "chat" | "whisper" | "block" | "unblock"; ... }`.
- `chat-profanity.ts` (new) — exported word list + `filterProfanity(text): string` replacing each match with `***`. Case-insensitive, word-boundary anchored. Start with a 20-ish word list (conservative — PG-13). Comment: "tune the list, don't add regex logic."
- `chat-profanity.test.ts` (new) — unit tests: mixed case, substring (should NOT match within words like "class"), word boundary, punctuation.

**Server (`apps/server/src/`)**
- `drizzle/0005_chat_block.sql` + `meta/_journal.json` + `meta/0005_snapshot.json` — **new**:
  ```sql
  CREATE TABLE chat_block (
    user_id TEXT NOT NULL,
    blocked_user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, blocked_user_id)
  );
  ```
  Update `_journal.json` to list `0005_chat_block` with tag pointing at the snapshot.
- `db/schema.ts` — **edit**: add `chatBlock` Drizzle table definition matching the sql above.
- `db/chatBlock.ts` (new):
  - `addBlock(userId, blockedUserId): Promise<void>`
  - `removeBlock(userId, blockedUserId): Promise<void>`
  - `isBlocked(userId, blockedUserId): Promise<boolean>`
  - `getBlockedBy(userId): Promise<string[]>` (list the people *userId* has blocked — used for outbound filter).
- `rooms/GameRoom.ts` — **edit** `handleChat`:
  1. Apply `filterProfanity()` to `text` before building the entry.
  2. Parse command with `parseChatCommand`. Dispatch:
     - `whisper { to, text }` — look up target session by name across all zone rooms (`matchMaker.query` → find room containing sessionId matching username → `remoteRoomCall("_deliverDm", [entry, recipientSessionId])`). Sender gets their own copy via `client.send("chat", entry)` so they see confirmation.
     - `block { target }` — call `addBlock(userId, targetUserId)`; send `chat-ok` with confirmation text.
     - `unblock { target }` — call `removeBlock`; confirm.
     - `chat` — existing path, plus filter outbound: before `this.broadcast`, iterate the room's clients; for each recipient, `isBlocked(recipient.userId, senderUserId)` → `client.send` individually instead of broadcast (slower path only when blocks exist; use `getBlockedBy` once per tick and cache per message).
     Actually simpler: broadcast as before, and handle outbound filter on each recipient by pre-computing the sender→blocker set. Move this to a helper if it gets tangled.
  3. New `_deliverDm(entry: ChatEntry, sessionId: string)` — sends the entry to a single client in this room.
- `rooms/GameRoom.ts` — Add the outbound block filter only for `zone` + `global` channels, not `dm`.

**Client (`apps/client/src/game/SidePanel.tsx`)** — **edit**:
- Render DMs with italicized `[dm from <name>]` or `[dm to <name>]` prefix.
- Add hint text under the input: `/w <name> <text>` / `/block <name>` / `/unblock <name>`.
- No new state — `chat-error` toast handles rejection.

**Shared migration embedding** — **run** `bun apps/server/scripts/generate-migrations.ts` to regenerate `migrations-embedded.ts`. (Execution agent should do this automatically after adding the sql + journal entry; the script output is checked in.)

## Risks / unknowns
- **Name collision on `/w <name>`** — names aren't unique. Fallback: match the first online player with that name; if none, `chat-error { reason: "not_found" }` (add this reason too).
- **Rebase on #71 admin mod** — both add `"muted"` to `ChatError["reason"]`. Whoever lands second rebases, dedupes the union.
- **Profanity list** — keep it tiny. This is alpha; tune with real usage. Don't ship regex-based fuzzy matching — trivially bypassed anyway, users will mod it out.
- **Block list scale** — per-user, not huge. No index needed at alpha scale beyond the primary key.

## Acceptance mapping
1. ✅ Filter → `filterProfanity` + test.
2. ✅ `/block` → `addBlock` + outbound filter in `handleChat`.
3. ✅ `/w` → `parseChatCommand` + `_deliverDm` cross-room.
4. ✅ `chat_block` migration → sql + journal + snapshot + `generate-migrations.ts` re-run.
5. ✅ Profanity unit tests pass.
6. ✅ Biome + typecheck clean.

## Out of scope
- Export / report-user flows.
- Fuzzy profanity matching.
- Per-zone ignore lists.

## Retro
- **Landed as PR #80**, CI green (check: pass in 21s). Merge pending overseer review.
- **What stayed faithful to plan:** `parseChatCommand`, `filterProfanity` + test (14 passes), `chat_block` migration 0005, `addBlock/removeBlock/isBlocked/getBlockedBy` db helpers, cross-room `_deliverDm`, per-recipient outbound filter, SidePanel DM rendering + hints.
- **Two small adjustments:** (1) `getBlockedBy` stayed in the db module but isn't consumed by GameRoom — `isBlocked(viewer, sender)` per recipient is simpler than pre-computing a blocker set and the query cost is trivial at alpha scale. (2) Self-block is silently ignored (no error reason) rather than surfacing `not_found` — matches most chat clients' behavior.
- **Block-filter policy:** blocked DMs are *silently dropped* for the recipient (block probing → no), whereas blocked zone/global messages are simply not delivered. No notification either way.
- **Sender echo:** `/w` sends the sender a copy of the `ChatEntry` with `to=<name>` so their SidePanel can show `[dm to <name>]`. Recipients see `[dm from <name>]`. This is how the client distinguishes direction without needing any extra round-trip.
- **Journal gap for 0003/0004:** those migrations were never registered in `_journal.json` — pre-existing issue, not in scope. Only 0005 registered to avoid breaking DBs that already ran 0003/0004 via `drizzle-kit push` or similar. Flagged below as a pitfall note.
