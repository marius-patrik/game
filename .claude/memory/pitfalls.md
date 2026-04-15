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
