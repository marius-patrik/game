export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const hasTouch = "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
  return coarse || hasTouch;
}
