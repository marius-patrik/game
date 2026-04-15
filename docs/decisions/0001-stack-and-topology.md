# ADR-0001 · Stack and topology

**Status:** accepted
**Date:** 2026-04-15

## Context

Bootstrapping a 3D browser MMO. Need a stack that produces a polished, animation-heavy client with fluid React UI blended into the 3D scene, an authoritative multiplayer backend, and no third-party provider lock-in. Single maintainer (Claude); pragmatism > novelty.

## Decisions

### Client rendering: React Three Fiber + Three.js

R3F over Babylon because UI/3D blend is the hard requirement. `@react-three/drei`'s `<Html>` renders React DOM inside the scene with automatic occlusion and perspective — exactly the "shadcn UI inside 3D" ask. Shared state (zustand) crosses the 2D/3D boundary trivially. framer-motion + framer-motion-3d animates both sides with one mental model.

Babylon has stronger built-ins (WebGPU, node material editor) but weaker React integration. We'd fight the seam constantly.

### Networking: Colyseus 0.16 with `@colyseus/bun-websockets`

Authoritative room-based server. Delta-encoded state sync (`@colyseus/schema`) is the single piece of netcode I refuse to write from scratch. Colyseus is MIT, self-hostable, actively maintained, TS-first, and ships a Bun-native transport.

Rejected: rolling our own WS + tick loop (months of work, easy to get lag-comp wrong); managed platforms (vendor lock-in).

### Topology: instanced zones

Persistent accounts, named zones capped at N players, travel via zone transitions. Sits between pure arena (too small) and seamless world (spatial grid + interest management, months of netcode).

Start arena-like with one zone. Add zone transitions in a later ADR.

### Auth: Better Auth (self-hosted)

MIT-licensed, Bun-compatible, handles email/password + sessions + rate limiting out of the box. Self-hosted DB = self-hosted auth. Rejected: rolling our own with Oslo primitives (more work, same outcome); managed (provider lock-in).

### DB: `bun:sqlite` + Drizzle ORM

bun:sqlite is built into Bun, zero ops. Drizzle is TS-first, schema-in-code, no codegen, minimal runtime. SQLite scales vertically far enough for our foreseeable MMO scope (up to tens of thousands of accounts with low contention). Drizzle's sqlite and postgres dialects share 90% of the query surface — swap is a config change.

Rejected: Prisma (heavier, codegen, weaker Bun story); Postgres from day one (ops overhead we don't need yet).

### Cache/pubsub: none initially

Colyseus `MemoryDriver` = in-process state. Redis only becomes necessary for multi-node Colyseus, which we don't need until horizontal scaling is forced on us.

### Deploy: single Bun binary

`bun build --compile` produces a self-contained executable with client static assets embedded. Copy to any Linux VPS, run. No Docker, no orchestrator, no CDN, no provider.

Rejected: Docker Compose (heavier for zero benefit at this scale); systemd (fine but not worth the config when a binary already handles it).

### Admin dashboard: in the same SPA

`/admin/*` routes in the client, role-gated by Better Auth session. One codebase, one bundle, one auth system. Rejected: separate admin app (duplicate auth, duplicate build, no real upside at our scale).

### Build: rsbuild (Rspack)

Fast Rust-based bundler, Vite-like DX, better prod perf than Vite for large bundles. Rejected: Vite (slower prod), Webpack (slower dev), esbuild-only (missing HMR refinements).

### Lint/format: Biome

One tool for lint + format + import sort, Rust-fast. Rejected: ESLint + Prettier (slower, more config, two tools).

### Routing: wouter

Tiny (~1.5kb), hook-based, pattern matching. For an SPA with `/`, `/admin/*`, `/login`, `/signup` we don't need TanStack Router's full arsenal. If routes grow complex, revisit.

## Consequences

- Every runtime dependency is bundled. Zero external services at runtime.
- Shared types via `@game/shared` are non-negotiable — adding networked state means adding a Schema class.
- React is pinned to 18 until R3F v9 + drei v10 stabilize on React 19. Reassess quarterly.
- Single binary means the client must be built and embedded before the server build. Deploy pipeline must respect that ordering.
- SQLite pins us to single-writer semantics. If we need horizontal scale, Postgres swap comes before multi-node Colyseus.
