import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { PORTAL_DURATION_SEC, getPortalPlayback } from "./portalSheet";
import type { PortalFrame } from "./portalSheet";

const MIN_HOLD_MS = 200; // keep full black at least this long for visual sanity

type CinematicStatus = "idle" | "connecting" | "connected" | "error";

type Phase = "idle" | "playing" | "holding" | "reveal";

/**
 * Full-screen cinematic for zone swaps. Plays a 1.2s theatre.js-timed sequence
 * (camera push → radial wipe → white flash → fade-in). If the reconnect is
 * slower than the first 0.9s it holds on full black until status flips back
 * to `connected`, then finishes the last 0.3s reveal.
 *
 * Rapid-swap safety: the active RAF loop carries a cancellation token; starting
 * a new travel during playback cancels the in-flight loop and restarts from
 * the current sequence position, so visuals never double up.
 */
export function PortalTransition({ status }: { status: CinematicStatus }) {
  const [frame, setFrame] = useState<PortalFrame | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const cancelRef = useRef<() => void>(() => {});

  useEffect(() => {
    const playback = getPortalPlayback();

    const isTravel = status === "connecting" || status === "idle";

    if (isTravel) {
      // Cancel any in-flight loop and (re)start from the current position so
      // a rapid second travel keeps visuals continuous.
      cancelRef.current();
      phaseRef.current = "playing";

      let cancelled = false;
      cancelRef.current = () => {
        cancelled = true;
      };

      // Run phases 1-3 (cameraPush → wipe → flash) forward, then hold on
      // black until reconnect finishes, then play the fadeIn phase.
      const HOLD_AT = 0.9;
      const startFromPosition = playback.readPosition();
      const startWallMs = typeof performance !== "undefined" ? performance.now() : Date.now();

      const step = () => {
        if (cancelled) return;
        const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
        const elapsedSec = (nowMs - startWallMs) / 1000;
        const t = Math.min(HOLD_AT, startFromPosition + elapsedSec);
        playback.setTime(t);
        setFrame(playback.sample(t));
        if (t >= HOLD_AT) {
          phaseRef.current = "holding";
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      return () => {
        cancelled = true;
      };
    }

    // Reconnected — finish the cinematic with the reveal phase.
    if (phaseRef.current === "holding" || phaseRef.current === "playing") {
      cancelRef.current();
      let cancelled = false;
      cancelRef.current = () => {
        cancelled = true;
      };
      phaseRef.current = "reveal";

      const startWallMs = typeof performance !== "undefined" ? performance.now() : Date.now();
      const holdStart = startWallMs;

      const step = () => {
        if (cancelled) return;
        const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
        const sinceHoldMs = nowMs - holdStart;
        if (sinceHoldMs < MIN_HOLD_MS) {
          requestAnimationFrame(step);
          return;
        }
        const revealElapsed = (sinceHoldMs - MIN_HOLD_MS) / 1000;
        const t = Math.min(PORTAL_DURATION_SEC, 0.9 + revealElapsed);
        playback.setTime(t);
        setFrame(playback.sample(t));
        if (t >= PORTAL_DURATION_SEC) {
          phaseRef.current = "idle";
          setFrame(null);
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      return () => {
        cancelled = true;
      };
    }

    // Idle → connected without a prior travel (cold boot, etc). No overlay.
    phaseRef.current = "idle";
    setFrame(null);
    return undefined;
  }, [status]);

  return (
    <AnimatePresence>
      {frame ? (
        <motion.div
          key="portal-cinematic"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="pointer-events-none absolute inset-0 z-40"
        >
          <RadialWipe amount={frame.wipe} />
          <WhiteFlash amount={flashIntensity(frame.flash)} />
          <FadeIn amount={1 - frame.fadeIn} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Flash ramps 0→peak→0 across its phase so the reveal doesn't start on white. */
function flashIntensity(rawPhase: number): number {
  if (rawPhase <= 0 || rawPhase >= 1) return 0;
  const tri = rawPhase < 0.5 ? rawPhase / 0.5 : (1 - rawPhase) / 0.5;
  return tri * 0.9;
}

function RadialWipe({ amount }: { amount: number }) {
  if (amount <= 0) return null;
  const inner = Math.max(0, 100 - amount * 100);
  const outer = Math.max(inner + 1, 110 - amount * 100);
  return (
    <div
      className="absolute inset-0"
      style={{
        background: `radial-gradient(circle at center, transparent ${inner}%, #000 ${outer}%)`,
      }}
    />
  );
}

function WhiteFlash({ amount }: { amount: number }) {
  if (amount <= 0) return null;
  return <div className="absolute inset-0 bg-white" style={{ opacity: amount }} />;
}

function FadeIn({ amount }: { amount: number }) {
  if (amount <= 0) return null;
  return <div className="absolute inset-0 bg-black" style={{ opacity: amount }} />;
}
