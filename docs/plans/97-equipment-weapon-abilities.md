# Plan: #97 — Equipment slots + weapon-driven primary/secondary attacks

**Status:** draft
**Owner agent:** execution (generalist — cuts shared + server + client)
**Branch:** `feat/equipment-weapon-abilities`

## Context

Ships a proper equipment system + a weapon-driven ability replacement for the hotbar's W1/W2 slots. Depends on #96 (character) for `characterId` keyed persistence.

## Chosen approach

- **Central abilities registry** in `packages/shared/src/abilities.ts`. Each ability: `id`, `name`, `cooldownMs`, `manaCost`, `damage`, `range`, `kind` ("melee" | "ranged" | "aoe"), optional `animationKey`.
- **Item registry extension**: each weapon declares `primaryAbilityId` + `secondaryAbilityId`. Armor / ring declare `statBonuses: { strength?, ... }`.
- **Equipment slots** on `Player.equipment` Colyseus MapSchema (already exists for stats work): `weapon | armor | ring` (expandable).
- **Basic unarmed defaults**: `strike` (primary) + `punch` (secondary) — always available when weapon slot is empty.
- **Server-side ability dispatch**: client sends `{ slot: "W1" | "W2" | "S1" | ... }`. Server resolves to an ability id via equipment/skills/ultimate tables, validates cooldown + mana, executes.

## Key files

**New**
- `packages/shared/src/abilities.ts` — registry + types (`AbilityId`, `AbilityDef`, `AbilitySlot`).
- `apps/server/src/combat/abilityDispatch.ts` — slot → ability resolution + execution (extracted from current ActionBar-side logic if any).

**Edit**
- `packages/shared/src/items.ts` — weapon item defs gain `primaryAbilityId` + `secondaryAbilityId`. Armor/ring gain `statBonuses`.
- `packages/shared/src/schema.ts` — no shape change; `Player.equipment` already `MapSchema<string>`.
- `apps/server/src/rooms/GameRoom.ts`:
  - New `onMessage("equip", { slot, itemId })` + `onMessage("unequip", { slot })` + `onMessage("use-ability", { slot })`.
  - Stat recomputation runs on equip/unequip → updates `Player.strength/dexterity/vitality/intellect` live.
  - Validate slot kind vs. item kind on equip.
- `apps/client/src/game/InventoryPanel.tsx` (likely renamed from existing inventory UI) — new equipment slot grid above the generic inventory grid. Drag-drop between slots + inventory.
- `apps/client/src/game/ActionBar.tsx` — W1/W2 icons now read from `equipment.weapon` → abilities map. Strike/Punch fallback when empty.
- Tests: equip validation, stat recompute, ability swap on equip.

## Starter content

- ≥3 weapons: sword (slash/thrust), staff (bolt/blast), dagger (quickstrike/dash-strike).
- ≥2 armors (light → +1 dex, heavy → +3 vit -1 dex).
- ≥2 rings (flame → +2 int, guard → +2 str).
- Retrofit existing `sword` / `greataxe` to use ability ids from the registry.

## Verify

- Equip sword → W1/W2 show slash/thrust. Unequip → Strike/Punch return.
- Equip armor → stats update live on HUD.
- Server rejects wrong-slot equip (sword into armor slot → 400).
- Persistence: equip → reload → still equipped.
- `bun run check` + `bun run typecheck` + tests clean.

## Out of scope

- Weapon tiers / rarity system.
- Transmog / appearance-decoupling.
- Set bonuses.
- Durability / repair.

## Retro
_(filled after merge)_
