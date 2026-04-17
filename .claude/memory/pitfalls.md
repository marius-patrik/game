---
name: Pitfalls
description: Non-obvious gotchas learned in prior sessions
type: project
---

# Pitfalls

## Client: Colyseus schema crashes at mount
SWC does NOT apply TypeScript experimental decorators by default. `@type(...)` in `packages/shared/src/schema.ts` produces `Cannot read properties of undefined (reading 'constructor')`.
**Fix:** `source.decorators.version: "legacy"` in `apps/client/rsbuild.config.ts` (landed in PR #15).
**How to apply:** If you see schema constructor errors, check rsbuild config first.

## Production binary fails to start: pino-pretty
`pino-pretty` cannot be resolved inside the `bun build --compile` binary. Use `process.env.NODE_ENV === "production" ? pino() : pino({ transport: { target: "pino-pretty" } })` and `--define process.env.NODE_ENV='"production"'` at compile time.

## Drizzle migrations missing in binary
Migrations are file-based. They must be embedded via `scripts/generate-migrations.ts` and materialized to a temp dir at startup for `drizzle-kit migrator` to consume.

## SPA fallback served 200 for missing .js assets
The catch-all in `serve.ts` must only fall back to `index.html` for extensionless paths. Asset-like paths (contain `.` after last `/`) should 404 cleanly so build cache busting works.

## bun --cwd <dir> run <script> does not pass args
Use `bun run --filter <pkg-name> <script>` instead.

## Express multi-Set-Cookie
`response.headers.getSetCookie()` must be forwarded — not `response.headers.get("set-cookie")` — when bridging better-auth responses through Express.

## Fresh git worktree has no node_modules
`git worktree add` gives a clean checkout but skips `bun install`. Typecheck, lint, and dev-server all fail until you run `bun install` inside the worktree. Applies to overseer-isolated agent worktrees under `.claude/worktrees/`.

## Adding `types` to tsconfig requires re-install in sibling worktrees
When a change adds `"types": ["bun"]` (or any new ambient types) to `packages/shared/tsconfig.json`, sibling worktrees that were already `bun install`ed before the change need another `bun install` so `@types/bun` shows up in their `node_modules`. Symptom: `TS2688: Cannot find type definition file for 'bun'` in one worktree while another is green.

## Dispatching many agents hitting a shared rate-limit
Parallel dispatch via `Agent({ isolation: "worktree", run_in_background: true })` shares one Anthropic account. When the rate limit kicks in mid-commit, agents exit cleanly but their branches sit at the old base with uncommitted files in the worktree. Recovery: inspect `git status` in each worktree, commit/rebase manually, or roll forward in the overseer seat. For the one agent that got no worktree allocated (e.g. the third-in-queue), its uncommitted work lands in the **primary** checkout — look there before assuming the work is lost.

## Colyseus MapSchema + biome noForEach
Biome's `lint/complexity/noForEach` rule flags `MapSchema.forEach(...)` even though it's the documented iteration API. Use `for (const [, v] of map)` instead of `map.forEach(...)` — the destructured tuple iterator works cleanly on `MapSchema` and keeps biome happy.

## Colyseus MapSchema `@type({ map: "string" })`
Primitive-value maps on Schema classes use the quoted string form: `@type({ map: "string" }) equipment = new MapSchema<string>();`. For Schema-valued maps use the class: `@type({ map: QuestProgress }) quests = new MapSchema<QuestProgress>();`. Forgetting the quotes for primitives produces a runtime `Cannot read properties of undefined` during serialization.

## Claude Preview shadcn `select` change event
The native `onChange` handler on a React-controlled `<select>` responds to the instance-level setter, not just `.dispatchEvent("change")`. From Claude Preview `preview_eval`, driving a zone swap through the HUD dropdown doesn't work; the reliable path is clicking the portal entity in the world, OR programmatically invoking the `travel()` callback via a hook ref. In practice, prefer click-to-travel for test flows.

## Adding a Drizzle migration without drizzle-kit
When the new sql file is added under `apps/server/drizzle/` **and** registered in `meta/_journal.json` (with a matching snapshot file), `runMigrations()` at startup applies it automatically. Pair with `generate-migrations.ts` so the migration ships inside the compiled binary — `bun run build:release` re-emits `migrations-embedded.ts` each build.

## Claude Preview serves from one worktree; edits happen in another
`preview_start` caches its cwd at first launch. If the overseer later edits files from a different worktree (e.g. you committed on `feat/foo` in the primary but the preview is running from `.claude/worktrees/laughing-*`), rsbuild HMR will serve stale bundles — you'll see the old class names + old components and think the edit didn't land. Fix: push the branch, then in the preview worktree `git fetch && git reset --hard origin/<branch>` and reload the page. Symptom to look for: DOM has old class strings that the repo no longer contains.

## Shipping multiple mob/combat PRs in one session = mobs.ts rebases
`apps/server/src/rooms/systems/mobs.ts` is the single hotspot for mob AI. When two PRs both change the step-computation (e.g. boss enrage → speed+cooldown override, caster bolts → negative step for backpedal), the second one rebases onto a mutated baseline and git can't auto-merge the `step = Math.min(arche.speed * dtSec, dist)` line. Resolution: use the downstream branch's `speed` variable (which already folds in enrage) as input to the kiting logic. Symptom: `<<<<<<<` in mobs.ts around the per-mob step calc. Next time, either serialize mob PRs or pre-extract the step computation into a helper.

## PR CI sometimes never triggers on first push
On rare occasions `gh pr create` followed by the initial workflow run just… doesn't fire (empty `statusCheckRollup`, no run visible in the Actions API). Unrelated to workflow config — CI triggers on PR events normally. Unblock: `git commit --allow-empty -m "chore: retrigger CI"` + push, or force-push after a rebase. Both re-trigger the `pull_request` event reliably. Don't panic if the PR sits for 5+ min with no checks — just re-trigger.

## Express 5 `req.params.x` is `string | string[] | undefined`
Different from Express 4 where path params were always `string`. New REST handlers need explicit narrowing before passing params to helpers, or `tsc --noEmit` fails. Fix: a small helper like `pickSessionId(raw: string | string[] | undefined): string | undefined` that returns the string if `typeof === "string" && length > 0`, else undefined; route handler 400s on missing. Landed in #76 admin routes.

## Biome `useExhaustiveDependencies` hates refresh-counter state
A pattern of `const [refreshTick, setRefreshTick] = useState(0); useEffect(..., [refreshTick])` trips the rule even though it's the classic "bump this to force a reload" idiom. Cleanest fix is to hoist the fetch into a `useCallback` and call it directly after the triggering action — drops a piece of state and keeps biome happy. Surfaced in #76 Sessions.tsx polling.

## Recovering a rate-limited agent from the overseer seat
When a dispatched agent hits the shared Anthropic account rate limit mid-run (`result: "You've hit your limit · resets <time>"`), the notification status is `completed` even though the work isn't. The pitfall about parallel dispatch talks about WIP landing in primary; for a single agent the recovery is subtly different:
1. `git -C .claude/worktrees/agent-<id> status --short` — the agent's committed baseline is fine, but there's likely a pile of modified/untracked files.
2. `git -C .claude/worktrees/agent-<id> diff --stat` to see scope.
3. **Don't re-dispatch** unless you're sure the quota reset — you'll just waste another attempt. The faster path is to finish from the overseer seat: continue editing in the agent's worktree (same branch), run the full preflight there, commit, push, open the PR yourself. Document the hand-off in the plan's Status.
4. When the PR opens, note in the body which % the agent got to and which the overseer finished — useful for retrospectives and for estimating next time. Happened on #73 at ~40% agent / 60% overseer.

## Drizzle migrations 0003 + 0004 are not in `_journal.json`
`apps/server/drizzle/0003_stats_extras.sql` and `0004_cooldowns_chat.sql` exist on disk but neither is listed in `apps/server/drizzle/meta/_journal.json`. Drizzle's `readMigrationFiles` only iterates the journal, so unlisted migrations are silently skipped. Fresh SQLite DBs therefore don't get the `gold`/`mana`/stats/equipment/quests/skill-cooldowns columns on `player_progress`, nor the `chat_message` table — existing dev DBs happen to have them because they were migrated via an older path. This is the root cause of the 3 pre-existing `playerProgress.test.ts` failures since #55. **Do NOT retroactively register 0003/0004** — drizzle would then try to re-`CREATE TABLE chat_message` on already-populated DBs and crash. Fix wants a separate idempotent migration (e.g. `0006_reconcile.sql` with `ALTER TABLE … ADD COLUMN IF NOT EXISTS` + `CREATE TABLE IF NOT EXISTS`). Tracked in #81.

## Dispatched agents write to the primary checkout when they use absolute paths
`isolation: "worktree"` allocates an isolated worktree under `.claude/worktrees/agent-*` and bootstraps the agent with that cwd, but the Write/Edit tools themselves are path-agnostic. The moment an agent passes an absolute path like `/Users/user/Documents/projects/game/apps/...` (natural when it pastes paths from a plan or an earlier tool output), the edit lands in the **primary** checkout — which is usually on `main` or an overseer branch. Symptom: `git status` inside the agent's worktree shows working tree clean, but the primary is dirty on a branch it doesn't own. Overseer recovery: `git stash -u` in the primary, `git stash pop` in the correct worktree — OR, if the agent is still running, wait for it to finish (it'll often self-correct on its next edit sequence and commit from its worktree, leaving the earlier stray absolute-path edits harmlessly in the primary's working tree). Either way: if you see mysterious untracked/modified files in the primary after dispatching, don't panic, it's the agent not a bug in your overseer flow. #70 mobile-touch-polish hit this twice before converging.
