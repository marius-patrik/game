# Plan: #94 — Hotbar redesign (2W+2S+U+2I+2P)

**Status:** draft
**Owner agent:** frontend
**Branch:** `feat/hotbar-redesign`

## Context

Final hotbar layout per user direction:

```
[W1][W2] | [S1][S2] | [U] | [I1][I2] | [P1][P2]
```

- W1/W2 ← equipped weapon (from #97). Strike/Punch when unarmed.
- S1/S2 ← allocated skills (from #98).
- U ← ultimate (from #98).
- I1/I2 ← drag-drop generic item quick-slots.
- P1/P2 ← dedicated potion slots. P1 = heal_potion, P2 = mana_potion. Auto-populated from inventory, not drag-targeted.

Separators between each group. Ultimate slot visually distinct (larger, glow).

## Depends on

- #93 (HUD skeleton), #97 (weapon ability resolution), #98 (skill dispatch).

## Key files

**Edit**
- `apps/client/src/game/ActionBar.tsx` — full rewrite of slot layout. 9 slot components + separators.
- `apps/client/src/state/keybindsStore.ts` (if #95 landed; else create defaults here and let #95 subsume) — register default keybinds for each slot: 1/2 (W), 3/4 (S), Q (U), 5/6 (I), 7/8 (P).
- `apps/client/src/components/ui/separator.tsx` — already exists in shadcn; use for the dividers.

**New**
- `apps/client/src/game/hotbar/HotbarSlot.tsx` — shared slot UI (icon, cooldown ring, count badge, click handler).
- `apps/client/src/game/hotbar/PotionSlot.tsx` — variant that auto-binds to an inventory item by id + shows count. Consumes on click.

## Verify

- Desktop + mobile: all 9 slots visible centered.
- Equip a sword → W1/W2 populate with its abilities. Unequip → Strike/Punch.
- Allocate a skill to S1 → S1 populates. Clear S1 → empty outline.
- Drag heal_potion into inventory → P1 badge count increments. Click P1 → consumes one.
- Drag an item into I1 → bound. Click → uses.
- Empty slots render dimmed outlines consistent with current style.
- `bun run check` + `bun run typecheck` clean.

## Out of scope

- Keybind config UI (#95).
- Ability animations or VFX.
- Drag-re-ordering between slots.

## Retro
_(filled after merge)_
