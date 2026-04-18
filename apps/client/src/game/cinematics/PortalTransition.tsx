import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { PortalFrame } from "./portalSheet";
import { getPortalPlayback, PORTAL_DURATION_SEC } from "./portalSheet";

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
 * the top. The loop itself reads `statusRef` every frame, so reconnect
 * completion is observed without needing to restart the loop on every status
 * transition.
 */
export function PortalTransition({ status, zoneId }: { status: CinematicStatus; zoneId: string }) {
  const [frame, setFrame] = useState<PortalFrame | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const cancelRef = useRef<() => void>(() => {});
  const statusRef = useRef<CinematicStatus>(status);
  const prevZoneRef = useRef<string | null>(null);

  // Keep a live ref to `status` so the RAF loop can react without restarting.
  statusRef.current = status;

  // Cinematic abort on hard failure — separate effect so it runs synchronously
  // with status changes and doesn't race the travel-restart effect.
  useEffect(() => {
    if (status === "error") {
      cancelRef.current();
      phaseRef.current = "idle";
      setFrame(null);
    }
  }, [status]);

  // Start a new cinematic run when zoneId changes. The loop itself watches
  // `statusRef` for the transition from holding → reveal.
  useEffect(() => {
    const playback = getPortalPlayback();
    const prevZone = prevZoneRef.current;
    prevZoneRef.current = zoneId;

    // Initial mount has no "from" zone — don't play a cinematic on first
    // connect. Re-runs during the same zone's lifecycle (shouldn't happen
    // since deps are [zoneId] only, but guard anyway) are also skipped.
    if (prevZone === null || prevZone === zoneId) return undefined;
    if (statusRef.current === "error") return undefined;

    cancelRef.current();
    phaseRef.current = "playing";

    let cancelled = false;
    cancelRef.current = () => {
      cancelled = true;
    };

    playback.setTime(0);
    const startWallMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    let holdStartMs: number | null = null;
    let revealStartMs: number | null = null;
    const HOLD_AT = 0.9;

    const loop = () => {
      if (cancelled) return;
      if (statusRef.current === "error") {
        phaseRef.current = "idle";
        setFrame(null);
        return;
      }
      const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();

      if (phaseRef.current === "playing") {
        const elapsedSec = (nowMs - startWallMs) / 1000;
        const t = Math.min(HOLD_AT, elapsedSec);
        playback.setTime(t);
        setFrame(playback.sample(t));
        if (t >= HOLD_AT) {
          phaseRef.current = "holding";
          holdStartMs = nowMs;
        }
      }

      if (phaseRef.current === "holding") {
        if (statusRef.current === "connected" && holdStartMs !== null) {
          const heldMs = nowMs - holdStartMs;
          if (heldMs >= MIN_HOLD_MS) {
            phaseRef.current = "reveal";
            revealStartMs = nowMs;
          }
        }
      }

      if (phaseRef.current === "reveal" && revealStartMs !== null) {
        const revealElapsed = (nowMs - revealStartMs) / 1000;
        const t = Math.min(PORTAL_DURATION_SEC, 0.9 + revealElapsed);
        playback.setTime(t);
        setFrame(playback.sample(t));
        if (t >= PORTAL_DURATION_SEC) {
          phaseRef.current = "idle";
          setFrame(null);
          return;
        }
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    return () => {
      cancelled = true;
    };
  }, [zoneId]);

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
