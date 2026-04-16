import { useEffect } from "react";

const ATTACK_COOLDOWN_MS = 400;

export function useAttack({
  enabled,
  onAttack,
}: {
  enabled: boolean;
  onAttack: () => void;
}) {
  useEffect(() => {
    if (!enabled) return;
    let last = 0;
    const fire = () => {
      const now = performance.now();
      if (now - last < ATTACK_COOLDOWN_MS) return;
      last = now;
      onAttack();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code !== "Space" && e.key !== " ") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      fire();
    };
    window.addEventListener("keydown", onKey);
    const onCustom = () => fire();
    window.addEventListener("game:attack", onCustom);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("game:attack", onCustom);
    };
  }, [enabled, onAttack]);
}

export function triggerAttack() {
  window.dispatchEvent(new Event("game:attack"));
}
