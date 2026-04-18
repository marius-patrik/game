import { getSkill, type SkillDef, type SkillSlot, type SkillSlotKind } from "@game/shared/skills";

export const SKILLS_EQUIPPED_SIZE = 2;

export type AllocationInput = {
  readonly skillId: string;
  readonly slot: SkillSlot;
  readonly playerLevel: number;
  readonly availablePoints: number;
  readonly currentNormal: readonly [string, string];
  readonly currentUltimate: string;
};

export type AllocationResult =
  | {
      ok: true;
      skill: SkillDef;
      slot: SkillSlot;
      pointsSpent: number;
      nextNormal: readonly [string, string];
      nextUltimate: string;
    }
  | {
      ok: false;
      reason:
        | "unknown_skill"
        | "invalid_slot"
        | "level_gate"
        | "insufficient_points"
        | "already_allocated"
        | "slot_kind_mismatch";
    };

/**
 * Validate + compute the state change for an "allocate-skill" request. The
 * caller (GameRoom) applies the returned `next*` arrays to the Player and
 * decrements `skillPoints`. Pure function so it's testable in isolation.
 *
 * Costs:
 *  - Allocating a skill that is NOT currently bound elsewhere spends 1 skill
 *    point.
 *  - Re-binding an already-bound skill (moving it between compatible slots)
 *    is free — the player has already paid. Moving a skill between S1/S2 is
 *    allowed; ultimate slot can't host normal skills and vice versa.
 */
export function validateAllocation(input: AllocationInput): AllocationResult {
  const skill = getSkill(input.skillId);
  if (!skill) return { ok: false, reason: "unknown_skill" };
  if (input.slot !== "S1" && input.slot !== "S2" && input.slot !== "U") {
    return { ok: false, reason: "invalid_slot" };
  }
  const targetKind: SkillSlotKind = input.slot === "U" ? "ultimate" : "normal";
  if (skill.slotKind !== targetKind) return { ok: false, reason: "slot_kind_mismatch" };
  if (input.playerLevel < skill.unlockLevel) return { ok: false, reason: "level_gate" };

  const [n0, n1] = input.currentNormal;
  const currentUlt = input.currentUltimate;
  const alreadyBoundNormal = n0 === skill.id || n1 === skill.id;
  const alreadyBoundUlt = currentUlt === skill.id;
  const alreadyBound = alreadyBoundNormal || alreadyBoundUlt;

  const nextNormal: [string, string] = [n0, n1];
  let nextUlt = currentUlt;

  if (targetKind === "ultimate") {
    if (alreadyBoundUlt) {
      return { ok: false, reason: "already_allocated" };
    }
    if (!alreadyBound && input.availablePoints < skill.costToAllocate) {
      return { ok: false, reason: "insufficient_points" };
    }
    if (alreadyBoundNormal) {
      if (n0 === skill.id) nextNormal[0] = "";
      if (n1 === skill.id) nextNormal[1] = "";
    }
    nextUlt = skill.id;
  } else {
    const slotIdx = input.slot === "S1" ? 0 : 1;
    if (nextNormal[slotIdx] === skill.id) {
      return { ok: false, reason: "already_allocated" };
    }
    if (!alreadyBound && input.availablePoints < skill.costToAllocate) {
      return { ok: false, reason: "insufficient_points" };
    }
    if (alreadyBoundUlt && currentUlt === skill.id) {
      nextUlt = "";
    }
    const other = slotIdx === 0 ? 1 : 0;
    if (nextNormal[other] === skill.id) nextNormal[other] = "";
    nextNormal[slotIdx] = skill.id;
  }

  return {
    ok: true,
    skill,
    slot: input.slot,
    pointsSpent: alreadyBound ? 0 : skill.costToAllocate,
    nextNormal,
    nextUltimate: nextUlt,
  };
}

export type UnbindInput = {
  readonly slot: SkillSlot;
  readonly currentNormal: readonly [string, string];
  readonly currentUltimate: string;
};

export type UnbindResult =
  | {
      ok: true;
      slot: SkillSlot;
      nextNormal: readonly [string, string];
      nextUltimate: string;
    }
  | { ok: false; reason: "invalid_slot" | "empty_slot" };

export function validateUnbind(input: UnbindInput): UnbindResult {
  if (input.slot !== "S1" && input.slot !== "S2" && input.slot !== "U") {
    return { ok: false, reason: "invalid_slot" };
  }
  const [n0, n1] = input.currentNormal;
  if (input.slot === "U") {
    if (input.currentUltimate === "") return { ok: false, reason: "empty_slot" };
    return { ok: true, slot: input.slot, nextNormal: [n0, n1], nextUltimate: "" };
  }
  const idx = input.slot === "S1" ? 0 : 1;
  const current = idx === 0 ? n0 : n1;
  if (current === "") return { ok: false, reason: "empty_slot" };
  const nextNormal: [string, string] = [n0, n1];
  nextNormal[idx] = "";
  return { ok: true, slot: input.slot, nextNormal, nextUltimate: input.currentUltimate };
}
