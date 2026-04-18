import { describe, expect, test } from "bun:test";
import {
  closeFloatingWindowInLayout,
  createDefaultLayout,
  floatTabInLayout,
  moveTabInLayout,
  reconcileLayout,
  restoreTabInLayout,
} from "./layoutStore";

describe("layoutStore helpers", () => {
  test("reconcileLayout preserves persisted placement and appends new tabs", () => {
    const base = createDefaultLayout({
      defaultWindowId: "dock",
      tabIds: ["map", "quests", "chat"],
    });
    const floated = floatTabInLayout(base, "dock", "chat", { x: 480, y: 72 }, { w: 320, h: 360 });
    const reconciled = reconcileLayout(floated, {
      defaultWindowId: "dock",
      tabIds: ["map", "quests", "chat", "skills"],
    });

    expect(reconciled.windows.dock?.tabs).toEqual(["map", "quests", "skills"]);
    expect(reconciled.windows["floating-1"]?.tabs).toEqual(["chat"]);
  });

  test("moveTabInLayout reorders within a window and activates the moved tab", () => {
    const base = createDefaultLayout({
      defaultWindowId: "dock",
      tabIds: ["map", "quests", "chat"],
    });
    const moved = moveTabInLayout(base, "dock", "dock", "chat", 0);

    expect(moved.windows.dock?.tabs).toEqual(["chat", "map", "quests"]);
    expect(moved.windows.dock?.activeTab).toBe("chat");
  });

  test("closeFloatingWindowInLayout hides the tab and restoreTabInLayout docks it back home", () => {
    const base = createDefaultLayout({
      defaultWindowId: "dock",
      tabIds: ["map", "quests", "chat"],
    });
    const floated = floatTabInLayout(base, "dock", "chat", { x: 480, y: 72 }, { w: 320, h: 360 });
    const closed = closeFloatingWindowInLayout(floated, "floating-1");
    const restored = restoreTabInLayout(closed, "chat");

    expect(closed.hiddenTabs).toEqual(["chat"]);
    expect(closed.windows["floating-1"]).toBeUndefined();
    expect(restored.hiddenTabs).toEqual([]);
    expect(restored.windows.dock?.tabs).toEqual(["map", "quests", "chat"]);
    expect(restored.windows.dock?.activeTab).toBe("chat");
  });

  test("moveTabInLayout merges into a floating window and prunes the old floating source when emptied", () => {
    const base = createDefaultLayout({
      defaultWindowId: "dock",
      tabIds: ["map", "quests", "chat"],
    });
    const withMapFloating = floatTabInLayout(
      base,
      "dock",
      "map",
      { x: 240, y: 72 },
      { w: 320, h: 360 },
    );
    const withChatFloating = floatTabInLayout(
      withMapFloating,
      "dock",
      "chat",
      { x: 640, y: 72 },
      { w: 320, h: 360 },
    );
    const merged = moveTabInLayout(withChatFloating, "floating-2", "floating-1", "chat", 1);

    expect(merged.windows["floating-1"]?.tabs).toEqual(["map", "chat"]);
    expect(merged.windows["floating-1"]?.activeTab).toBe("chat");
    expect(merged.windows["floating-2"]).toBeUndefined();
  });
});
