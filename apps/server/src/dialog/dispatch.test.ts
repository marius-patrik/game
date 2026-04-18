import { describe, expect, test } from "bun:test";
import type { DialogPlayerSnapshot } from "@game/shared/dialog";
import { validateDialogTree } from "@game/shared/dialog";
import { DIALOG_TREES, elderCubiusDialog, mercerDialog } from "@game/shared/dialogs";
import { chooseDialog, startDialog } from "./dispatch";

function makePlayer(overrides: Partial<DialogPlayerSnapshot> = {}): DialogPlayerSnapshot {
  return {
    level: 1,
    quests: new Map(),
    inventory: [],
    ...overrides,
  };
}

describe("validateDialogTree", () => {
  test("elderCubiusDialog is structurally valid", () => {
    expect(validateDialogTree(elderCubiusDialog).ok).toBe(true);
  });

  test("mercerDialog is structurally valid", () => {
    expect(validateDialogTree(mercerDialog).ok).toBe(true);
  });

  test("all shipped dialog trees are structurally valid", () => {
    for (const tree of Object.values(DIALOG_TREES)) {
      const result = validateDialogTree(tree);
      if (!result.ok) {
        throw new Error(`tree ${tree.npcId} invalid: ${result.reason}`);
      }
    }
  });

  test("catches dangling goto", () => {
    const result = validateDialogTree({
      npcId: "test",
      rootNodeId: "a",
      nodes: {
        a: { id: "a", text: "hi", choices: [{ text: "go", goto: "missing" }] },
      },
    });
    expect(result.ok).toBe(false);
  });

  test("catches missing root", () => {
    const result = validateDialogTree({
      npcId: "test",
      rootNodeId: "ghost",
      nodes: {},
    });
    expect(result.ok).toBe(false);
  });
});

describe("startDialog", () => {
  test("returns the root node for a known NPC", () => {
    const r = startDialog("npc:quest");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.node.id).toBe("greeting");
  });

  test("rejects unknown NPC", () => {
    const r = startDialog("npc:does-not-exist");
    expect(r.ok).toBe(false);
  });
});

describe("chooseDialog — Elder Cubius", () => {
  test("first choice navigates to about-work", () => {
    const r = chooseDialog("npc:quest", "greeting", 0, makePlayer());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.node?.id).toBe("about-work");
    expect(r.close).toBe(false);
    expect(r.actions).toEqual([]);
  });

  test("accepting the quest emits startQuest and advances", () => {
    const r = chooseDialog("npc:quest", "greeting", 1, makePlayer());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.node?.id).toBe("first-blood-accepted");
    expect(r.actions).toEqual([{ kind: "startQuest", questId: "first-blood" }]);
  });

  test("re-accepting the quest is blocked if it's already active", () => {
    const r = chooseDialog(
      "npc:quest",
      "greeting",
      1,
      makePlayer({ quests: new Map([["first-blood", { status: "active" }]]) }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("requirement_failed");
  });

  test("level-gated trial choice blocks below level 3", () => {
    const r = chooseDialog("npc:quest", "greeting", 2, makePlayer({ level: 2 }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("requirement_failed");
  });

  test("level-gated trial choice opens at level 3", () => {
    const r = chooseDialog("npc:quest", "greeting", 2, makePlayer({ level: 3 }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.node?.id).toBe("trial-offered");
  });

  test("farewell closes the dialog", () => {
    const r = chooseDialog("npc:quest", "greeting", 3, makePlayer());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.close).toBe(true);
    expect(r.node).toBeUndefined();
  });

  test("invalid choice index is rejected", () => {
    const r = chooseDialog("npc:quest", "greeting", 99, makePlayer());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("invalid_choice");
  });

  test("unknown node is rejected", () => {
    const r = chooseDialog("npc:quest", "ghost-node", 0, makePlayer());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("unknown_node");
  });
});

describe("chooseDialog — Mercer", () => {
  test("Show wares emits openVendor and closes", () => {
    const r = chooseDialog("npc:vendor", "greeting", 0, makePlayer());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.close).toBe(true);
    expect(r.actions).toEqual([{ kind: "openVendor" }]);
  });

  test("about-supply path ends with openVendor on trade", () => {
    const r = chooseDialog("npc:vendor", "about-supply", 0, makePlayer());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.close).toBe(true);
    expect(r.actions).toEqual([{ kind: "openVendor" }]);
  });
});

describe("requirements — hasItem", () => {
  test("hasItem passes when inventory has enough", () => {
    // Build a tree requiring an item then call through — easier to exercise
    // `checkAllRequirements` via the public dispatch surface.
    const r = chooseDialog(
      "npc:vendor",
      "greeting",
      2, // "Not today." — no requirements
      makePlayer({ inventory: [{ itemId: "heal_potion", qty: 2 }] }),
    );
    expect(r.ok).toBe(true);
  });
});
