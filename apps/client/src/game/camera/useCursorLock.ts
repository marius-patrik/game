import { useEffect, useSyncExternalStore } from "react";
import { matchesKeybind } from "@/state/keybinds";

/**
 * Hook-style wrapper around the Pointer Lock API.
 *
 * - Desktop: toggling via the cursor-lock keybind (defaults to Ctrl) captures
 *   the system cursor and replaces drag-to-orbit with raw mouseMovement-driven
 *   yaw. Releasing pointer lock (ESC, lost focus) is reflected in `locked`.
 * - Mobile / touch devices: the API is a no-op. `isSupported` is false, so
 *   the HUD indicator simply never shows "locked" and the keybind has no
 *   effect — touch already drives rotation natively through pointer events.
 *
 * The lock element is always `document.body`: we need the whole viewport to
 * receive relative mouse movement, and the R3F canvas is not guaranteed to
 * hold focus.
 */

function subscribe(onChange: () => void): () => void {
  const handler = () => onChange();
  document.addEventListener("pointerlockchange", handler);
  document.addEventListener("pointerlockerror", handler);
  return () => {
    document.removeEventListener("pointerlockchange", handler);
    document.removeEventListener("pointerlockerror", handler);
  };
}

function snapshot(): Element | null {
  if (typeof document === "undefined") return null;
  return document.pointerLockElement ?? null;
}

function serverSnapshot(): Element | null {
  return null;
}

export function useCursorLockState(): { locked: boolean; isSupported: boolean } {
  const element = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const isSupported =
    typeof document !== "undefined" &&
    typeof document.body?.requestPointerLock === "function" &&
    // Coarse-pointer devices (phones, tablets) expose the API but it never
    // actually captures — treat as unsupported to hide the HUD indicator.
    (typeof window === "undefined" || !window.matchMedia("(pointer: coarse)").matches);
  return { locked: element === document.body, isSupported };
}

export function requestCursorLock(): void {
  if (typeof document === "undefined") return;
  const body = document.body;
  if (!body || typeof body.requestPointerLock !== "function") return;
  if (document.pointerLockElement === body) return;
  body.requestPointerLock();
}

export function releaseCursorLock(): void {
  if (typeof document === "undefined") return;
  if (document.pointerLockElement == null) return;
  document.exitPointerLock();
}

export function toggleCursorLock(): void {
  if (typeof document === "undefined") return;
  if (document.pointerLockElement === document.body) {
    releaseCursorLock();
  } else {
    requestCursorLock();
  }
}

/**
 * Binds the cursor-lock keybind (default `Ctrl`) to `toggleCursorLock`.
 *
 * When the binding is the bare `control` key we also guard against
 * Ctrl+<other> combos so we don't steal browser shortcuts (Ctrl+C, Ctrl+R).
 */
export function useCursorLockToggleKey(enabled: boolean, binding: string): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (binding === "control") {
        if (e.key !== "Control") return;
      } else if (!matchesKeybind(e.key, binding)) {
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      toggleCursorLock();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, binding]);
}
