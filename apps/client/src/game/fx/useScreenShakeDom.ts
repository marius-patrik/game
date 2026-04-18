import { useEffect, useState } from "react";
import { subscribeDomShake } from "./ScreenShake";

/**
 * Returns a class name string that should be concatenated onto the HUD root.
 * Flicks on when a shake fires, clears itself after the animation ends.
 */
export function useScreenShakeDom(): string {
  const [active, setActive] = useState<{ cls: string; key: number } | null>(null);

  useEffect(() => {
    return subscribeDomShake((cls, dur) => {
      const key = Date.now() + Math.random();
      setActive({ cls, key });
      const t = window.setTimeout(() => {
        setActive((prev) => (prev && prev.key === key ? null : prev));
      }, dur + 10);
      return () => window.clearTimeout(t);
    });
  }, []);

  return active?.cls ?? "";
}
