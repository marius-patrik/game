import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { GripHorizontal } from "lucide-react";
import {
  Children,
  type CSSProperties,
  isValidElement,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  type LayoutSize,
  type LayoutWindow,
  reconcileLayout,
  useLayoutStore,
} from "@/state/layoutStore";
import { FloatingWindow } from "./FloatingWindow";
import { Tab, type TabProps } from "./Tab";

const DEFAULT_FLOATING_SIZE: LayoutSize = { w: 360, h: 420 };
const VIEWPORT_PADDING = 8;

type TabDefinition<TTabId extends string = string> = {
  id: TTabId;
  title: string;
  icon?: ReactNode;
  content: ReactNode;
};

type WindowDropData = {
  type: "window";
  windowId: string;
};

type TabDropData = {
  type: "tab";
  windowId: string;
  tabId: string;
};

type TabWindowProps<TTabId extends string = string> = {
  id: string;
  defaultWindowId: string;
  children: ReactNode;
  floatingWindowSize?: LayoutSize;
  emptyState?: ReactNode;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getFloatingOrigin(
  event: DragEndEvent,
  size: LayoutSize,
): {
  x: number;
  y: number;
} {
  const rect = event.active.rect.current.translated ?? event.active.rect.current.initial;
  const fallbackX = window.innerWidth / 2 - size.w / 2;
  const fallbackY = window.innerHeight / 2 - size.h / 2;
  const rawX = rect?.left ?? fallbackX;
  const rawY = rect?.top ?? fallbackY;
  const maxX = Math.max(VIEWPORT_PADDING, window.innerWidth - size.w - VIEWPORT_PADDING);
  const maxY = Math.max(VIEWPORT_PADDING, window.innerHeight - size.h - VIEWPORT_PADDING);
  return {
    x: clamp(rawX, VIEWPORT_PADDING, maxX),
    y: clamp(rawY, VIEWPORT_PADDING, maxY),
  };
}

function isTabDropData(value: unknown): value is TabDropData {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "windowId" in value &&
    "tabId" in value &&
    (value as { type?: unknown }).type === "tab"
  );
}

function isWindowDropData(value: unknown): value is WindowDropData {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "windowId" in value &&
    (value as { type?: unknown }).type === "window"
  );
}

function translateStyle(
  transform: { x: number; y: number; scaleX?: number; scaleY?: number } | null,
) {
  if (!transform) return undefined;
  const scaleX = transform.scaleX ?? 1;
  const scaleY = transform.scaleY ?? 1;
  return `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${scaleX}) scaleY(${scaleY})`;
}

function parseTabs<TTabId extends string>(children: ReactNode): TabDefinition<TTabId>[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<TabProps<TTabId>>(child) || child.type !== Tab) return [];
    return [
      {
        id: child.props.id,
        title: child.props.title,
        icon: child.props.icon,
        content: child.props.children,
      },
    ];
  });
}

function isTabDefinition(tab: TabDefinition | undefined): tab is TabDefinition {
  return Boolean(tab);
}

function SortableTabButton({
  tab,
  windowId,
  active,
  onActivate,
  draggingTabId,
}: {
  tab: TabDefinition;
  windowId: string;
  active: boolean;
  onActivate: (tabId: string) => void;
  draggingTabId: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
    data: {
      type: "tab",
      tabId: tab.id,
      windowId,
    } satisfies TabDropData,
  });

  const style: CSSProperties = {
    transform: translateStyle(transform),
    transition,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onActivate(tab.id)}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-t-lg border border-transparent px-3 py-2 text-[11px] transition-colors",
        active
          ? "border-border/60 border-b-background bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        (isDragging || draggingTabId === tab.id) && "opacity-50",
      )}
      data-testid={`tab-button-${tab.id}`}
      data-tab-id={tab.id}
      data-window-id={windowId}
    >
      {tab.icon ? <span className="shrink-0">{tab.icon}</span> : null}
      <span className="whitespace-nowrap">{tab.title}</span>
    </button>
  );
}

function WindowTabs({
  windowLayout,
  tabs,
  draggingTabId,
  onActivate,
}: {
  windowLayout: LayoutWindow;
  tabs: TabDefinition[];
  draggingTabId: string | null;
  onActivate: (tabId: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `window-drop:${windowLayout.id}`,
    data: {
      type: "window",
      windowId: windowLayout.id,
    } satisfies WindowDropData,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-end gap-1 overflow-x-auto border-border/50 border-b px-2 pt-2",
        isOver && "bg-muted/45",
      )}
      data-window-id={windowLayout.id}
    >
      <SortableContext
        id={windowLayout.id}
        items={windowLayout.tabs}
        strategy={horizontalListSortingStrategy}
      >
        {tabs.map((tab) => (
          <SortableTabButton
            key={tab.id}
            tab={tab}
            windowId={windowLayout.id}
            active={windowLayout.activeTab === tab.id}
            onActivate={onActivate}
            draggingTabId={draggingTabId}
          />
        ))}
      </SortableContext>
      {tabs.length === 0 ? (
        <div className="px-2 py-2 text-[11px] text-muted-foreground">drop tabs here</div>
      ) : null}
    </div>
  );
}

function WindowPanel({
  windowLayout,
  tabsById,
  draggingTabId,
  emptyState,
  onActivate,
}: {
  windowLayout: LayoutWindow;
  tabsById: Record<string, TabDefinition>;
  draggingTabId: string | null;
  emptyState?: ReactNode;
  onActivate: (tabId: string) => void;
}) {
  const tabs = windowLayout.tabs.map((tabId) => tabsById[tabId]).filter(isTabDefinition);
  const activeTab = windowLayout.activeTab ? tabsById[windowLayout.activeTab] : undefined;

  return (
    <>
      <WindowTabs
        windowLayout={windowLayout}
        tabs={tabs}
        draggingTabId={draggingTabId}
        onActivate={onActivate}
      />
      <div
        className="min-h-0 flex-1 overflow-hidden"
        data-testid={`tab-window-${windowLayout.id}`}
        data-window-id={windowLayout.id}
      >
        {activeTab ? (
          activeTab.content
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-[11px] text-muted-foreground">
            {emptyState ?? "Restore a panel from the tracker menu or drop a tab here."}
          </div>
        )}
      </div>
    </>
  );
}

function DragGhost({ tab }: { tab: TabDefinition | undefined }) {
  if (!tab) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/95 px-3 py-2 text-[11px] shadow-lg backdrop-blur-md">
      {tab.icon ? (
        <span className="shrink-0">{tab.icon}</span>
      ) : (
        <GripHorizontal className="size-3.5" />
      )}
      <span>{tab.title}</span>
    </div>
  );
}

export function TabWindow<TTabId extends string = string>({
  id,
  defaultWindowId,
  children,
  floatingWindowSize = DEFAULT_FLOATING_SIZE,
  emptyState,
}: TabWindowProps<TTabId>) {
  const tabDefinitions = useMemo(() => parseTabs<TTabId>(children), [children]);
  const tabIds = useMemo(() => tabDefinitions.map((tab) => tab.id), [tabDefinitions]);
  const tabsById = useMemo(
    () =>
      Object.fromEntries(
        tabDefinitions.map((tab) => [
          tab.id,
          {
            id: tab.id,
            title: tab.title,
            icon: tab.icon,
            content: tab.content,
          },
        ]),
      ) as Record<string, TabDefinition>,
    [tabDefinitions],
  );

  const persistedLayout = useLayoutStore((state) => state.layouts[id]);
  const initializeLayout = useLayoutStore((state) => state.initializeLayout);
  const activateTab = useLayoutStore((state) => state.activateTab);
  const moveTab = useLayoutStore((state) => state.moveTab);
  const floatTab = useLayoutStore((state) => state.floatTab);
  const closeFloatingWindow = useLayoutStore((state) => state.closeFloatingWindow);
  const setWindowPosition = useLayoutStore((state) => state.setWindowPosition);
  const setWindowSize = useLayoutStore((state) => state.setWindowSize);
  const bringWindowToFront = useLayoutStore((state) => state.bringWindowToFront);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);

  const layout = useMemo(
    () =>
      reconcileLayout(persistedLayout, {
        defaultWindowId,
        tabIds,
      }),
    [defaultWindowId, persistedLayout, tabIds],
  );

  useEffect(() => {
    initializeLayout(id, {
      defaultWindowId,
      tabIds,
    });
  }, [defaultWindowId, id, initializeLayout, tabIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dockedWindow = layout.windows[defaultWindowId];
  const floatingWindows = layout.windowOrder
    .map((windowId) => layout.windows[windowId])
    .filter((windowLayout): windowLayout is LayoutWindow => Boolean(windowLayout?.floating));

  function focusWindow(windowId: string) {
    const windowLayout = layout.windows[windowId];
    if (!windowLayout?.floating) return;
    bringWindowToFront(id, windowId);
  }

  function handleActivate(windowId: string, tabId: string) {
    activateTab(id, windowId, tabId);
    focusWindow(windowId);
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    if (!isTabDropData(data)) return;
    setDraggingTabId(data.tabId);
    focusWindow(data.windowId);
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeData = event.active.data.current;
    setDraggingTabId(null);
    if (!isTabDropData(activeData)) return;

    const sourceWindow = layout.windows[activeData.windowId];
    if (!sourceWindow) return;

    if (event.over) {
      const overData = event.over.data.current;
      if (isTabDropData(overData)) {
        const targetWindow = layout.windows[overData.windowId];
        if (!targetWindow) return;
        const rawTargetIndex = targetWindow.tabs.indexOf(overData.tabId);
        moveTab(
          id,
          activeData.windowId,
          overData.windowId,
          activeData.tabId,
          rawTargetIndex >= 0 ? rawTargetIndex : targetWindow.tabs.length,
        );
        focusWindow(overData.windowId);
        return;
      }

      if (isWindowDropData(overData)) {
        const targetWindow = layout.windows[overData.windowId];
        if (!targetWindow) return;
        moveTab(
          id,
          activeData.windowId,
          overData.windowId,
          activeData.tabId,
          targetWindow.tabs.length,
        );
        focusWindow(overData.windowId);
        return;
      }
    }

    const nextOrigin = getFloatingOrigin(event, floatingWindowSize);
    if (sourceWindow.floating && sourceWindow.tabs.length === 1) {
      setWindowPosition(id, sourceWindow.id, nextOrigin);
      focusWindow(sourceWindow.id);
      return;
    }

    floatTab(id, sourceWindow.id, activeData.tabId, nextOrigin, floatingWindowSize);
  }

  const overlayTab = draggingTabId ? tabsById[draggingTabId] : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingTabId(null)}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {dockedWindow ? (
          <WindowPanel
            windowLayout={dockedWindow}
            tabsById={tabsById}
            draggingTabId={draggingTabId}
            emptyState={emptyState}
            onActivate={(tabId) => handleActivate(dockedWindow.id, tabId)}
          />
        ) : null}
      </div>

      {typeof document !== "undefined"
        ? floatingWindows.map((windowLayout) =>
            createPortal(
              <FloatingWindow
                key={windowLayout.id}
                id={windowLayout.id}
                title={
                  windowLayout.activeTab
                    ? (tabsById[windowLayout.activeTab]?.title ?? "Panel")
                    : "Panel"
                }
                pos={windowLayout.pos ?? { x: 96, y: 96 }}
                size={windowLayout.size ?? floatingWindowSize}
                onMove={(pos) => setWindowPosition(id, windowLayout.id, pos)}
                onResize={(size) => setWindowSize(id, windowLayout.id, size)}
                onFocus={() => focusWindow(windowLayout.id)}
                onClose={
                  windowLayout.tabs.length === 1
                    ? () => closeFloatingWindow(id, windowLayout.id)
                    : undefined
                }
                titleBar={
                  <WindowTabs
                    windowLayout={windowLayout}
                    tabs={windowLayout.tabs.map((tabId) => tabsById[tabId]).filter(isTabDefinition)}
                    draggingTabId={draggingTabId}
                    onActivate={(tabId) => handleActivate(windowLayout.id, tabId)}
                  />
                }
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {windowLayout.activeTab ? tabsById[windowLayout.activeTab]?.content : null}
                </div>
              </FloatingWindow>,
              document.body,
              windowLayout.id,
            ),
          )
        : null}

      <DragOverlay>{overlayTab ? <DragGhost tab={overlayTab} /> : null}</DragOverlay>
    </DndContext>
  );
}
