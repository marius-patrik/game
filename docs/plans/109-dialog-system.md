# Plan: #109 — Skyrim-style NPC dialog system

**Status:** draft
**Owner agent:** execution
**Branch:** `feat/dialog-system`

## Context

Current NPC interaction is bare — a tiny prompt + modal buttons. The ask: a polished branching dialog UI (portrait + typewriter text + numbered choices) that makes interactions feel weighty. Vendor entry + quest-start flow through this too.

Depends on #95 (unified InteractionPrompt) and #107 (camera `dialog` profile).

## Chosen approach

- **Dialog trees as immutable shared data** in `packages/shared/src/dialogs/`. Each NPC's tree is a file — one `DialogNode` tree per NPC. Encoded as plain objects; compile-time checked by the shared types.
- **Server is authoritative** for node transitions: client sends `{ nodeId, choiceIndex }`, server runs requirement checks + action effects (start quest, open vendor, gate by level/quest state) and returns the next node. Prevents client-side cheat (e.g. skipping level-gated choices).
- **Client renders a single `DialogUI.tsx` modal** layered above HUD. Typewriter effect is client-only — skippable with space.
- **Camera**: `setCameraProfile("dialog")` on open, restore on close. Camera profile already exists from #107.

## Schema additions

No Colyseus Schema changes needed — dialog state (current node id) lives client-side; server validates each advance from scratch based on player state. Stateless dialog = simpler + cheat-proof.

If future dialog requires persistent mid-conversation state (e.g. affinity tracking), add a `Player.dialogState: MapSchema<string>` then.

## Key files

**New**
- `packages/shared/src/dialog.ts` — `DialogNode`, `DialogChoice`, `DialogAction`, `DialogRequirement` types + validator.
- `packages/shared/src/dialogs/elder-cubius.ts` — quest-giver tree.
- `packages/shared/src/dialogs/mercer.ts` — vendor tree (+ "Show wares" action → opens vendor panel).
- `packages/shared/src/dialogs/index.ts` — exported map `{ [npcId]: DialogNode }`.
- `apps/client/src/game/DialogUI.tsx` — modal (portrait stub + typewriter text + numbered choices).
- `apps/client/src/game/dialog/typewriter.ts` — char-per-frame reveal hook.
- `apps/server/src/dialog/dispatch.ts` — node resolution + action effects.
- `apps/server/src/dialog/dispatch.test.ts` — requirement checks + branch correctness.

**Edit**
- `apps/server/src/rooms/GameRoom.ts` — `onMessage("dialog-start", { npcId })` + `onMessage("dialog-choose", { nodeId, choiceIndex })`.
- `apps/client/src/game/NpcInteractor.tsx` — open `DialogUI` instead of the old lightweight prompt when E is pressed on an NPC with a dialog tree.
- `apps/client/src/game/Mercer.tsx` (or vendor panel trigger) — `open-vendor` dialog action wires through.
- `apps/client/src/game/ElderCubius.tsx` — quest-start dialog action wires through.

## Verify

- Press E on Elder Cubius → DialogUI opens, portrait + typewriter line visible, camera pulls close.
- Numbered choice 1 (quest start) → quest appears in quest log; dialog advances/closes.
- Press E on Mercer → DialogUI opens; "Show me your wares" → vendor grid appears; dialog closes.
- Keyboard 1-9 selects choice; mouse click selects; space skips typewriter.
- Level-gated choice on Elder Cubius (e.g. "Prove yourself" requires lvl ≥ 3) is greyed out + tooltip explains requirement when below level.
- Mobile 390×812: portrait + text legible; choices tap targets ≥44px.
- Compass + HUD tabs hidden during dialog.
- `bun run check` + `bun run typecheck` + tests clean.

## Out of scope

- Voice acting / per-line SFX.
- Animated portraits (static placeholder first).
- Persistent dialog memory (per-NPC affinity, remembered choices).
- Cutscene / scripted sequence dialog.

## Retro
_(filled after merge)_
