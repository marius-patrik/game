import { useEffect } from "react";

export function CinematicGate({ active, onSkip }: { active: boolean; onSkip: () => void }) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape" || e.key === " ") onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onSkip]);

  if (!active) return null;

  return (
    <button
      type="button"
      onClick={onSkip}
      className="pointer-events-auto absolute right-4 top-4 z-50 rounded-md bg-black/50 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-primary"
      aria-label="Skip cinematic"
    >
      Skip · Enter
    </button>
  );
}
