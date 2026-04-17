# Plan: #98 — Skill allocator + skills tab + ultimate slot

**Status:** draft
**Owner agent:** execution (generalist)
**Branch:** `feat/skills-ultimate`

## Context

Players earn skill points on level-up; can bind skills to S1/S2 slots and a single Ultimate slot. Skills tab renders a catalog with bind actions. Class-less — no per-class gating.

Depends on #97 (abilities registry).

## Chosen approach

- **Skills registry** (`packages/shared/src/skills.ts`): each skill references an `abilityId` from #97's registry + adds `unlockLevel`, `costToAllocate` (default 1 point), `allowedSlot: "normal" | "ultimate" | "any"`.
- **Schema additions**:
  - `Player.skillsEquipped: ArraySchema<string>` (length 2, skill ids or empty).
  - `Player.ultimateSkill: string` (skill id or empty).
  - `Player.skillPoints: number` (+1 on level-up).
  - Persisted via `character_progress` — extend the reconciler to add `skills_equipped_json`, `ultimate_skill`, `skill_points` columns (all nullable / defaulted).
- **Server**:
  - `onMessage("allocate-skill", { skillId, slot })` — validates level + unused points + slot compat. Commits + persists.
  - Level-up hook awards skill point.
  - Ability dispatch for S1/S2/U slots reads from these new fields.
- **Client**:
  - "Skills" tab in SidePanel — renders ≥6 skills + ≥2 ultimates as cards. Bind buttons. Locked skills show unlock-level hint.
  - ActionBar: S1/S2 icons read `skillsEquipped`, U reads `ultimateSkill`. All dispatch via existing cooldown UI.

## Starter skill catalog

- Normal: Cleave (lvl 2), Dash (lvl 3), Heal (lvl 4), Bolt (lvl 2), Shield (lvl 5), Regen (lvl 4).
- Ultimate: Meteor (lvl 6), Blink (lvl 8).

## Key files

**New**
- `packages/shared/src/skills.ts`
- `apps/client/src/game/SkillsTab.tsx`
- `apps/server/src/combat/skillAllocation.ts` — validation + mutation.
- `apps/server/src/rooms/systems/levelUp.ts` — if not already extracted from GameRoom; grant skill point.

**Edit**
- `packages/shared/src/schema.ts` — add the three new `Player` fields.
- `apps/server/src/db/reconcile.ts` — add columns.
- `apps/server/src/db/character.ts` (from #96) — load/save the new columns.
- `apps/server/src/rooms/GameRoom.ts` — wire `onMessage("allocate-skill")`, wire dispatch for S1/S2/U.
- `apps/client/src/game/SidePanel.tsx` — add the Skills tab entry.
- `apps/client/src/game/ActionBar.tsx` — S1/S2/U slots consume the new fields.

## Verify

- Level up → `skillPoints += 1` visible.
- Allocate Cleave to S1 → S1 hotbar shows Cleave → using it consumes mana + triggers cooldown.
- Ultimate has a longer cooldown visualization (larger ring, distinct color).
- Unbinding a skill frees its slot + un-dispatches.
- Persistence across reload + server restart.
- `bun run check` + `bun run typecheck` + tests clean.

## Out of scope

- Respec / refund.
- Passive skills.
- Skill-tier ups / ranks.
- Per-class gating.

## Retro
_(filled after merge)_
