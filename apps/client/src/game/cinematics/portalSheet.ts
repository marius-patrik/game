import type { ISequence, ISheet } from "@theatre/core";
import { getProject, types, val } from "@theatre/core";

export const PORTAL_DURATION_SEC = 1.2;

/**
 * Phase curves for the portal cinematic, expressed in absolute seconds.
 * Overlays read these to know which visual layer is active at a given moment.
 */
export const PHASES = {
  cameraPush: { start: 0.0, end: 0.6 },
  wipe: { start: 0.3, end: 0.9 },
  flash: { start: 0.8, end: 0.9 },
  fadeIn: { start: 0.9, end: 1.2 },
} as const;

export type PortalFrame = {
  /** Absolute seconds, 0..PORTAL_DURATION_SEC. */
  t: number;
  /** Normalized 0..1 over the full duration. */
  progress: number;
  /** Per-phase 0..1 values (clamped), computed from the sheet's sequence position. */
  cameraPush: number;
  wipe: number;
  flash: number;
  fadeIn: number;
};

type SheetHandle = {
  sheet: ISheet;
  sequence: ISequence;
};

let handle: SheetHandle | null = null;

function ensureSheet(): SheetHandle {
  if (handle) return handle;
  const project = getProject("game.cinematics");
  const sheet = project.sheet("portal-transition");

  // Declaring a sheet object (even unused) anchors the sheet in the project
  // and gives theatre.js something to reason about for future studio pickup.
  sheet.object("portal", {
    cameraPush: types.number(0, { range: [0, 1] }),
    wipe: types.number(0, { range: [0, 1] }),
    flash: types.number(0, { range: [0, 1] }),
    fadeIn: types.number(0, { range: [0, 1] }),
  });

  handle = { sheet, sequence: sheet.sequence };
  return handle;
}

function phaseProgress(t: number, start: number, end: number): number {
  if (t <= start) return 0;
  if (t >= end) return 1;
  return (t - start) / (end - start);
}

function sampleFrame(t: number): PortalFrame {
  const clamped = Math.max(0, Math.min(PORTAL_DURATION_SEC, t));
  return {
    t: clamped,
    progress: clamped / PORTAL_DURATION_SEC,
    cameraPush: phaseProgress(clamped, PHASES.cameraPush.start, PHASES.cameraPush.end),
    wipe: phaseProgress(clamped, PHASES.wipe.start, PHASES.wipe.end),
    flash: phaseProgress(clamped, PHASES.flash.start, PHASES.flash.end),
    fadeIn: phaseProgress(clamped, PHASES.fadeIn.start, PHASES.fadeIn.end),
  };
}

export type PortalPlayback = {
  /** Read the current frame without touching the sequence. */
  sample: (t: number) => PortalFrame;
  /** Drive the sequence playhead to `t`. Safe to call from RAF. */
  setTime: (t: number) => void;
  /** Current sequence position in seconds. */
  readPosition: () => number;
};

/**
 * Returns a stable playback handle bound to the shared sheet. The sheet is a
 * module-level singleton — repeated calls reuse it so rapid-swap transitions
 * can cancel and restart cleanly without re-registering with theatre.js.
 */
export function getPortalPlayback(): PortalPlayback {
  const { sequence } = ensureSheet();
  return {
    sample: sampleFrame,
    setTime: (t: number) => {
      sequence.position = Math.max(0, Math.min(PORTAL_DURATION_SEC, t));
    },
    readPosition: () => val(sequence.pointer.position),
  };
}
