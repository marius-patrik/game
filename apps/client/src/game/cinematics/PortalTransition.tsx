import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { PORTAL_DURATION_SEC, getPortalPlayback } from "./portalSheet";
import type { PortalFrame } from "./portalSheet";

const MIN_HOLD_MS = 200; // keep full black at least this long for visual sanity

type CinematicStatus = "idle" | "connecting" | "connected" | "error";

type Phase = "idle" | "playing" | "holding" | "reveal";

/**
 * Full-screen cinematic for zone swaps. Plays a 1.2s theatre.js-timed sequence
 * (camera push → radial wipe → white flash → fade-in). Triggered by a zoneId
 * change, then driven by `status`: holds on black while `connecting`, plays
 * the reveal on `connected`, aborts on `error` so the user isn't stuck behind
 * a black overlay when the zone fails to join.
 *
 * Rapid-swap safety: the active RAF loop carries a cancellation token; starting
 * a new travel during playback cancels the in-flight loop and restarts from
 * the current sequence position, so visuals never double up.
 */
export function PortalTransition({
  status,
  zoneId,
}: {
  status: CinematicStatus;
  zoneId: string;
}) {
  const [frame, setFrame] = useState<PortalFrame | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const cancelRef = useRef<() => void>(() => {});
  const prevZoneRef = useRef<string | null>(null);
  const prevStatusRef = useRef<CinematicStatus>(status);

  useEffect(() => {
    const playback = getPortalPlayback();
    const prevZone = prevZoneRef.current;
    const prevStatus = prevStatusRef.current;
    prevZoneRef.current = zoneId;
    prevStatusRef.current = status;

    // Connection failed — abort cinematic so the Disconnected toast is visible.
    if (status === "error") {
      cancelRef.current();
      phaseRef.current = "idle";
      setFrame(null);
      return undefined;
    }

    const isNewZone = prevZone !== null && prevZone !== zoneId;
    const isReconnecting = status === "connecting" && prevStatus === "connected";
    const travelStarting = isNewZone || isReconnecting;

    if (travelStarting || phaseRef.current === "playing") {
      cancelRef.current();
      phaseRef.current = "playing";

      let cancelled = false;
      cancelRef.current = () => {
        cancelled = true;
      };

      const HOLD_AT = 0.9;
      const startFromPosition = travelStarting ? 0 : playback.readPosition();
      playback.setTime(startFromPosition);
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

    // Reconnect complete — play the reveal phase.
    if (status === "connected" && phaseRef.current === "holding") {
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

    return undefined;
  }, [status, zoneId]);

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
