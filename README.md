# game

3D browser MMO. Single self-contained project: one client SPA (game + admin), one Bun server, SQLite.

## Stack

- **Runtime**: Bun
- **Build**: rsbuild (Rspack)
- **Lint/format**: Biome
- **UI**: React 19 + shadcn/ui + Tailwind + wouter
- **3D**: React Three Fiber + drei + postprocessing + rapier
- **Networking**: Colyseus (authoritative, in-memory driver)
- **State**: zustand
- **Animation**: framer-motion + framer-motion-3d
- **Auth**: Better Auth (self-hosted)
- **DB**: SQLite via `bun:sqlite` + Drizzle ORM
- **Deploy**: self-contained — one Bun process serves WS + REST + static client. Runs on any Linux box.

## Layout

```
apps/client      # SPA: game (/) + admin (/admin/*) + auth routes
apps/server      # Bun: Colyseus + REST + static serving + SQLite
packages/shared  # Colyseus Schema, shared types
data/            # SQLite files (gitignored)
```

## Develop

```bash
bun install
bun run dev           # client + server
bun run dev:client    # client only (http://localhost:3000)
bun run dev:server    # server only (ws://localhost:2567)
```

## Release — single binary

```bash
bun run build:release          # → dist/game-server (self-contained)
BETTER_AUTH_SECRET=... ./dist/game-server
```

One executable serves WebSocket, REST, and the static client on a single port (default `2567`, override with `PORT=...`). No `node_modules` needed at runtime. The binary creates `./data/game.db` beside itself on first start.

Required env in production: `BETTER_AUTH_SECRET`. Optional: `PORT`, `TRUSTED_ORIGINS` (comma-separated, add your public origin).

## Worktrees

```bash
git worktree add .claude/worktrees/feature-x -b feature-x
```
