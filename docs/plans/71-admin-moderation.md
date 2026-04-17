# Plan: #71 — Admin moderation tools (kick / mute / revoke)

**Status:** in-review
**Owner agent:** backend
**Branch:** `feat/admin-moderation`

## Context
`/admin/sessions` currently lists live players (#59) but has no actions. Alpha gameplay is stable enough that we need ops controls — kick a disruptive player, mute chat for 15 min, or revoke their auth session entirely so they have to re-login.

## Chosen approach
REST endpoints under `/admin/api/sessions/:sessionId/{kick,mute,revoke}`, gated to admin role. Server routes use `matchMaker.query({ name: "zone" })` + `matchMaker.remoteRoomCall(roomId, "_adminKick" | "_adminMute", [sessionId, ...])` to fan out into the right Colyseus room (same pattern as `_relayChat` in GameRoom for global chat). Mute state lives in a `Map<sessionId, { until: number }>` in the room; `handleChat` checks before rate-limit. Revoke deletes the better-auth session row via an SDK call or direct DB delete.

## File impact

**Server (`apps/server/src/`)**
- `index.ts` — **edit**: three new POST handlers under `/admin/api/sessions/:sessionId/`:
  - `kick` — calls `adminCommand(sessionId, "kick")` helper below.
  - `mute { durationMs?: number }` — defaults to 15 min (`900_000`); calls `adminCommand(sessionId, "mute", { durationMs })`.
  - `revoke` — deletes the better-auth session row by userId, then calls `adminCommand(sessionId, "kick")`.
  - All wrap the existing admin-role check used by the GET `/admin/api/sessions` route (look at existing code for the exact helper — likely a `requireAdmin(req, res)` guard).
- `adminCommands.ts` (new) — `adminCommand(sessionId: string, kind: "kick" | "mute", opts?: { durationMs?: number }): Promise<void>`:
  - `matchMaker.query({ name: "zone" })` → find the room whose clients include `sessionId`.
  - `matchMaker.remoteRoomCall(roomId, kind === "kick" ? "_adminKick" : "_adminMute", [sessionId, opts?.durationMs])`.
- `rooms/GameRoom.ts` — **edit**:
  - New field: `private muteUntil = new Map<string, number>();`.
  - `handleChat` — check `muteUntil`: if `Date.now() < untilTs`, `client.send("chat-error", { reason: "muted" })` and return before rate-limit. Add `"muted"` to the `ChatError["reason"]` union in `packages/shared/src/chat.ts`.
  - New `_adminKick(sessionId: string)`: find client; `client?.leave(4003);`.
  - New `_adminMute(sessionId: string, durationMs = 900_000)`: `this.muteUntil.set(sessionId, Date.now() + durationMs);`.
  - Cleanup: remove `muteUntil.delete(sessionId)` in `onLeave`.
- `auth.ts` or `adminCommands.ts` — helper `revokeUserSessions(userId: string): Promise<void>`:
  - Drizzle: `db.delete(sessions).where(eq(sessions.userId, userId))`.
  - better-auth table name likely `session` or `sessions` — verify in existing `apps/server/src/db/schema.ts` or better-auth config.

**Shared (`packages/shared/src/chat.ts`)** — **edit**: add `"muted"` to `ChatError["reason"]`.

**Client (`apps/client/src/admin/routes/Sessions.tsx`)** — **edit**:
- Row actions: three shadcn `Button size="sm" variant="destructive"` or `variant="outline"` buttons: Kick / Mute 15m / Revoke.
- Confirm dialog (shadcn `AlertDialog`) for each to prevent misclicks.
- Fetch via `fetch("/admin/api/sessions/" + sessionId + "/kick", { method: "POST" })`; success → `toast.success("Kicked")`; error → `toast.error(error.message)`.
- Re-fetch the session list after any action (use existing polling interval or manual trigger).

## Risks / unknowns
- `matchMaker.remoteRoomCall` signature: the `_relayChat` precedent (in GameRoom) confirms it works in 0.16 — reuse that exact shape.
- Better-auth session table name is the main unknown. Grep `packages/shared` and `apps/server/src/auth.ts` for it first, or look at `apps/server/src/db/schema.ts`.
- Race: what if the target kicks off a match mid-kick? `client?.leave()` is idempotent; if already gone, no-op.
- Audit log deferred — issue #71 scope is explicit about this, file follow-up if needed.

## Acceptance mapping (from issue #71)
1. ✅ Action buttons per row gated to admin — `requireAdmin` guard + role check on client.
2. ✅ `POST .../kick` disconnects — `_adminKick` handler.
3. ✅ `POST .../mute` rejects chat until expiry — `_adminMute` + `handleChat` mute check.
4. ✅ `POST .../revoke` deletes session + kicks — `revokeUserSessions` + `_adminKick`.
5. ✅ 403 for non-admin callers — route guard.
6. ✅ Biome + typecheck clean.

## Out of scope
- IP bans (needs IP tracking)
- Audit log (follow-up issue)
- Unmute-early button (just wait out the 15 min)

## Retro
_(filled after merge)_
