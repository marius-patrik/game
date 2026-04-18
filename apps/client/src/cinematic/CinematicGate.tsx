import { useEffect } from "react";
import { formatKeybind, matchesKeybind } from "@/state/keybinds";

export function CinematicGate({
  active,
  onSkip,
  skipKey,
}: {
  active: boolean;
  onSkip: () => void;
  /** Current cinematic-skip binding. Enter is always accepted as a secondary
   * skip affordance so the on-screen hint stays meaningful. */
  skipKey: string;
}) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || matchesKeybind(e.key, skipKey)) onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onSkip, skipKey]);

  if (!active) return null;

  return (
    <button
      type="button"
      onClick={onSkip}
      className="pointer-events-auto absolute right-4 top-4 z-50 rounded-md bg-black/50 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-primary"
      aria-label="Skip cinematic"
    >
      Skip · {formatKeybind(skipKey)}
    </button>
  );
}
