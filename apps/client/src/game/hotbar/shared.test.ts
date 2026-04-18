import { describe, expect, test } from "bun:test";
import { abbreviateHotbarLabel, canBindItemToHotbar, countInventoryItem } from "./shared";

describe("hotbar helpers", () => {
  test("abbreviates single-word and multi-word labels cleanly", () => {
    expect(abbreviateHotbarLabel("Slash")).toBe("SL");
    expect(abbreviateHotbarLabel("Heal Potion")).toBe("HP");
    expect(abbreviateHotbarLabel("Dash-Strike")).toBe("DS");
  });

  test("counts items across multiple inventory stacks", () => {
    expect(
      countInventoryItem(
        [
          { itemId: "heal_potion", qty: 3 },
          { itemId: "mana_potion", qty: 2 },
          { itemId: "heal_potion", qty: 1 },
        ],
        "heal_potion",
      ),
    ).toBe(4);
  });

  test("only consumables and equippables can bind into quick slots", () => {
    expect(canBindItemToHotbar("heal_potion")).toBe(true);
    expect(canBindItemToHotbar("sword")).toBe(true);
    expect(canBindItemToHotbar("soul")).toBe(false);
  });
});
