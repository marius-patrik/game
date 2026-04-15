---
name: Project State
description: Core facts about the game codebase that every session should start with
type: project
---

# Project State

**What:** 3D browser MMO. Instanced-zone topology (RoTMG-style). Self-contained — no third-party providers.

**Stack (hard constraints):**
- Runtime: Bun >=1.1, TS strict
- Client: React 18 (not 19 — R3F v8 blocks upgrade), rsbuild (Rspack + SWC), Tailwind v3, shadcn/ui, wouter
- 3D: R3F v8 + drei + postprocessing + rapier
- Net: Colyseus 0.16 (`@colyseus/bun-websockets`), schema decorators (legacy)
- Auth: better-auth (self-hosted)
- DB: bun:sqlite + Drizzle
- Deploy: `bun build --compile` → single Linux binary

**Critical invariants:**
- SWC must use `source.decorators.version: "legacy"` in [apps/client/rsbuild.config.ts](../../apps/client/rsbuild.config.ts) — @colyseus/schema crashes otherwise
- Production bundle must NOT load `pino-pretty` transport — cannot resolve in compiled binary
- `BETTER_AUTH_SECRET` required at runtime in prod
- Embedded client + migrations ship via `import x from "..." with { type: "file" }` attribute imports
- SPA catch-all in [apps/server/src/static/serve.ts](../../apps/server/src/static/serve.ts) — only extensionless paths fall back to index.html
- All networked state goes in `@game/shared` Colyseus Schema classes

**Workflow:**
1. Read [docs/work.md](../../docs/work.md) → pick from Next/Backlog
2. Find/file GH issue with explicit Scope + Acceptance
3. Branch `feat|fix|chore/<short>`, commit conventional-commits style
4. PR, CI green, squash-merge, delete branch
5. Update `docs/work.md` (strike through → Done, move next up)

**Reference paths:**
- Canonical repo: `/Users/user/Documents/projects/game/`
- Remote: `marius-patrik/game`
