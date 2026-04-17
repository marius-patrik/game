# Plan: #97 — Equipment slots + weapon-driven primary/secondary attacks

**Status:** shipped
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

- **Effective vs. base stats**: to make `Player.strength/dex/vit/int` reflect "what combat and the HUD use" while the stat-point allocator still raises only the underlying roll, I added new `baseStrength/baseDexterity/baseVitality/baseIntellect` schema fields. `strength = baseStrength + equipment bonus` is recomputed in `recomputeDerivedStats()`; persistence stores the base. No DB migration needed — the `character_progress.strength` column keeps its meaning (raw base points).
- **Abilities are a second cooldown map** alongside `skillCds`. `handleCast` still owns S1-S2-U (heal/dash today), `handleUseAbility` owns W1/W2. They share damage tracking, rate-limiter bucket, and the `resolveAttack` helper, but keep separate cooldown state + separate broadcast events (`ability-cast` / `skill-cast`). Didn't collapse them — skills have fixed id/color/range while weapon abilities depend on equipment, so a unified cooldown map would have to key by string both ways anyway.
- **Ability kinds dispatched to existing helpers**: melee/ranged reuse `resolveAttack` (single target); aoe reuses `mobSystem.applyRadialDamage`; movement does dash-plus-aoe-on-landing. `self` is plumbed through but currently unused (kept for future armor/ring procs).
- **Legacy `equip` handler preserved** so `apps/server/src/admin*` and any saved-game `equippedItemId` path still work — it now writes to `equipment.weapon` too and calls `recomputeDerivedStats`. The dual field (`equippedItemId` + `equipment.weapon`) is a legacy shim; future work can collapse it once the admin panel's equip UI migrates.
- **Ring counted for set-of-equipped-ids** for the hotbar "amber ring" indicator. Previously the UI only highlighted the item matching `equippedItemId`; now it highlights anything in any equipment slot.
- **Preview verification**: the running preview serves from a different worktree. Smoke test needs to happen after the PR's branch is pulled into the preview worktree (`git fetch && git reset --hard origin/feat/equipment-weapon-abilities`). Flagged in the PR body.

