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
