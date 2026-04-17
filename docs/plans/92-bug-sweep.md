# Plan: #92 — Bug sweep (persistence, toasts, dark mode, viewport, NPCs, disconnects)

**Status:** draft
**Owner agent:** execution (generalist — cuts client + server)
**Branch:** `fix/bug-sweep`

## Context

User-directed batch of fixes triggered 2026-04-17. Ten distinct bugs across persistence, UX, visuals, and NPC behavior. No feature work — restore broken existing behavior.

## Approach

Single sweep PR, but each bug gets its own commit inside the branch so we can bisect if regressions emerge. Order of attack (cheapest first, riskiest last):

1. **Toasts + visible bugs first** (level-up banner not dismissing; "talk to Mercer" leaking onto drops; widget deletions) — pure client, no schema, fast feedback.
2. **Graphics isolation** (dark mode class leaking into Canvas) — scope + fix inside Scene.tsx / Canvas wrapper. Add a `data-theme="game"` anchor that pins lighting.
3. **Viewport responsiveness** — grep for `min-width` / hard pixel widths. Likely in `index.html` viewport meta or a CSS file. Add proper `100dvh` / `min-width: 0` fixes where needed.
4. **NPC positioning** (Elder Cubius + Mercer inside stands) — pure data fix in NPC spawn coordinates. Rendering engine already handles it.
5. **Elder Cubius interact broken** — debug the interact handler + NPC registration. Likely a missing entry in the interaction registry or a kind mismatch.
6. **Lobby safe zone** — audit `ZONE_SPAWN_MIX` + any mob leak across zone boundaries. Confirm no hostile mobs spawn in lobby.
7. **Cube color persistence** — currently regenerates per zone. Add `customizationColor: string` to `Player` Colyseus schema + `color` column to `player_progress`. Color derived from a stable hash of `characterId` until the character system (#96) lands proper customization — then migrate.
8. **Progress persistence** (biggest) — trace the save path. `GameRoom.onLeave` should call `saveProgress(character)`. If it's not firing for all exit paths, add. Test: kill server mid-session, restart, log back in — progress should be intact.
9. **Disconnect + zone-swap diagnostics** — add structured pino logs at: portal detect, Colyseus room close, client socket error, client reconnect attempt. Don't "fix" the disconnects blind — land the logs first, reproduce, diagnose in a follow-up if the cause is non-trivial. BUT: if the root cause is obvious during log review (e.g. a portal radius too wide, a keepalive timeout), fix inline.

## File impact (estimate)

- `apps/client/src/game/LevelUpBanner.tsx` — add explicit dismiss timer OR migrate to sonner.
- `apps/client/src/game/WorldDrops.tsx` (or equivalent) — prompt-text derivation bug.
- `apps/client/src/game/GameView.tsx` — delete online count / lobby / hint widgets.
- `apps/client/src/game/Scene.tsx` + `apps/client/index.html` + `apps/client/src/app.css` — dark-mode isolation + viewport fixes.
- `apps/server/src/rooms/GameRoom.ts` — NPC positions, Elder Cubius interact, lobby safe check, save-on-leave audit, disconnect logging.
- `packages/shared/src/schema.ts` — `Player.customizationColor: string`.
- `apps/server/src/db/schema.ts` + `apps/server/src/db/reconcile.ts` — new `color` column on `player_progress`, reconciler entry for it.
- `apps/server/src/db/playerProgress.ts` — save/load the color field.

## Verify

- Before/after note per bug in the PR body.
- Full preview smoke: login → reload → progress intact → interact with both NPCs → move through lobby (no mobs) → travel → light/dark-mode toggle (scene unchanged) → resize window (responsive).
- `bun run check` + `bun run typecheck` + full test suite clean. New tests where feasible (save-on-disconnect, NPC interact registry, lobby spawn exclusion).

## Out of scope

- Character customizer UI — #96.
- Multi-character — #96.
- Any HUD layout changes — #93.
- Pickup fly-to-player animation — #100.
- Unified InteractionPrompt — #95.

## Retro
_(filled after merge)_
