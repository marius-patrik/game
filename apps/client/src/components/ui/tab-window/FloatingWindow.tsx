import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LayoutPoint, LayoutSize } from "@/state/layoutStore";
import { Grip, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";

const VIEWPORT_PADDING = 8;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 220;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clampPosition(pos: LayoutPoint, size: LayoutSize): LayoutPoint {
  const maxX = Math.max(VIEWPORT_PADDING, window.innerWidth - size.w - VIEWPORT_PADDING);
  const maxY = Math.max(VIEWPORT_PADDING, window.innerHeight - size.h - VIEWPORT_PADDING);
  return {
    x: clamp(pos.x, VIEWPORT_PADDING, maxX),
    y: clamp(pos.y, VIEWPORT_PADDING, maxY),
  };
}

function clampSize(pos: LayoutPoint, size: LayoutSize): LayoutSize {
  const maxW = Math.max(MIN_WIDTH, window.innerWidth - pos.x - VIEWPORT_PADDING);
  const maxH = Math.max(MIN_HEIGHT, window.innerHeight - pos.y - VIEWPORT_PADDING);
  return {
    w: clamp(size.w, MIN_WIDTH, maxW),
    h: clamp(size.h, MIN_HEIGHT, maxH),
  };
}

type FloatingWindowProps = {
  id: string;
  title: string;
  pos: LayoutPoint;
  size: LayoutSize;
  titleBar: ReactNode;
  children: ReactNode;
  onMove: (pos: LayoutPoint) => void;
  onResize: (size: LayoutSize) => void;
  onFocus: () => void;
  onClose?: () => void;
};

export function FloatingWindow({
  id,
  title,
  pos,
  size,
  titleBar,
  children,
  onMove,
  onResize,
  onFocus,
  onClose,
}: FloatingWindowProps) {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  function bindPointerSession(
    onPointerMove: (event: PointerEvent) => void,
    onPointerUp?: () => void,
  ) {
    cleanupRef.current?.();
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const handleMove = (event: PointerEvent) => onPointerMove(event);
    const handleUp = () => {
      cleanupRef.current?.();
      onPointerUp?.();
    };

    cleanupRef.current = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      document.body.style.userSelect = previousUserSelect;
      cleanupRef.current = null;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  }

  function startMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    onFocus();
    const origin = { ...pos };
    const start = { x: event.clientX, y: event.clientY };

    bindPointerSession((moveEvent) => {
      const nextPos = clampPosition(
        {
          x: origin.x + (moveEvent.clientX - start.x),
          y: origin.y + (moveEvent.clientY - start.y),
        },
        size,
      );
      onMove(nextPos);
    });
  }

  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    onFocus();
    const origin = { ...size };
    const start = { x: event.clientX, y: event.clientY };

    bindPointerSession((moveEvent) => {
      const nextSize = clampSize(pos, {
        w: origin.w + (moveEvent.clientX - start.x),
        h: origin.h + (moveEvent.clientY - start.y),
      });
      onResize(nextSize);
    });
  }

  return (
    <section
      className={cn(
        "pointer-events-auto fixed z-40 flex flex-col overflow-hidden rounded-xl border border-border/50 bg-background/92 shadow-2xl backdrop-blur-md",
      )}
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      aria-label={title}
      data-testid={`floating-window-${id}`}
      data-window-id={id}
      onPointerDown={onFocus}
    >
      <div
        className="flex cursor-move touch-none items-center justify-between border-border/50 border-b bg-background/85 px-3 py-2"
        onPointerDown={startMove}
      >
        <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
          <Grip className="size-3 shrink-0" />
          <span className="truncate">{title}</span>
        </div>
        {onClose ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label={`Close ${title}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClose}
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>
      {titleBar}
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      <div
        className="absolute right-1 bottom-1 flex h-6 w-6 cursor-se-resize items-end justify-end text-muted-foreground/70"
        onPointerDown={startResize}
        aria-hidden="true"
      >
        <Grip className="size-3.5 rotate-45" />
      </div>
    </section>
  );
}
