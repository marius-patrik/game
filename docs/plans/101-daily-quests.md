# Plan: #101 — Seasonal / daily quest rotator

**Status:** draft
**Owner agent:** backend
**Branch:** `feat/daily-quests`

## Context

Rotating daily quests, refreshed UTC midnight. Server-authoritative — server picks 3 daily quests per day (deterministic from date seed) and tracks per-character progress.

Depends on #96 (character-id keyed state).

## Chosen approach

- **Quest catalog** extended: each quest entry gains `isDaily: boolean` + `dailyPool: "kills" | "explore" | "loot"` + `rewardGold` + `rewardXp`.
- **Rotator** (`apps/server/src/quests/dailyRotator.ts`):
  - `getActiveDailyQuests(dateISO: string): readonly QuestDef[]`
  - Deterministic: seed is `YYYY-MM-DD UTC`. Uses a simple hash → selects 3 from the daily-eligible pool. Forced anti-repeat: the day's set must not equal yesterday's set.
- **Progress table**: `character_daily_progress` — columns: `character_id, date, quest_id, progress, completed_at`. Primary key `(character_id, date, quest_id)`.
- **Reconciler**: CREATE TABLE IF NOT EXISTS for the new table + index.
- **Rollover**: lazy — on load, server filters out `date != today_utc`. Old rows accumulate; a separate cron-like cleanup can purge >30 days old (out of scope for this PR).
- **Kill/explore/loot hooks**: existing `killMob`, `onZoneEnter`, `onItemPickup` paths call into a new `quests/dailyTracker.ts` which increments matching daily progress.

## Key files

**New**
- `apps/server/src/quests/dailyRotator.ts` + tests.
- `apps/server/src/quests/dailyTracker.ts`.
- `apps/client/src/game/DailyQuestsHeader.tsx` — rendered at the top of the Quests tab (the same tab rearranged in #93). Shows countdown to UTC midnight + 3 quest progress bars.

**Edit**
- `packages/shared/src/quests.ts` (or wherever quest defs live) — extend catalog with ≥8 daily-eligible entries.
- `apps/server/src/db/reconcile.ts` — add `character_daily_progress` table.
- `apps/server/src/db/character.ts` (from #96) — daily-progress CRUD helpers.
- `apps/server/src/rooms/GameRoom.ts` — hook the tracker into combat/explore/loot paths.

## Verify

- Cold-start server → log in → 3 daily quests visible, stable for the day.
- Complete one → reward (gold + xp) granted → toast shown → quest moves to completed state.
- Bump server date (via a test clock fixture) past UTC midnight → fresh 3 quests; yesterday's progress reset.
- Deterministic: for date 2026-04-18, same 3 quest ids every run.
- No-repeat: today ≠ yesterday set.
- Persistence: progress survives restart.
- `bun run check` + `bun run typecheck` + new tests (rotator seed, no-repeat, rollover) clean.

## Out of scope

- Weekly / seasonal quests.
- Bonus rewards for completing all 3.
- Shared party progress (dailies are solo).
- Cleanup of >30-day-old progress rows.

## Retro
_(filled after merge)_
