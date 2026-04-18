import { useEffect, useRef, useState } from "react";

/**
 * Character-by-character reveal for dialog text. Driven by `requestAnimation
 * Frame` so playback runs on the render clock and pauses cleanly when the
 * tab backgrounds.
 *
 * - `text` — the full line. Changes reset progress to 0.
 * - `charsPerSecond` — reveal rate (default 80).
 * - `done` — becomes true when the full string has been written.
 * - `skip()` — jumps to the end (space key, mouse click through, etc.).
 */
export function useTypewriter(
  text: string,
  charsPerSecond = 80,
): { visible: string; done: boolean; skip: () => void } {
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);
  const frameRef = useRef<number | null>(null);
  const startAtRef = useRef<number>(0);

  useEffect(() => {
    setCount(0);
    setDone(false);
    if (!text) {
      setDone(true);
      return;
    }
    startAtRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startAtRef.current;
      const target = Math.min(text.length, Math.floor((elapsed / 1000) * charsPerSecond));
      setCount(target);
      if (target >= text.length) {
        setDone(true);
        frameRef.current = null;
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [text, charsPerSecond]);

  const skip = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setCount(text.length);
    setDone(true);
  };

  return { visible: text.slice(0, count), done, skip };
}
