import { triggerAttack } from "./useAttack";

export function AttackButton({ disabled }: { disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label="Attack"
      onPointerDown={(e) => {
        e.preventDefault();
        if (!disabled) triggerAttack();
      }}
      className="pointer-events-auto absolute right-6 bottom-6 flex h-20 w-20 touch-none select-none items-center justify-center rounded-full border border-border/60 bg-rose-500/30 font-bold text-lg text-foreground backdrop-blur-md transition-opacity active:bg-rose-500/60 disabled:opacity-40"
      style={{ touchAction: "none" }}
    >
      ATK
    </button>
  );
}
