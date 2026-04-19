import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import type { ComponentType } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";

type LayoutStoreHook = typeof import("@/state/layoutStore").useLayoutStore;
type TabComponent = typeof import("./Tab").Tab;
type TabWindowComponent = typeof import("./TabWindow").TabWindow;

const ORIGINAL_GLOBALS = {
  window: globalThis.window,
  document: globalThis.document,
  navigator: globalThis.navigator,
  localStorage: globalThis.localStorage,
  HTMLElement: globalThis.HTMLElement,
  HTMLIFrameElement: globalThis.HTMLIFrameElement,
  Element: globalThis.Element,
  Node: globalThis.Node,
  DocumentFragment: globalThis.DocumentFragment,
  MutationObserver: globalThis.MutationObserver,
  getComputedStyle: globalThis.getComputedStyle,
  requestAnimationFrame: globalThis.requestAnimationFrame,
  cancelAnimationFrame: globalThis.cancelAnimationFrame,
  PointerEvent: globalThis.PointerEvent,
  IS_REACT_ACT_ENVIRONMENT: (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT,
};

let useLayoutStore: LayoutStoreHook;
let Tab: TabComponent;
let TabWindow: TabWindowComponent;
let root: Root | null = null;

function installDom() {
  const windowInstance = new Window({
    url: "http://localhost/",
    width: 1440,
    height: 900,
  });

  Object.assign(globalThis, {
    window: windowInstance,
    document: windowInstance.document,
    navigator: windowInstance.navigator,
    localStorage: windowInstance.localStorage,
    HTMLElement: windowInstance.HTMLElement,
    HTMLIFrameElement: windowInstance.HTMLIFrameElement,
    Element: windowInstance.Element,
    Node: windowInstance.Node,
    DocumentFragment: windowInstance.DocumentFragment,
    MutationObserver: windowInstance.MutationObserver,
    getComputedStyle: windowInstance.getComputedStyle.bind(windowInstance),
    requestAnimationFrame: windowInstance.requestAnimationFrame.bind(windowInstance),
    cancelAnimationFrame: windowInstance.cancelAnimationFrame.bind(windowInstance),
    PointerEvent: windowInstance.PointerEvent,
  });
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
}

function restoreDom() {
  Object.assign(globalThis, ORIGINAL_GLOBALS);
}

function flushEffects() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("TabWindow", () => {
  beforeEach(async () => {
    installDom();

    ({ useLayoutStore } = await import("@/state/layoutStore"));
    ({ Tab } = await import("./Tab"));
    ({ TabWindow } = await import("./TabWindow"));

    localStorage.clear();
    useLayoutStore.setState({ layouts: {} });
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
        await flushEffects();
      });
      root = null;
    }
    useLayoutStore.setState({ layouts: {} });
    restoreDom();
  });

  test("mounts without triggering a render loop", async () => {
    const renderCount = { current: 0 };
    const consoleErrors: string[] = [];
    const originalConsoleError = console.error;
    const container = document.createElement("div");
    document.body.append(container);
    const ImportedTab = Tab;
    const ImportedTabWindow = TabWindow;

    const RenderCounter: ComponentType = () => {
      renderCount.current += 1;
      return (
        <ImportedTabWindow id="test-layout" defaultWindowId="dock">
          <ImportedTab id="map" title="Map">
            <div>Map</div>
          </ImportedTab>
          <ImportedTab id="chat" title="Chat">
            <div>Chat</div>
          </ImportedTab>
        </ImportedTabWindow>
      );
    };

    console.error = (...args) => {
      consoleErrors.push(args.map(String).join(" "));
    };

    try {
      root = createRoot(container);
      await act(async () => {
        root?.render(createElement(RenderCounter));
        await flushEffects();
      });

      expect(renderCount.current).toBeLessThanOrEqual(5);
      expect(
        consoleErrors.some((message) => message.includes("Maximum update depth exceeded")),
      ).toBe(false);
      expect(useLayoutStore.getState().layouts["test-layout"]?.windows.dock?.tabs).toEqual([
        "map",
        "chat",
      ]);
    } finally {
      console.error = originalConsoleError;
    }
  });
});
