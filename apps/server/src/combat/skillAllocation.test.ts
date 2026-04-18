import { describe, expect, test } from "bun:test";
import { validateAllocation, validateUnbind } from "./skillAllocation";

const EMPTY: readonly [string, string] = ["", ""];

describe("validateAllocation", () => {
  test("rejects unknown skill id", () => {
    const r = validateAllocation({
      skillId: "nope",
      slot: "S1",
      playerLevel: 10,
      availablePoints: 5,
      currentNormal: EMPTY,
      currentUltimate: "",
    });
    expect(r).toEqual({ ok: false, reason: "unknown_skill" });
  });

  test("rejects invalid slot", () => {
    const r = validateAllocation({
      skillId: "skill_cleave",
      slot: "X" as never,
      playerLevel: 10,
      availablePoints: 5,
      currentNormal: EMPTY,
      currentUltimate: "",
    });
    expect(r).toEqual({ ok: false, reason: "invalid_slot" });
  });

  test("rejects level-gated skills", () => {
    const r = validateAllocation({
      skillId: "skill_shield",
      slot: "S1",
      playerLevel: 1,
      availablePoints: 10,
      currentNormal: EMPTY,
      currentUltimate: "",
    });
    expect(r).toEqual({ ok: false, reason: "level_gate" });
  });

  test("rejects ultimate into normal slot", () => {
    const r = validateAllocation({
      skillId: "skill_meteor",
      slot: "S1",
      playerLevel: 10,
      availablePoints: 10,
      currentNormal: EMPTY,
      currentUltimate: "",
    });
    expect(r).toEqual({ ok: false, reason: "slot_kind_mismatch" });
  });

  test("rejects normal into ultimate slot", () => {
    const r = validateAllocation({
      skillId: "skill_cleave",
      slot: "U",
      playerLevel: 10,
      availablePoints: 10,
      currentNormal: EMPTY,
      currentUltimate: "",
    });
    expect(r).toEqual({ ok: false, reason: "slot_kind_mismatch" });
  });

  test("rejects insufficient points for fresh skill", () => {
    const r = validateAllocation({
      skillId: "skill_cleave",
      slot: "S1",
      playerLevel: 10,
      availablePoints: 0,
      currentNormal: EMPTY,
      currentUltimate: "",
    });
    expect(r).toEqual({ ok: false, reason: "insufficient_points" });
  });

  test("ok: binds a fresh normal skill, spends 1 point", () => {
    const r = validateAllocation({
      skillId: "skill_cleave",
      slot: "S1",
      playerLevel: 5,
      availablePoints: 1,
      currentNormal: EMPTY,
      currentUltimate: "",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pointsSpent).toBe(1);
    expect(r.nextNormal).toEqual(["skill_cleave", ""]);
  });

  test("ok: ultimate allocation", () => {
    const r = validateAllocation({
      skillId: "skill_meteor",
      slot: "U",
      playerLevel: 10,
      availablePoints: 1,
      currentNormal: EMPTY,
      currentUltimate: "",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nextUltimate).toBe("skill_meteor");
    expect(r.nextNormal).toEqual(["", ""]);
  });

  test("moving an already-bound skill between S1/S2 is free", () => {
    const r = validateAllocation({
      skillId: "skill_cleave",
      slot: "S2",
      playerLevel: 5,
      availablePoints: 0,
      currentNormal: ["skill_cleave", ""],
      currentUltimate: "",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pointsSpent).toBe(0);
    expect(r.nextNormal).toEqual(["", "skill_cleave"]);
  });

  test("rejects allocating to the slot it already occupies", () => {
    const r = validateAllocation({
      skillId: "skill_cleave",
      slot: "S1",
      playerLevel: 5,
      availablePoints: 0,
      currentNormal: ["skill_cleave", ""],
      currentUltimate: "",
    });
    expect(r).toEqual({ ok: false, reason: "already_allocated" });
  });

  test("second skill fills S2 without dropping S1", () => {
    const r = validateAllocation({
      skillId: "skill_bolt",
      slot: "S2",
      playerLevel: 5,
      availablePoints: 1,
      currentNormal: ["skill_cleave", ""],
      currentUltimate: "",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pointsSpent).toBe(1);
    expect(r.nextNormal).toEqual(["skill_cleave", "skill_bolt"]);
  });

  test("overwriting S1 with a different skill still costs a point", () => {
    const r = validateAllocation({
      skillId: "skill_bolt",
      slot: "S1",
      playerLevel: 5,
      availablePoints: 1,
      currentNormal: ["skill_cleave", ""],
      currentUltimate: "",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pointsSpent).toBe(1);
    expect(r.nextNormal).toEqual(["skill_bolt", ""]);
  });
});

describe("validateUnbind", () => {
  test("rejects invalid slot", () => {
    const r = validateUnbind({
      slot: "Z" as never,
      currentNormal: EMPTY,
      currentUltimate: "",
    });
    expect(r).toEqual({ ok: false, reason: "invalid_slot" });
  });

  test("rejects empty slot", () => {
    const r = validateUnbind({
      slot: "S1",
      currentNormal: EMPTY,
      currentUltimate: "",
    });
    expect(r).toEqual({ ok: false, reason: "empty_slot" });
  });

  test("ok: clears the occupied normal slot", () => {
    const r = validateUnbind({
      slot: "S1",
      currentNormal: ["skill_cleave", "skill_bolt"],
      currentUltimate: "",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nextNormal).toEqual(["", "skill_bolt"]);
  });

  test("ok: clears the ultimate slot", () => {
    const r = validateUnbind({
      slot: "U",
      currentNormal: EMPTY,
      currentUltimate: "skill_meteor",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nextUltimate).toBe("");
  });
});
