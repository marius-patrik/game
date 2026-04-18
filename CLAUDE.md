# CLAUDE.md

Instructions for any Claude session working on this repo. Read this first, then check `docs/work.md` for current focus. Keep this file current — if you change a convention, update it here in the same commit.

## What this is

A 3D browser MMO. Instanced-zone topology (RoTMG-style): persistent accounts, zones cap at N players, players travel between instances. Single self-contained project — **no third-party providers**. One Bun process serves the Colyseus WebSocket, REST API, and static client. One SPA serves both the game and the admin dashboard.

Claude is the sole maintainer. Humans drive direction, Claude executes.

**Org chart.** The user is the client. The default Claude session is the **overseer** (CEO). Execution work is delegated to **execution agents** spawned via the `Agent` tool. Specialist roles exist for high-leverage domains:

| Role | Purpose |
|---|---|
| `overseer` | CEO. Plans, dispatches, monitors, merges, talks to the user. Can ship tiny code fixes to unblock agents; otherwise delegates. |
| `execution` | Ships one issue end-to-end across shared/server/client. No further specialty split. |
| `planning` | Drafts plans in `docs/plans/`, writes ADRs, weighs tradeoffs. No code. |
| `review` | Critiques an open PR against plan + issue + coding rules. No code. |

**Autonomous model.** If `docs/work.md` has items in **Next**, the overseer has standing approval to plan + dispatch + ship without further user input. The user is asked only when scope itself is unclear or **Next** is empty.

**Bootstrap fresh sessions:**
- `./scripts/spawn-agent.sh overseer` (default — for the CEO seat)
- `./scripts/spawn-agent.sh <role> [notes]` for any other role (`execution`, `planning`, `review`)
- Or `/spawn-overseer-agent`, `/spawn-execution-agent`, `/spawn-planning-agent`, `/spawn-review-agent` as Claude Code slash commands.

**Multi-CLI dispatch.** The overseer can execute work via Claude, Codex, or Gemini depending on capability/budget. See the [multi-cli-dispatch skill](.claude/skills/multi-cli-dispatch/SKILL.md). Quickstart:

```bash
scripts/dispatch-cli.sh <cli: claude|codex|gemini> <role> <issue#> <branch>
# tmux attach -t agent-<issue>-<cli>  to watch
```

Prefer Claude's `Agent` tool for role-brief adherence; fall back to Codex when rate-limited; use Gemini for narrow client polish where faster turnaround outweighs capability gaps.

## Stack

| Layer | Choice |
|---|---|
| Runtime | Bun (>=1.1) |
| Build | rsbuild (Rspack) |
| Lint/format | Biome |
| UI | React 18 + shadcn/ui + Tailwind v3 + wouter |
| 3D | React Three Fiber v8 + drei + postprocessing + rapier |
| Particles/FX | three-nebula, lamina, `drei` Sparkles/Trail |
| Animation | framer-motion, framer-motion-3d, @react-spring/three, theatre.js (cinematics), @formkit/auto-animate |
| HUD polish | sonner (toasts), vaul (drawers), @tsparticles (DOM FX) |
| Audio | howler.js |
| Networking | Colyseus 0.16 (`@colyseus/bun-websockets`) |
| Auth | better-auth (self-hosted, MIT) |
| DB | `bun:sqlite` + Drizzle ORM (sqlite dialect, swappable to Postgres) |
| State | zustand |
| Deploy | `bun build --compile` → single Linux binary, copy to any box |

**Do not introduce third-party providers.** No Supabase, Neon, Upstash, Clerk, Fly, Vercel, Sentry, Grafana Cloud, etc. Everything self-contained.

**Why React 18 not 19:** R3F v8 uses a react-reconciler incompatible with React 19 internals. Upgrade both together when R3F v9 + drei v10 are stable.

## Layout

```
apps/client      SPA: game (/) + admin (/admin/*) + auth routes
apps/server      Bun: Colyseus + REST + static serving + SQLite
packages/shared  Colyseus Schema + shared types (imported by both apps)
data/            SQLite files (gitignored, created at runtime)
docs/
  work.md        Live work queue — current focus, next up, backlog
  decisions/     ADRs (numbered, one decision per file)
.github/         Issue + PR templates, CI workflow
.claude/
  launch.json    Dev server configs for Claude Code preview
  memory/        Project-scoped memory (loaded into every session)
  skills/        Project-local skills (ship-feature, preflight, update-work, planning, maintenance)
  commands/      Slash commands — one per agent role (overseer, execution, planning, review)
  hooks/         Session/pre-push hook scripts
  worktrees/     Feature worktrees (gitignored)
docs/
  plans/         One plan per non-trivial feature; drafted before code is written
scripts/
  spawn-agent.sh <role>   Launch a Claude Code session in the given role
```

**Shared code is the key leverage point.** `@game/shared` holds Colyseus Schema classes — client and server import the same types. When you add network state, add it there.

## Run

```bash
bun install
bun run dev                    # client + server in parallel
bun run dev:client             # http://localhost:3000
bun run dev:server             # ws://localhost:2567 (+ /health, /colyseus monitor)
bun run check                  # Biome lint + format check
bun run check:fix              # Biome autofix
bun run typecheck              # tsc --noEmit across workspaces
bun run test:e2e              # Playwright full-flow run + screenshots
```

In Claude sessions, use `preview_start client` / `preview_start server` (reads `.claude/launch.json`).

## Where work lives

- **[docs/work.md](docs/work.md)** — the single source of truth. Current focus at top, next up below, backlog at bottom. Update it when focus shifts.
- **[docs/user-intents.md](docs/user-intents.md)** — global checklist of every user-voiced intent and whether it has been verified in the preview. Append a row every time the user asks for something; flip the status to `verified-preview` only after driving it live.
- **GitHub issues** — one issue per discrete unit of work. Every issue links back to the `work.md` line it came from.
- **[docs/decisions/](docs/decisions/)** — ADRs. Capture *why* we chose X over Y. Numbered, append-only (supersede with a new ADR, don't edit).

When you pick up work: read `docs/work.md`, find the current-focus item, open/find its GitHub issue, branch, do the work, PR.

## Preview verification loop (mandatory after every merge)

The user's north star is the running game. Every merged PR must be reproduced in the preview before the intent counts as shipped:

1. After `gh pr merge`: `git pull origin main` in the primary checkout. Sync the overseer worktree if different (`git reset --hard origin/main`, but re-stage any in-flight local edits first).
2. `preview_start client` / `preview_start server` if not running; hard-reload via `preview_eval`.
3. Drive the acceptance bullets end-to-end (`preview_click`, `preview_fill`, `preview_eval`) — log in, create a character if needed, reproduce the feature.
4. `preview_console_logs level=error` — confirm no new errors.
5. `preview_screenshot` for visual changes.
6. Flip the matching row(s) in `docs/user-intents.md` to `verified-preview` with the date.

If preview surfaces a regression, revert the merge or land a hotfix immediately. Never let main sit broken.

Execution agents do the same loop before opening their PR (see `.claude/commands/spawn-*-agent.md`). The overseer re-verifies post-merge against the freshly-built main.

## Conventions

### Commits

Conventional Commits:
- `feat:` new capability
- `fix:` bug fix
- `chore:` tooling / deps / config
- `docs:` docs only
- `refactor:` no behavior change
- `perf:` performance
- `test:` tests only

Keep subject ≤ 72 chars, imperative mood. Body optional but preferred for non-trivial changes.

### Branches

- `main` — always deployable
- Feature branches: `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`
- Use git worktrees under `.claude/worktrees/` for parallel work

### PRs

- **Every non-trivial change goes through a PR.** Small chore fixes can go direct to main.
- Title mirrors the commit subject.
- Body follows `.github/PULL_REQUEST_TEMPLATE.md`: summary, what changed, test plan, screenshots if UI.
- Link the issue with `Closes #N`.
- CI must pass before merge.
- Squash-merge (linear history on main).

### Issues

- Use templates under `.github/ISSUE_TEMPLATE/`: `feature`, `bug`, `task`.
- Labels: `area:client`, `area:server`, `area:shared`, `area:ops`, `type:feat`, `type:bug`, `type:chore`, `priority:p1..p3`.
- Every issue answers: what's the outcome, how do we verify.

## Coding rules

- **Strict TS** everywhere. `noUncheckedIndexedAccess`, `noImplicitOverride`, `strict: true`. Don't weaken.
- **No `as any`.** No `@ts-ignore`. If a type is hard, write a helper. The one existing `any` cast (BunWebSockets `.app`) is ignored with a specific biome comment explaining why — remove it when Colyseus exposes proper types.
- **No dead code.** If you remove a feature, remove its code. No commented-out blocks, no `_unusedVar` shims.
- **No backwards-compat shims.** This repo has no users yet. Change things cleanly.
- **No comments explaining WHAT.** Identifiers do that. Only comment when the WHY is non-obvious (a hidden constraint, workaround for a library bug, invariant that isn't enforced by types).
- **Biome is the formatter.** Run `bun run check:fix` before committing. CI will fail otherwise.
- **Bundle size matters** on the client. Before adding a dep, check its gzipped size. Prefer composable primitives (drei) over meta-frameworks.

## Architecture principles

- **Authoritative server.** Clients send inputs, server simulates, server broadcasts state. Never trust client state.
- **Shared schema.** All networked state lives in `@game/shared` as Colyseus Schema. Client and server import the same class.
- **Self-contained.** Every runtime dependency is a library we bundle. No external services.
- **One binary deploy.** `bun build --compile` should always produce a working executable. Assets go through the bundler, not the filesystem.
- **Admin is part of the client.** `/admin/*` routes are role-gated, not a separate app.
- **Zones over rooms.** We're instanced-zone, not session-based. Zone persistence and zone transitions are first-class concerns — not grafted on later.
- **Mobile + desktop are equal citizens.** See [ADR-0002](docs/decisions/0002-mobile-and-desktop.md). Every gameplay UI change must be verified in both 1440×900 (desktop) and 390×844 (mobile) viewports. Input abstraction covers keyboard/mouse + touch. Performance budgets: desktop 60 FPS / <500 draw calls, mobile 30 FPS / <150 draw calls. Assets ship with Draco + KTX2 + mobile LOD. Admin UI is desktop-first — not gameplay.

## Testing (TBD)

No tests yet. Before we write any, pick a runner — `bun test` is the default. Write tests as the game loop solidifies; don't over-invest until mechanics stabilize.

## Deploy

Single binary, wired via `bun run build:release`:

1. `bun --filter @game/client run build` → `apps/client/dist/`
2. `apps/server/scripts/generate-static.ts` walks the client dist and writes `apps/server/src/static/embedded.ts` with `import ... with { type: "file" }` bindings (each value is a file path that works inside the compiled binary via `Bun.file`).
3. `apps/server/scripts/generate-migrations.ts` does the same for `apps/server/drizzle/`, so drizzle migrations ship inside the binary and are materialized to a temp dir at startup.
4. `bun build --compile --minify --define process.env.NODE_ENV='"production"' apps/server/src/index.ts --outfile dist/game-server`.

`apps/server/src/static/serve.ts` mounts a catch-all route that serves embedded assets, falls back to `index.html` for extensionless paths (SPA routing), and defers to upstream handlers for `/api/*`, `/admin/api/*`, `/colyseus*`, `/matchmake*`, `/health`.

Client endpoint resolution (`apps/client/src/lib/endpoint.ts`):
- Dev (rsbuild on :3000) → talks to `:2567`.
- Binary (any other origin) → uses `window.location.origin` for HTTP and `wss?://host` for WS.
- Overridable via `window.__API__` / `window.__WS__`.

Production requirements: `BETTER_AUTH_SECRET` must be set (auth throws at startup otherwise); `pino` drops the `pino-pretty` transport under `NODE_ENV=production` (it cannot resolve in a compiled binary).

The generated `embedded.ts` / `migrations-embedded.ts` files are ignored by Biome and checked into git as stubs.

## Session workflow

When you start a session:

1. Read this file.
2. Read [.claude/memory/MEMORY.md](.claude/memory/MEMORY.md) + [.claude/memory/project.md](.claude/memory/project.md) + [.claude/memory/pitfalls.md](.claude/memory/pitfalls.md).
3. Read `docs/work.md` — what's the current focus?
4. Read the linked GitHub issue.
5. If the task is clear, invoke the `ship-feature` skill and execute. If ambiguous, ask the user **before** writing code.
6. After landing a change: invoke the `update-work` skill.
7. If you learned something non-obvious: append to [.claude/memory/pitfalls.md](.claude/memory/pitfalls.md).

## Project skills ([.claude/skills/](.claude/skills/))

- **planning** — draft `docs/plans/<issue>-<slug>.md` before any non-trivial feature
- **dispatch** — overseer's minimal prompt template for spawning execution agents
- **ship-feature** — the full issue → branch → PR → merge → update-work flow
- **preflight** — biome + typecheck, run before every commit
- **update-work** — move a shipped item to Done in docs/work.md
- **maintenance** — dead-code / docs / deps / bundle-size sweep; run between features

## Proactive mindset

You are always on. Between features, polish: delete dead code, resolve TODOs, refresh stale docs, trim unused deps, keep the bundle small. File issues for anything you spot tangentially that's bigger than a few-minute fix. Don't wait to be told.

## Project memory ([.claude/memory/](.claude/memory/))

- **project.md** — stack, invariants, workflow, paths
- **pitfalls.md** — non-obvious gotchas (decorators, pino, SPA fallback, …). Append when you learn something new.

Do **not** build planning docs, status reports, or decision logs the user didn't ask for. `work.md` and ADRs are the only long-lived artifacts.
