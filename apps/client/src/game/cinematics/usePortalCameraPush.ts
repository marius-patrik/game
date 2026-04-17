import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { PerspectiveCamera } from "three";
import { PHASES, getPortalPlayback } from "./portalSheet";

const FOV_DELTA = 6; // degrees — subtle push/zoom while the scene is still visible

/**
 * Reads the shared portal sheet's current position and nudges the camera FOV
 * inward during the camera-push phase (0.0-0.6s). Pure additive — restores
 * the camera's baseline FOV the instant the cinematic exits. No mesh, no
 * draw-call impact, safe for mobile budgets.
 */
export function usePortalCameraPush({ active }: { active: boolean }) {
  const camera = useThree((s) => s.camera);
  const baseFovRef = useRef<number | null>(null);

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return undefined;
    if (!active) {
      if (baseFovRef.current != null) {
        camera.fov = baseFovRef.current;
        camera.updateProjectionMatrix();
        baseFovRef.current = null;
      }
      return undefined;
    }
    if (baseFovRef.current == null) baseFovRef.current = camera.fov;
    return () => {
      if (baseFovRef.current != null && camera instanceof PerspectiveCamera) {
        camera.fov = baseFovRef.current;
        camera.updateProjectionMatrix();
      }
      baseFovRef.current = null;
    };
  }, [active, camera]);

  useFrame(() => {
    if (!active) return;
    if (!(camera instanceof PerspectiveCamera)) return;
    const base = baseFovRef.current;
    if (base == null) return;
    const playback = getPortalPlayback();
    const t = playback.readPosition();
    const phaseT = Math.max(
      0,
      Math.min(
        1,
        (t - PHASES.cameraPush.start) / (PHASES.cameraPush.end - PHASES.cameraPush.start),
      ),
    );
    const eased = phaseT < 0.5 ? 2 * phaseT * phaseT : 1 - (-2 * phaseT + 2) ** 2 / 2;
    const nextFov = base - FOV_DELTA * eased;
    if (Math.abs(camera.fov - nextFov) > 0.01) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }
  });
}
