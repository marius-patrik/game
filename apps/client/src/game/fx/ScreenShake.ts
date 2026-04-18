/**
 * Screen shake — both a 3D camera offset and a DOM class pulse.
 *
 * There are two shake channels because the game has two "viewports":
 * 1. The R3F canvas (3D camera) — a short decaying vector added to the
 *    chase-camera position each frame.
 * 2. The HUD container (DOM) — a CSS animation class pulse that nudges the
 *    whole `.relative.h-full.w-full` root for a few frames.
 *
 * `ChaseCamera` reads `sampleShakeOffset()` each frame; HUD consumers
 * subscribe via `useScreenShakePulse()` to toggle a class name.
 *
 * Severity tiers:
 *  - `hit`: small nudge for every incoming hit
 *  - `boss-telegraph`: medium thump when a boss AoE lands
 *  - `level-up`: zoom-punch (scale + vertical kick) on level change
 */

type Tier = "hit" | "boss-telegraph" | "level-up";

type ShakeSpec = {
  /** Peak amplitude (world units for camera; px for HUD). */
  amp: number;
  /** Total duration in seconds. Camera decays linearly to zero. */
  duration: number;
  /** Frequency in Hz — controls how quickly the camera oscillates. */
  freq: number;
  /** DOM class to append for the matching CSS animation. */
  domClass: string;
  /** DOM animation duration (ms) — must match CSS keyframe length. */
  domDurationMs: number;
};

const SHAKE_SPEC: Record<Tier, ShakeSpec> = {
  hit: { amp: 0.08, duration: 0.22, freq: 24, domClass: "polish-shake-small", domDurationMs: 180 },
  "boss-telegraph": {
    amp: 0.18,
    duration: 0.38,
    freq: 20,
    domClass: "polish-shake-medium",
    domDurationMs: 340,
  },
  "level-up": {
    amp: 0.12,
    duration: 0.55,
    freq: 14,
    domClass: "polish-shake-punch",
    domDurationMs: 520,
  },
};

type CameraEntry = {
  startedAt: number;
  spec: ShakeSpec;
  seed: number;
};

const cameraEntries: CameraEntry[] = [];
const domListeners = new Set<(domClass: string, durationMs: number) => void>();

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function triggerScreenShake(tier: Tier): void {
  const spec = SHAKE_SPEC[tier];
  cameraEntries.push({ startedAt: now(), spec, seed: Math.random() * Math.PI * 2 });
  for (const l of domListeners) l(spec.domClass, spec.domDurationMs);
}

export function subscribeDomShake(
  listener: (domClass: string, durationMs: number) => void,
): () => void {
  domListeners.add(listener);
  return () => {
    domListeners.delete(listener);
  };
}

/**
 * Sample the combined decaying shake offset for the current frame. Called
 * each frame by the chase camera — callers must read it whether shake is
 * active or not (it's free when empty). Returns (0,0,0) when idle.
 */
export function sampleShakeOffset(out: { x: number; y: number; z: number }): void {
  out.x = 0;
  out.y = 0;
  out.z = 0;
  if (cameraEntries.length === 0) return;
  const t = now();
  for (let i = cameraEntries.length - 1; i >= 0; i--) {
    const e = cameraEntries[i];
    if (!e) continue;
    const elapsed = (t - e.startedAt) / 1000;
    if (elapsed >= e.spec.duration) {
      cameraEntries.splice(i, 1);
      continue;
    }
    const progress = elapsed / e.spec.duration;
    const decay = 1 - progress;
    const omega = e.spec.freq * Math.PI * 2;
    const phase = omega * elapsed + e.seed;
    const amp = e.spec.amp * decay;
    out.x += Math.sin(phase) * amp;
    out.y += Math.cos(phase * 1.3) * amp * 0.5;
    out.z += Math.sin(phase * 0.7) * amp * 0.6;
  }
}

/** Hard-reset (used on cinematic transitions + zone swaps). */
export function resetShake(): void {
  cameraEntries.length = 0;
}
