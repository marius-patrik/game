# CLAUDE.md

Instructions for any Claude session working on this repo. Read this first, then check `docs/work.md` for current focus. Keep this file current — if you change a convention, update it here in the same commit.

## What this is

A 3D browser MMO. Instanced-zone topology (RoTMG-style): persistent accounts, zones cap at N players, players travel between instances. Single self-contained project — **no third-party providers**. One Bun process serves the Colyseus WebSocket, REST API, and static client. One SPA serves both the game and the admin dashboard.

Claude is the sole maintainer. Humans drive direction, Claude executes.

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
  worktrees/     Feature worktrees (gitignored)
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
```

In Claude sessions, use `preview_start client` / `preview_start server` (reads `.claude/launch.json`).

## Where work lives

- **[docs/work.md](docs/work.md)** — the single source of truth. Current focus at top, next up below, backlog at bottom. Update it when focus shifts.
- **GitHub issues** — one issue per discrete unit of work. Every issue links back to the `work.md` line it came from.
- **[docs/decisions/](docs/decisions/)** — ADRs. Capture *why* we chose X over Y. Numbered, append-only (supersede with a new ADR, don't edit).

When you pick up work: read `docs/work.md`, find the current-focus item, open/find its GitHub issue, branch, do the work, PR.

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

## Testing (TBD)

No tests yet. Before we write any, pick a runner — `bun test` is the default. Write tests as the game loop solidifies; don't over-invest until mechanics stabilize.

## Deploy (TBD)

Target: single binary. Client built → static files embedded → server imports them → `bun build --compile --target bun-linux-x64 apps/server/src/index.ts -o game-server`. Not wired yet. See `docs/work.md`.

## Session workflow

When you start a session:

1. Read this file.
2. Read `docs/work.md` — what's the current focus?
3. Read the linked GitHub issue.
4. If the task is clear, branch and execute. If ambiguous, ask the user **before** writing code.
5. After landing a change: update `docs/work.md` (tick off the item, promote the next).
6. If you learned something about the codebase worth remembering: update this file.

Do **not** build planning docs, status reports, or decision logs the user didn't ask for. `work.md` and ADRs are the only long-lived artifacts.
