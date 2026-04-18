import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type LayoutPoint = {
  x: number;
  y: number;
};

export type LayoutSize = {
  w: number;
  h: number;
};

export type LayoutWindow = {
  id: string;
  tabs: string[];
  activeTab: string | null;
  floating: boolean;
  pos?: LayoutPoint;
  size?: LayoutSize;
};

export type WindowLayout = {
  defaultWindowId: string;
  nextWindowIndex: number;
  windowOrder: string[];
  windows: Record<string, LayoutWindow>;
  hiddenTabs: string[];
  homeWindowByTab: Record<string, string>;
};

export type LayoutConfig = {
  defaultWindowId: string;
  tabIds: string[];
};

const LAYOUT_STORE_KEY = "game.layout.v1";

function removeFromArray(values: string[], value: string): string[] {
  return values.filter((entry) => entry !== value);
}

function insertAt(values: string[], value: string, index: number): string[] {
  const next = removeFromArray(values, value);
  const bounded = Math.max(0, Math.min(index, next.length));
  next.splice(bounded, 0, value);
  return next;
}

function getNextActiveTab(tabs: string[], previousActive: string | null): string | null {
  if (tabs.length === 0) return null;
  if (previousActive && tabs.includes(previousActive)) return previousActive;
  return tabs[0] ?? null;
}

function createWindow(
  id: string,
  tabs: string[],
  floating: boolean,
  extras?: Pick<LayoutWindow, "pos" | "size">,
): LayoutWindow {
  return {
    id,
    tabs,
    activeTab: tabs[0] ?? null,
    floating,
    ...extras,
  };
}

export function createDefaultLayout(config: LayoutConfig): WindowLayout {
  const homeWindowByTab = Object.fromEntries(
    config.tabIds.map((tabId) => [tabId, config.defaultWindowId]),
  );
  return {
    defaultWindowId: config.defaultWindowId,
    nextWindowIndex: 1,
    windowOrder: [config.defaultWindowId],
    windows: {
      [config.defaultWindowId]: createWindow(config.defaultWindowId, [...config.tabIds], false),
    },
    hiddenTabs: [],
    homeWindowByTab,
  };
}

export function reconcileLayout(
  layout: WindowLayout | undefined,
  config: LayoutConfig,
): WindowLayout {
  const fallback = createDefaultLayout(config);
  if (!layout) return fallback;

  const validTabs = new Set(config.tabIds);
  const seenTabs = new Set<string>();
  const windows: Record<string, LayoutWindow> = {};
  const windowOrder: string[] = [];

  const inputOrder = layout.windowOrder.includes(config.defaultWindowId)
    ? layout.windowOrder
    : [config.defaultWindowId, ...layout.windowOrder];

  for (const windowId of inputOrder) {
    const window = layout.windows[windowId];
    const isDefaultWindow = windowId === config.defaultWindowId;
    if (!window && !isDefaultWindow) continue;

    const nextTabs = (window?.tabs ?? []).filter((tabId) => {
      if (!validTabs.has(tabId) || seenTabs.has(tabId)) return false;
      seenTabs.add(tabId);
      return true;
    });

    if (nextTabs.length === 0 && !isDefaultWindow) continue;

    const nextWindow: LayoutWindow = {
      id: windowId,
      tabs: nextTabs,
      activeTab: getNextActiveTab(nextTabs, window?.activeTab ?? null),
      floating: isDefaultWindow ? false : (window?.floating ?? false),
      pos: window?.pos,
      size: window?.size,
    };

    windows[windowId] = nextWindow;
    windowOrder.push(windowId);
  }

  if (!windows[config.defaultWindowId]) {
    windows[config.defaultWindowId] = createWindow(config.defaultWindowId, [], false);
    windowOrder.unshift(config.defaultWindowId);
  } else {
    const defaultWindow =
      windows[config.defaultWindowId] ?? createWindow(config.defaultWindowId, [], false);
    windows[config.defaultWindowId] = {
      ...defaultWindow,
      floating: false,
    };
  }

  const defaultWindow =
    windows[config.defaultWindowId] ?? createWindow(config.defaultWindowId, [], false);
  windows[config.defaultWindowId] = defaultWindow;

  const hiddenTabs = layout.hiddenTabs.filter((tabId) => {
    if (!validTabs.has(tabId) || seenTabs.has(tabId)) return false;
    seenTabs.add(tabId);
    return true;
  });

  const missingTabs = config.tabIds.filter((tabId) => !seenTabs.has(tabId));
  if (missingTabs.length > 0) {
    defaultWindow.tabs = [...defaultWindow.tabs, ...missingTabs];
    defaultWindow.activeTab = defaultWindow.activeTab ?? defaultWindow.tabs[0] ?? null;
  }

  const homeWindowByTab = { ...layout.homeWindowByTab };
  for (const tabId of config.tabIds) {
    const homeWindowId = homeWindowByTab[tabId];
    if (!homeWindowId || !windows[homeWindowId] || windows[homeWindowId].floating) {
      homeWindowByTab[tabId] = config.defaultWindowId;
    }
  }

  return {
    defaultWindowId: config.defaultWindowId,
    nextWindowIndex: Math.max(layout.nextWindowIndex, 1),
    windowOrder,
    windows,
    hiddenTabs,
    homeWindowByTab,
  };
}

function withWindow(
  layout: WindowLayout,
  windowId: string,
  updater: (window: LayoutWindow) => LayoutWindow,
) {
  const window = layout.windows[windowId];
  if (!window) return layout;
  return {
    ...layout,
    windows: {
      ...layout.windows,
      [windowId]: updater(window),
    },
  };
}

function pruneWindow(layout: WindowLayout, windowId: string): WindowLayout {
  const window = layout.windows[windowId];
  if (!window || !window.floating) return layout;

  const nextWindows = { ...layout.windows };
  delete nextWindows[windowId];

  return {
    ...layout,
    windowOrder: layout.windowOrder.filter((id) => id !== windowId),
    windows: nextWindows,
  };
}

export function activateTabInLayout(
  layout: WindowLayout,
  windowId: string,
  tabId: string,
): WindowLayout {
  return withWindow(layout, windowId, (window) =>
    window.tabs.includes(tabId) ? { ...window, activeTab: tabId } : window,
  );
}

export function bringWindowToFrontInLayout(layout: WindowLayout, windowId: string): WindowLayout {
  const window = layout.windows[windowId];
  if (!window?.floating) return layout;
  return {
    ...layout,
    windowOrder: [...layout.windowOrder.filter((id) => id !== windowId), windowId],
  };
}

export function moveTabInLayout(
  layout: WindowLayout,
  sourceWindowId: string,
  targetWindowId: string,
  tabId: string,
  targetIndex: number,
): WindowLayout {
  const sourceWindow = layout.windows[sourceWindowId];
  const targetWindow = layout.windows[targetWindowId];
  if (!sourceWindow || !targetWindow || !sourceWindow.tabs.includes(tabId)) return layout;

  const nextSourceTabs = removeFromArray(sourceWindow.tabs, tabId);
  const nextTargetTabs =
    sourceWindowId === targetWindowId
      ? insertAt(sourceWindow.tabs, tabId, targetIndex)
      : insertAt(targetWindow.tabs, tabId, targetIndex);

  let nextLayout: WindowLayout = {
    ...layout,
    hiddenTabs: removeFromArray(layout.hiddenTabs, tabId),
    windows: {
      ...layout.windows,
      [sourceWindowId]:
        sourceWindowId === targetWindowId
          ? {
              ...sourceWindow,
              tabs: nextTargetTabs,
              activeTab: tabId,
            }
          : {
              ...sourceWindow,
              tabs: nextSourceTabs,
              activeTab: getNextActiveTab(nextSourceTabs, sourceWindow.activeTab),
            },
      [targetWindowId]:
        sourceWindowId === targetWindowId
          ? {
              ...targetWindow,
              tabs: nextTargetTabs,
              activeTab: tabId,
            }
          : {
              ...targetWindow,
              tabs: nextTargetTabs,
              activeTab: tabId,
            },
    },
    homeWindowByTab:
      sourceWindowId !== targetWindowId && !targetWindow.floating
        ? {
            ...layout.homeWindowByTab,
            [tabId]: targetWindowId,
          }
        : layout.homeWindowByTab,
  };

  if (sourceWindowId !== targetWindowId && nextSourceTabs.length === 0) {
    nextLayout = pruneWindow(nextLayout, sourceWindowId);
  }

  return nextLayout;
}

export function floatTabInLayout(
  layout: WindowLayout,
  sourceWindowId: string,
  tabId: string,
  pos: LayoutPoint,
  size: LayoutSize,
): WindowLayout {
  const sourceWindow = layout.windows[sourceWindowId];
  if (!sourceWindow || !sourceWindow.tabs.includes(tabId)) return layout;

  const nextSourceTabs = removeFromArray(sourceWindow.tabs, tabId);
  const floatingWindowId = `floating-${layout.nextWindowIndex}`;
  let nextLayout: WindowLayout = {
    ...layout,
    nextWindowIndex: layout.nextWindowIndex + 1,
    hiddenTabs: removeFromArray(layout.hiddenTabs, tabId),
    windowOrder: [...layout.windowOrder, floatingWindowId],
    windows: {
      ...layout.windows,
      [sourceWindowId]: {
        ...sourceWindow,
        tabs: nextSourceTabs,
        activeTab: getNextActiveTab(nextSourceTabs, sourceWindow.activeTab),
      },
      [floatingWindowId]: {
        id: floatingWindowId,
        tabs: [tabId],
        activeTab: tabId,
        floating: true,
        pos,
        size,
      },
    },
  };

  if (nextSourceTabs.length === 0) {
    nextLayout = pruneWindow(nextLayout, sourceWindowId);
  }

  return nextLayout;
}

export function closeFloatingWindowInLayout(layout: WindowLayout, windowId: string): WindowLayout {
  const window = layout.windows[windowId];
  if (!window?.floating || window.tabs.length !== 1) return layout;

  const [tabId] = window.tabs;
  if (!tabId) return layout;

  const nextLayout = pruneWindow(layout, windowId);
  return {
    ...nextLayout,
    hiddenTabs: [...nextLayout.hiddenTabs.filter((entry) => entry !== tabId), tabId],
  };
}

export function restoreTabInLayout(layout: WindowLayout, tabId: string): WindowLayout {
  if (!layout.hiddenTabs.includes(tabId)) return layout;
  const homeWindowId = layout.homeWindowByTab[tabId] ?? layout.defaultWindowId;
  const targetWindow = layout.windows[homeWindowId] ?? layout.windows[layout.defaultWindowId];
  if (!targetWindow) return layout;

  return {
    ...layout,
    hiddenTabs: removeFromArray(layout.hiddenTabs, tabId),
    windows: {
      ...layout.windows,
      [targetWindow.id]: {
        ...targetWindow,
        tabs: [...targetWindow.tabs, tabId],
        activeTab: tabId,
      },
    },
  };
}

export function setWindowPositionInLayout(
  layout: WindowLayout,
  windowId: string,
  pos: LayoutPoint,
): WindowLayout {
  return withWindow(layout, windowId, (window) => (window.floating ? { ...window, pos } : window));
}

export function setWindowSizeInLayout(
  layout: WindowLayout,
  windowId: string,
  size: LayoutSize,
): WindowLayout {
  return withWindow(layout, windowId, (window) => (window.floating ? { ...window, size } : window));
}

type LayoutStoreState = {
  layouts: Record<string, WindowLayout>;
  initializeLayout: (layoutId: string, config: LayoutConfig) => void;
  activateTab: (layoutId: string, windowId: string, tabId: string) => void;
  moveTab: (
    layoutId: string,
    sourceWindowId: string,
    targetWindowId: string,
    tabId: string,
    targetIndex: number,
  ) => void;
  floatTab: (
    layoutId: string,
    sourceWindowId: string,
    tabId: string,
    pos: LayoutPoint,
    size: LayoutSize,
  ) => void;
  closeFloatingWindow: (layoutId: string, windowId: string) => void;
  restoreTab: (layoutId: string, tabId: string) => void;
  setWindowPosition: (layoutId: string, windowId: string, pos: LayoutPoint) => void;
  setWindowSize: (layoutId: string, windowId: string, size: LayoutSize) => void;
  bringWindowToFront: (layoutId: string, windowId: string) => void;
};

function updateLayout(
  state: LayoutStoreState,
  layoutId: string,
  updater: (layout: WindowLayout) => WindowLayout,
): Pick<LayoutStoreState, "layouts"> {
  const layout = state.layouts[layoutId];
  if (!layout) return { layouts: state.layouts };
  return {
    layouts: {
      ...state.layouts,
      [layoutId]: updater(layout),
    },
  };
}

const storageOptions =
  typeof window === "undefined"
    ? {}
    : { storage: createJSONStorage<Pick<LayoutStoreState, "layouts">>(() => localStorage) };

export const useLayoutStore = create<LayoutStoreState>()(
  persist(
    (set) => ({
      layouts: {},
      initializeLayout: (layoutId, config) =>
        set((state) => ({
          layouts: {
            ...state.layouts,
            [layoutId]: reconcileLayout(state.layouts[layoutId], config),
          },
        })),
      activateTab: (layoutId, windowId, tabId) =>
        set((state) =>
          updateLayout(state, layoutId, (layout) => activateTabInLayout(layout, windowId, tabId)),
        ),
      moveTab: (layoutId, sourceWindowId, targetWindowId, tabId, targetIndex) =>
        set((state) =>
          updateLayout(state, layoutId, (layout) =>
            moveTabInLayout(layout, sourceWindowId, targetWindowId, tabId, targetIndex),
          ),
        ),
      floatTab: (layoutId, sourceWindowId, tabId, pos, size) =>
        set((state) =>
          updateLayout(state, layoutId, (layout) =>
            floatTabInLayout(layout, sourceWindowId, tabId, pos, size),
          ),
        ),
      closeFloatingWindow: (layoutId, windowId) =>
        set((state) =>
          updateLayout(state, layoutId, (layout) => closeFloatingWindowInLayout(layout, windowId)),
        ),
      restoreTab: (layoutId, tabId) =>
        set((state) =>
          updateLayout(state, layoutId, (layout) => restoreTabInLayout(layout, tabId)),
        ),
      setWindowPosition: (layoutId, windowId, pos) =>
        set((state) =>
          updateLayout(state, layoutId, (layout) =>
            setWindowPositionInLayout(layout, windowId, pos),
          ),
        ),
      setWindowSize: (layoutId, windowId, size) =>
        set((state) =>
          updateLayout(state, layoutId, (layout) => setWindowSizeInLayout(layout, windowId, size)),
        ),
      bringWindowToFront: (layoutId, windowId) =>
        set((state) =>
          updateLayout(state, layoutId, (layout) => bringWindowToFrontInLayout(layout, windowId)),
        ),
    }),
    {
      name: LAYOUT_STORE_KEY,
      version: 1,
      partialize: (state) => ({ layouts: state.layouts }),
      ...storageOptions,
    },
  ),
);
