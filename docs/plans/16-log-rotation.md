# Plan: #16 — Server-side log rotation

**Status:** draft
**Owner agent:** backend
**Branch:** `feat/log-rotation`

## Context
Production logs currently go to stdout only — they vanish on restart. We need persistent, rotated, structured logs that survive in the compiled `bun build --compile` binary (which can't load thread-based pino transports like `pino-pretty` or default `pino/file` transport).

## Options considered

1. **`pino-roll` as a destination stream.** Pure stream over `sonic-boom`, no worker_threads — works in the compiled binary. Built-in daily + size rotation, retention by file count.
2. **Custom rotation around `pino.destination(path)`.** Roll our own date/size check on each write. More code, more bugs, no real benefit.
3. **External `logrotate(8)` or `bun --watch`-driven rotator.** Pushes responsibility to ops; doesn't ship in-binary. Rejected — self-contained constraint.
4. **`pino.transport({ target: "pino/file" })`.** Worker-thread transport — fails in compiled binary. Rejected.

## Chosen approach
Option 1 — `pino-roll`. Already installed (`pino-roll@4.0.0`).

Production:
```ts
import { roll } from "pino-roll";
const stream = await roll({
  file: join(LOG_DIR, "server.log"),
  frequency: "daily",
  size: "20m",
  mkdir: true,
  limit: { count: 7 },
});
const log = pino({ level: process.env.LOG_LEVEL ?? "info" }, pino.multistream([
  { stream },
  { stream: process.stderr, level: "error" },
]));
```

Dev (unchanged behavior): `pino({ transport: { target: "pino-pretty" } })`.

## File impact
- `apps/server/src/logger.ts` — **new**. Exports `log`. Centralizes config.
- `apps/server/src/index.ts` — replace inline pino setup with `import { log } from "./logger"`.
- `apps/server/package.json` — `pino-roll` dep already added on a discarded branch; re-add here.
- `.gitignore` — add `logs/`.
- `apps/server/drizzle/` — none.

## Risks / unknowns
- **`pino-roll@4` API:** v4 uses `{ roll }` named export; double-check signature against the installed version's README.
- **Compiled binary file paths:** must use `Bun.file` / `node:fs` correctly when `LOG_DIR` is a relative path. Resolve to absolute at startup.
- **Permissions:** `mkdir: true` should handle missing dir; CI containers may need a writable path.
- **stderr duplication:** make sure errors don't appear twice in dev (pino-pretty already writes to stderr by default).

## Acceptance mapping
- ✅ "logs go to logs/server.log with daily rotation (max 7 days, max 20 MB per file)" — `frequency: "daily"`, `size: "20m"`, `limit: { count: 7 }`.
- ✅ "plus stderr for errors" — multistream with `level: "error"` on stderr.
- ✅ "In dev: pretty to stdout" — keep `pino-pretty` transport branch.
- ✅ "All existing log.info/warn/error sites migrate" — only one site exists today (`index.ts:115`); migrate it.
- ✅ "Env var LOG_DIR overrides default" — `process.env.LOG_DIR ?? "logs"`.
- ✅ "Binary build still succeeds" — verified via `bun run build:release && ./dist/game-server`.
- ✅ "rotation creates directory if missing" — `mkdir: true`.

## Out of scope
- Log shipping to external collector (no third-party providers).
- Per-room or per-user log channels.
- Structured query tooling.

## Retro
_(filled after merge)_
