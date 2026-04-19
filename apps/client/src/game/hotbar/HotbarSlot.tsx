import { useCallback, useEffect, useRef, useState } from "react";
import { useLongPress } from "@/lib/useLongPress";
import { cn } from "@/lib/utils";

/** Duration of the press pulse animation in `tokens.css` — keep in sync. */
const PRESS_PULSE_MS = 220;

export function HotbarSlot({
  slot,
  hotkey,
  glyph,
  title,
  ariaLabel,
  color = "#71717a",
  empty = false,
  disabled = false,
  active = false,
  distinct = false,
  count,
  cooldownRemainingMs = 0,
  cooldownTotalMs = 0,
  cooldownStyle = "fill",
  className,
  onClick,
  onLongPress,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  slot: string;
  hotkey: string;
  glyph: string;
  title: string;
  ariaLabel: string;
  color?: string;
  empty?: boolean;
  disabled?: boolean;
  active?: boolean;
  distinct?: boolean;
  count?: number;
  cooldownRemainingMs?: number;
  cooldownTotalMs?: number;
  cooldownStyle?: "fill" | "ring";
  className?: string;
  onClick?: () => void;
  onLongPress?: () => void;
  onDragStart?: React.DragEventHandler<HTMLButtonElement>;
  onDragEnd?: React.DragEventHandler<HTMLButtonElement>;
  onDragOver?: React.DragEventHandler<HTMLButtonElement>;
  onDragLeave?: React.DragEventHandler<HTMLButtonElement>;
  onDrop?: React.DragEventHandler<HTMLButtonElement>;
}) {
  const longPressFiredRef = useRef(false);
  const long = useLongPress({
    onLongPress: () => {
      if (!onLongPress) return;
      longPressFiredRef.current = true;
      onLongPress();
    },
    durationMs: 450,
  });

  // Karlson feel: every successful press pulses the slot. The class flips
  // on for the duration of the CSS keyframe then self-clears so the next
  // press retriggers cleanly. `pressTick` is used in `key` on the pulse
  // wrapper so React remounts it and the animation restarts from frame 0.
  const [pressTick, setPressTick] = useState(0);
  const [pressActive, setPressActive] = useState(false);
  const triggerPressPulse = useCallback(() => {
    setPressTick((t) => t + 1);
    setPressActive(true);
  }, []);
  useEffect(() => {
    if (!pressActive) return;
    const to = window.setTimeout(() => setPressActive(false), PRESS_PULSE_MS + 20);
    return () => window.clearTimeout(to);
  }, [pressActive]);

  const handleClick = useCallback(() => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (disabled) return;
    triggerPressPulse();
    onClick?.();
  }, [disabled, onClick, triggerPressPulse]);

  const cooldownFrac =
    cooldownRemainingMs > 0 && cooldownTotalMs > 0
      ? Math.max(0, Math.min(1, cooldownRemainingMs / cooldownTotalMs))
      : 0;

  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      data-slot={slot}
      draggable={Boolean(onDragStart)}
      onClick={handleClick}
      onPointerDown={onLongPress ? long.onPointerDown : undefined}
      onPointerMove={onLongPress ? long.onPointerMove : undefined}
      onPointerUp={onLongPress ? long.onPointerUp : undefined}
      onPointerLeave={onLongPress ? long.onPointerLeave : undefined}
      onPointerCancel={onLongPress ? long.onPointerCancel : undefined}
      onContextMenu={
        onLongPress
          ? (event) => {
              event.preventDefault();
              long.cancel();
              onLongPress();
            }
          : undefined
      }
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "group relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background/85 shadow-md backdrop-blur-md transition-transform sm:size-12",
        distinct && "size-10 sm:size-14",
        empty ? "border-dashed border-border/40 text-muted-foreground" : "hover:scale-[1.03]",
        disabled && !active && "opacity-55",
        active && "ring-2 ring-offset-1 ring-offset-background",
        className,
      )}
      style={{
        borderColor: empty ? undefined : color,
        boxShadow:
          distinct && !empty ? `0 0 18px ${color}33` : active ? `0 0 0 2px ${color}` : undefined,
      }}
    >
      <span className="absolute left-1 top-1 font-semibold text-[8px] text-muted-foreground">
        {slot}
      </span>
      <span className="absolute right-1 top-1 font-mono text-[8px] text-muted-foreground">
        {hotkey}
      </span>

      <div
        key={pressTick}
        className={cn(
          "flex size-4 items-center justify-center rounded-md border text-[9px] font-black leading-none sm:size-6 sm:text-xs",
          distinct && "size-5 sm:size-7",
          pressActive && "polish-hotbar-press",
        )}
        style={{
          background: empty ? "rgba(113,113,122,0.08)" : `${color}1a`,
          borderColor: empty ? "rgba(113,113,122,0.24)" : `${color}66`,
          color: empty ? "#71717a" : color,
        }}
      >
        {glyph}
      </div>

      {typeof count === "number" && count > 0 ? (
        <span className="absolute bottom-1 right-1 rounded bg-background/90 px-1 font-mono text-[8px] text-muted-foreground">
          {count}
        </span>
      ) : null}

      {cooldownRemainingMs > 0 && cooldownStyle === "ring" ? (
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            background: `conic-gradient(${color} ${360 * (1 - cooldownFrac)}deg, rgba(0,0,0,0.68) 0)`,
            mask: "radial-gradient(circle, transparent 48%, black 50%)",
            WebkitMask: "radial-gradient(circle, transparent 48%, black 50%)",
          }}
        />
      ) : cooldownRemainingMs > 0 ? (
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 bg-background/70"
          style={{ height: `${cooldownFrac * 100}%` }}
        />
      ) : null}

      {cooldownRemainingMs > 0 ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[9px] text-white sm:text-[10px]">
          {(cooldownRemainingMs / 1000).toFixed(1)}
        </span>
      ) : null}
    </button>
  );
}
