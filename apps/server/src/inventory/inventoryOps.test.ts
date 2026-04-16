import { describe, expect, test } from "bun:test";
import { ITEM_CATALOG } from "@game/shared/items";
import { INVENTORY_SLOT_CAP, addItem, countItem, findSlotIndex, removeItem } from "./inventoryOps";

describe("addItem", () => {
  test("rejects unknown item", () => {
    const r = addItem([], "bogus", 1);
    expect(r).toMatchObject({ ok: false, reason: "unknown_item" });
  });

  test("rejects non-positive qty", () => {
    expect(addItem([], "heal_potion", 0)).toMatchObject({ ok: false, reason: "invalid_qty" });
    expect(addItem([], "heal_potion", -1)).toMatchObject({ ok: false, reason: "invalid_qty" });
  });

  test("adds to first matching stack", () => {
    const r = addItem([{ itemId: "heal_potion", qty: 2 }], "heal_potion", 2);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.slots).toEqual([{ itemId: "heal_potion", qty: 4 }]);
      expect(r.added).toBe(4 - 2);
    }
  });

  test("spills to new slot when maxStack reached", () => {
    const max = ITEM_CATALOG.heal_potion.maxStack;
    const r = addItem([{ itemId: "heal_potion", qty: max - 1 }], "heal_potion", 3);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.slots).toEqual([
        { itemId: "heal_potion", qty: max },
        { itemId: "heal_potion", qty: 2 },
      ]);
      expect(r.added).toBe(3);
    }
  });

  test("non-stackable items always go to new slot of 1", () => {
    const r = addItem([{ itemId: "sword", qty: 1 }], "sword", 1);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.slots).toEqual([
        { itemId: "sword", qty: 1 },
        { itemId: "sword", qty: 1 },
      ]);
    }
  });

  test("respects inventory cap", () => {
    const slots = Array.from({ length: INVENTORY_SLOT_CAP }, () => ({ itemId: "sword", qty: 1 }));
    const r = addItem(slots, "sword", 1);
    expect(r).toMatchObject({ ok: false, reason: "inventory_full" });
  });

  test("partial add still succeeds when some fit", () => {
    const slots = Array.from({ length: INVENTORY_SLOT_CAP - 1 }, () => ({
      itemId: "sword",
      qty: 1,
    }));
    const r = addItem(slots, "sword", 3);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.slots).toHaveLength(INVENTORY_SLOT_CAP);
      expect(r.added).toBe(1);
    }
  });
});

describe("removeItem", () => {
  test("rejects when not enough", () => {
    const r = removeItem([{ itemId: "soul", qty: 2 }], "soul", 5);
    expect(r).toMatchObject({ ok: false, reason: "not_enough" });
  });

  test("drains from last slot first and removes empty slots", () => {
    const r = removeItem(
      [
        { itemId: "soul", qty: 5 },
        { itemId: "soul", qty: 3 },
      ],
      "soul",
      4,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.slots).toEqual([{ itemId: "soul", qty: 4 }]);
    }
  });

  test("removes across multiple slots", () => {
    const r = removeItem(
      [
        { itemId: "soul", qty: 2 },
        { itemId: "soul", qty: 2 },
      ],
      "soul",
      3,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.slots).toEqual([{ itemId: "soul", qty: 1 }]);
    }
  });
});

describe("helpers", () => {
  test("countItem sums across slots", () => {
    expect(
      countItem(
        [
          { itemId: "soul", qty: 2 },
          { itemId: "heal_potion", qty: 3 },
          { itemId: "soul", qty: 5 },
        ],
        "soul",
      ),
    ).toBe(7);
  });

  test("findSlotIndex skips empty stacks", () => {
    expect(
      findSlotIndex(
        [
          { itemId: "sword", qty: 0 },
          { itemId: "sword", qty: 1 },
        ],
        "sword",
      ),
    ).toBe(1);
  });
});
