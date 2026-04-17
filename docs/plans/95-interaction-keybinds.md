# Plan: #95 — Unified InteractionPrompt + full keybinds system + auto-pickup

**Status:** draft
**Owner agent:** frontend
**Branch:** `feat/interaction-keybinds`

## Context

Three connected UX changes:
1. Unified `<InteractionPrompt>` — same visual for NPC / portal / drop / quest-giver / vendor interactions.
2. Every keybind editable in Settings — no hard-coded keys anywhere in client code. Central `keybindsStore`.
3. Auto-pickup toggle (default ON) — items fly to player on proximity, labels show name only, no prompt.

## Chosen approach

**Keybinds store** (`apps/client/src/state/keybindsStore.ts`)
- zustand + `persist` middleware, key `game.keybinds.v1`.
- Defaults:
  ```ts
  interact: "e",
  moveForward: "w", moveBack: "s", moveLeft: "a", moveRight: "d",
  ability_W1: "1", ability_W2: "2",
  ability_S1: "3", ability_S2: "4",
  ability_U:  "q",
  item_I1: "5", item_I2: "6",
  potion_P1: "7", potion_P2: "8",
  toggle_chat: "t", toggle_inventory: "i", toggle_map: "m",
  toggle_settings: "escape",
  cinematic_skip: "space",
  ```
- API: `useKeybind(action)` → current key. `setKeybind(action, key)` with conflict detection.

**Settings UI**
- New "Keybinds" section — one row per action with "Rebind" button. Rebind button enters capture mode → next keydown commits (validates no conflict). Reset-to-defaults.
- Mobile: show "Desktop only" note; section read-only.

**Audit + migration**
- Grep `event.key === `, `e.code === `, `"e"`, `"KeyE"`, etc. under `apps/client/src/`. Replace every hit with `useKeybind(action)`.
- No hard-coded keys remaining post-PR.

**Unified InteractionPrompt** (`apps/client/src/game/InteractionPrompt.tsx`)
- Props: `{ label, iconKey?, visible }`.
- Renders in a consistent position above the interactable. Uses the configured `interact` key.
- Replaces: NPC-prompt, portal-prompt, drop-prompt (when auto-pickup is off), quest-prompt, vendor-prompt.

**Auto-pickup toggle**
- `preferencesStore.autoPickup: boolean` default `true` (already introduced for cinematic-skip via #88 pattern; extend the same store).
- When ON: server already supports proximity auto-pickup (confirm in GameRoom). Client renders just `{item.name}` label.
- When OFF: Client renders unified InteractionPrompt; pressing the `interact` key sends the interact message.

## Key files

**New**
- `apps/client/src/state/keybindsStore.ts`.
- `apps/client/src/game/InteractionPrompt.tsx`.

**Edit**
- Delete per-kind prompt files.
- `apps/client/src/game/SettingsPanel.tsx` — add "Keybinds" section + "Auto-pickup" toggle.
- Every keyboard listener in `apps/client/src/` — migrate to the store.
- `apps/client/src/state/preferencesStore.ts` — add `autoPickup`.
- `apps/server/src/rooms/GameRoom.ts` — confirm auto-pickup proximity behavior is correct (it already exists; this is a validation).

## Verify

- Rebind Interact E → F. Press F near NPC → interact fires. Press E → nothing.
- Rebind S1 from 3 → Q. Press Q → ability fires.
- Attempting to rebind to a taken key → inline error, rebind blocked.
- Reset → all keys return to defaults.
- Auto-pickup ON: walk near drops → fly to player (anim from #100). Label shows name only.
- Auto-pickup OFF: unified prompt appears, press to pick up.
- Persistence across reload for both keybinds + preferences.
- `bun run check` + `bun run typecheck` clean.

## Out of scope

- Keybind import/export.
- Gamepad bindings.
- Touch-screen UI remap.

## Retro
_(filled after merge)_
