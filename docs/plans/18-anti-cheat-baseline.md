# Plan: #18 — Anti-cheat baseline

**Status:** shipped
**Owner agent:** backend
**Branch:** `feat/anti-cheat-baseline`

## Context
Server is authoritative for movement, but today there's no rate limiting on inputs and no rejection of impossible movement vectors. Before combat lands, we need basic guardrails.

## Options considered

1. **Per-message-type token bucket + per-tick movement validator inside `GameRoom`.** Self-contained, fast, no extra processes.
2. **Express-style middleware around Colyseus message handlers.** Colyseus 0.16 doesn't have first-class middleware for room messages; wrapping `onMessage` registration is the closest. Equivalent ergonomics to option 1, no real win.
3. **External rate-limit service (Redis, etc.).** Violates self-contained constraint. Rejected.

## Chosen approach
Option 1. New module `apps/server/src/security/`:
- `RateLimiter` — token bucket per (sessionId, messageType). Configurable bucket size + refill rate per type.
- `MovementValidator` — pure function `validate(prev, next, dt, zoneBounds, maxSpeed): { ok, clampedTo? }`.
- `ViolationTracker` — counts violations per session in a sliding 30s window; emits a `kick` signal at threshold.

`GameRoom` integrates all three: every `onMessage` handler routes through the limiter, every position update through the validator, every violation through the tracker.

## File impact
- `apps/server/src/security/RateLimiter.ts` — **new**.
- `apps/server/src/security/MovementValidator.ts` — **new**.
- `apps/server/src/security/ViolationTracker.ts` — **new**.
- `apps/server/src/security/config.ts` — **new**. Exports defaults: `move: 30/s`, `attack: 5/s`, `chat: 2/s`. Movement: `maxSpeed = 8 units/s`. Move rate limit sized for touch input (which produces lower input-frequency than keyboard/mouse) — see [ADR-0002](../decisions/0002-mobile-and-desktop.md). Do **not** threshold so tight that a touch client trips violations on legitimate play.
- `apps/server/src/security/index.ts` — **new**. Re-exports.
- `apps/server/src/rooms/GameRoom.ts` — wire limiter, validator, tracker.
- `packages/shared/src/schema.ts` — add `Player.violations` (number) for admin visibility.
- `apps/server/src/__tests__/security.test.ts` — **new**. `bun test`.
- `apps/client/src/admin/PlayersPage.tsx` — surface violation count column.
- `apps/server/package.json` — none (uses bun test).

## Risks / unknowns
- **`bun test` not yet wired** in this repo. May be the first test file. Verify `bun test` runs from the workspace root and respects TS.
- **Movement validator + zone bounds:** zones may not currently expose a `bounds` shape on the room. If not, add one to the existing zone-config module rather than hard-coding here.
- **Kick mechanism:** Colyseus has `client.leave(code)` — confirm code 4000+ is appropriate for soft kicks.
- **Schema add:** `violations` on Player will broadcast to all clients in the same room. Acceptable (other players seeing the count isn't a security risk), but document.

## Acceptance mapping
- ✅ Per-client input rate limit, configurable, drop + warn over threshold — `RateLimiter` + `config.ts`.
- ✅ Server rejects positions outside zone bounds, rejects teleports > max speed × dt — `MovementValidator`.
- ✅ Records violation counts per client in state — `Player.violations` schema field.
- ✅ 10+ violations in 30s → kick — `ViolationTracker` config.
- ✅ Unit tests for the validator covering normal movement, boundary clamp, teleport rejection, rate-limit window.
- ✅ Admin page surfaces violation count per session.
- ✅ Rate limit does not false-positive on touch input (lower input frequency). Validate with a synthetic test that submits touch-like input cadence (5–15 moves/s) for 10 seconds and asserts zero violations.

## Out of scope
- Server-side anti-speed-hack physics simulation (rapier on the server) — too heavy for baseline.
- Replay-based cheat detection.
- IP-based rate limiting at the transport layer.

## Retro
_(filled after merge)_
