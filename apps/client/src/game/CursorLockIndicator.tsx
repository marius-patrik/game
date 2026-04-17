import { MousePointer2, Target } from "lucide-react";
import { useCursorLockState } from "./camera/useCursorLock";

/**
 * Tiny HUD chip showing the current cursor-lock state.
 *
 * - Only renders on devices that support pointer-lock (hidden on mobile /
 *   coarse-pointer setups where the binding is a no-op).
 * - Copy stays compact so the chip tucks into the existing row beside the
 *   identity + net-status pills in HUD.tsx.
 */
export function CursorLockIndicator() {
  const { locked, isSupported } = useCursorLockState();
  if (!isSupported) return null;
  return (
    <div
      data-testid="cursor-lock-indicator"
      className="pointer-events-none hidden rounded-lg border border-border/50 bg-background/40 px-3 py-1.5 text-xs backdrop-blur-md sm:block"
      title={
        locked
          ? "Cursor locked — mouse drives camera rotation. Press Ctrl to release."
          : "Cursor free — drag to rotate camera. Press Ctrl to lock."
      }
    >
      <div className="flex items-center gap-2">
        {locked ? (
          <Target className="size-3.5 text-emerald-500" />
        ) : (
          <MousePointer2 className="size-3.5 text-muted-foreground" />
        )}
        <span className={locked ? "text-foreground" : "text-muted-foreground"}>
          {locked ? "cam lock" : "ctrl to lock"}
        </span>
      </div>
    </div>
  );
}
