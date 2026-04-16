import { useEffect, useRef } from "react";
import { setSourceIntent } from "./intentStore";

export function useKeyboardSource(enabled: boolean) {
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!enabled) return;

    const recompute = () => {
      const k = keys.current;
      let x = 0;
      let z = 0;
      if (k.w || k.arrowup) z -= 1;
      if (k.s || k.arrowdown) z += 1;
      if (k.a || k.arrowleft) x -= 1;
      if (k.d || k.arrowright) x += 1;
      if (x || z) {
        const len = Math.hypot(x, z);
        x /= len;
        z /= len;
      }
      setSourceIntent("keyboard", { x, z });
    };

    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
      }
      keys.current[e.key.toLowerCase()] = true;
      recompute();
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
      recompute();
    };
    const blur = () => {
      keys.current = {};
      setSourceIntent("keyboard", { x: 0, z: 0 });
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      setSourceIntent("keyboard", { x: 0, z: 0 });
    };
  }, [enabled]);
}
