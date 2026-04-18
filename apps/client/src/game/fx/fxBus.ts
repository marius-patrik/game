/**
 * Lightweight event bus for scene-level visual feedback. GameView (and other
 * callers outside the R3F tree) emit events here; the `<FxOverlay />`
 * component — which lives inside the Canvas — subscribes and mounts the
 * matching preset at the right world position.
 *
 * Using a module-level pub-sub means we can trigger particle effects from
 * anywhere (net layer, input handlers, React effects) without threading
 * refs through the scene hierarchy. Each effect auto-unmounts itself.
 */

export type FxEvent =
  | { kind: "level-up"; at: { x: number; z: number } }
  | { kind: "pickup"; at: { x: number; z: number }; color: string }
  | { kind: "ability-pulse"; at: { x: number; z: number }; color: string };

type Listener = (event: FxEvent) => void;
const listeners = new Set<Listener>();

export function emitFxEvent(event: FxEvent): void {
  for (const l of listeners) l(event);
}

export function subscribeFxEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
