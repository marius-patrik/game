import { describe, expect, test } from "bun:test";
import { type EquipmentView, checkAbilityReady, resolveWeaponAbility } from "./abilityDispatch";

function equip(weapon?: string): EquipmentView {
  return {
    get: (slot) => (slot === "weapon" ? weapon : undefined),
  };
}

describe("resolveWeaponAbility", () => {
  test("unarmed → strike on W1, punch on W2", () => {
    const e = equip();
    expect(resolveWeaponAbility(e, "W1")?.id).toBe("strike");
    expect(resolveWeaponAbility(e, "W2")?.id).toBe("punch");
  });

  test("sword → slash / thrust", () => {
    const e = equip("sword");
    expect(resolveWeaponAbility(e, "W1")?.id).toBe("slash");
    expect(resolveWeaponAbility(e, "W2")?.id).toBe("thrust");
  });

  test("staff → bolt / blast", () => {
    const e = equip("staff");
    expect(resolveWeaponAbility(e, "W1")?.id).toBe("bolt");
    expect(resolveWeaponAbility(e, "W2")?.id).toBe("blast");
  });

  test("dagger → quickstrike / dash_strike", () => {
    const e = equip("dagger");
    expect(resolveWeaponAbility(e, "W1")?.id).toBe("quickstrike");
    expect(resolveWeaponAbility(e, "W2")?.id).toBe("dash_strike");
  });

  test("greataxe → cleave / heavy_chop", () => {
    const e = equip("greataxe");
    expect(resolveWeaponAbility(e, "W1")?.id).toBe("cleave");
    expect(resolveWeaponAbility(e, "W2")?.id).toBe("heavy_chop");
  });

  test("unknown weapon id falls back to unarmed", () => {
    const e = equip("not_a_real_weapon_id");
    expect(resolveWeaponAbility(e, "W1")?.id).toBe("strike");
  });

  test("non-weapon in weapon slot falls back to unarmed", () => {
    // A defensive check — equip validation should prevent this, but the
    // resolver should never crash on bad data.
    const e = equip("helm");
    expect(resolveWeaponAbility(e, "W1")?.id).toBe("strike");
  });
});

describe("checkAbilityReady", () => {
  const ability = { id: "slash", name: "Slash", cooldownMs: 600, manaCost: 0 } as Parameters<
    typeof checkAbilityReady
  >[0]["ability"];

  test("ok when alive, not on cooldown, enough mana", () => {
    const r = checkAbilityReady({ ability, now: 1000, readyAt: 500, mana: 50, alive: true });
    expect(r.ok).toBe(true);
  });

  test("rejects dead caster", () => {
    const r = checkAbilityReady({ ability, now: 1000, readyAt: 500, mana: 50, alive: false });
    expect(r).toEqual({ ok: false, reason: "dead" });
  });

  test("rejects cooldown", () => {
    const r = checkAbilityReady({ ability, now: 1000, readyAt: 1500, mana: 50, alive: true });
    expect(r).toEqual({ ok: false, reason: "cooldown" });
  });

  test("rejects insufficient mana", () => {
    const costly = { ...ability!, manaCost: 25 } as typeof ability;
    const r = checkAbilityReady({
      ability: costly,
      now: 1000,
      readyAt: 500,
      mana: 5,
      alive: true,
    });
    expect(r).toEqual({ ok: false, reason: "mana" });
  });

  test("rejects unknown ability", () => {
    const r = checkAbilityReady({
      ability: undefined,
      now: 1000,
      readyAt: 500,
      mana: 5,
      alive: true,
    });
    expect(r).toEqual({ ok: false, reason: "unknown_ability" });
  });
});
