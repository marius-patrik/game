import { usePreferencesStore } from "@/state/preferencesStore";
import { useFrame, useThree } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useRef } from "react";
import { MathUtils, PerspectiveCamera, Vector3 } from "three";
import {
  CAMERA_PROFILES,
  type CameraProfile,
  type CameraProfileId,
  getCameraProfileState,
  subscribeCameraProfile,
} from "./cameraProfiles";

type Vec3 = { x: number; y: number; z: number };

const INITIAL_YAW = Math.PI * 0.75;
const TARGET_FOLLOW_TAU = 0.08; // seconds — exponential smoothing on the chase target
const MOUSE_DRAG_SENSITIVITY = 0.0065; // rad per px when drag-rotating
const POINTER_LOCK_SENSITIVITY = 0.0025; // rad per px when cursor-locked (movementX is already scaled by DPI)

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function blendProfile(a: CameraProfile, b: CameraProfile, t: number): CameraProfile {
  return {
    arm: MathUtils.lerp(a.arm, b.arm, t),
    tilt: MathUtils.lerp(a.tilt, b.tilt, t),
    height: MathUtils.lerp(a.height, b.height, t),
  };
}

/**
 * Third-person chase camera.
 *
 * - The chase **target** is a smoothed position that follows `selfPosRef`
 *   (the client-authoritative player position). It is intentionally
 *   decoupled from the player *mesh* — the sphere's bob animation lives on
 *   a child mesh, so the camera never inherits the bob frequency.
 * - **Arm length + tilt** come from the active camera profile. User cannot
 *   zoom or tilt. Profile transitions interpolate arm/tilt/height with an
 *   ease-in-out curve over `transitionMs`.
 * - **Yaw** is the only user-controlled axis. Drag-to-rotate uses pointer
 *   events on the GL canvas; cursor-lock uses raw `movementX` from the
 *   pointer-lock API.
 * - **FOV** is read from `preferencesStore.fov` and written into the
 *   PerspectiveCamera every frame — unless `fovOverrideActive` is true
 *   (the portal cinematic takes ownership during its ~1.2s window so its
 *   push animation has a stable baseline).
 */
export function ChaseCamera({
  selfPosRef,
  enabled,
  fovOverrideActive,
}: {
  selfPosRef: MutableRefObject<Vec3>;
  enabled: boolean;
  fovOverrideActive: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const fov = usePreferencesStore((s) => s.fov);

  const yawRef = useRef(INITIAL_YAW);
  const targetRef = useRef(new Vector3(selfPosRef.current.x, 0, selfPosRef.current.z));
  const initializedRef = useRef(false);

  // Active profile interpolation.
  const profileFromRef = useRef<CameraProfile>(CAMERA_PROFILES.combat);
  const profileToRef = useRef<CameraProfile>(CAMERA_PROFILES.combat);
  const profileStartRef = useRef(0);
  const profileDurationRef = useRef(0);
  const currentProfileIdRef = useRef<CameraProfileId>("combat");

  // Seed with whatever the module-level store has right now (hot-reload safe).
  useEffect(() => {
    const initial = getCameraProfileState();
    currentProfileIdRef.current = initial.id;
    profileFromRef.current = CAMERA_PROFILES[initial.id];
    profileToRef.current = CAMERA_PROFILES[initial.id];
    profileStartRef.current = 0;
    profileDurationRef.current = 0;
  }, []);

  // Subscribe to profile changes for interpolated transitions.
  useEffect(() => {
    return subscribeCameraProfile((next) => {
      const progress = profileTransitionProgress();
      const current = blendProfile(profileFromRef.current, profileToRef.current, progress);
      profileFromRef.current = current;
      profileToRef.current = CAMERA_PROFILES[next.id];
      profileStartRef.current = next.changedAt;
      profileDurationRef.current = next.transitionMs;
      currentProfileIdRef.current = next.id;
    });
  }, []);

  // Yaw input: pointer-lock mouse movement + drag-to-rotate on the canvas.
  useEffect(() => {
    if (!enabled) return;
    const dom = gl.domElement;
    let dragActive = false;
    let dragPointerId: number | null = null;

    const onPointerDown = (e: PointerEvent) => {
      if (document.pointerLockElement === document.body) return;
      if (e.button !== 0 && e.button !== 2) return;
      dragActive = true;
      dragPointerId = e.pointerId;
      try {
        dom.setPointerCapture(e.pointerId);
      } catch {
        // Safari may reject capture on already-captured pointer — ignore.
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (document.pointerLockElement === document.body) {
        yawRef.current -= e.movementX * POINTER_LOCK_SENSITIVITY;
        return;
      }
      if (!dragActive) return;
      if (dragPointerId !== null && e.pointerId !== dragPointerId) return;
      yawRef.current -= e.movementX * MOUSE_DRAG_SENSITIVITY;
    };

    const endDrag = (e: PointerEvent) => {
      if (!dragActive) return;
      if (dragPointerId !== null && e.pointerId !== dragPointerId) return;
      dragActive = false;
      dragPointerId = null;
      try {
        dom.releasePointerCapture(e.pointerId);
      } catch {
        // Already released — fine.
      }
    };

    const onContextMenu = (e: Event) => {
      // Right-drag-to-rotate is a common MMO convention; stop the browser
      // context menu from fighting it.
      e.preventDefault();
    };

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", endDrag);
    dom.addEventListener("pointercancel", endDrag);
    dom.addEventListener("contextmenu", onContextMenu);

    // Pointer-lock movement events also fire while the lock is held even if
    // no mouse button is down; browsers dispatch them on the document.
    const onDocPointerMove = (e: PointerEvent) => {
      if (document.pointerLockElement !== document.body) return;
      yawRef.current -= e.movementX * POINTER_LOCK_SENSITIVITY;
    };
    document.addEventListener("pointermove", onDocPointerMove);

    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", endDrag);
      dom.removeEventListener("pointercancel", endDrag);
      dom.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("pointermove", onDocPointerMove);
    };
  }, [enabled, gl]);

  useFrame((_, dt) => {
    if (!enabled) return;
    const src = selfPosRef.current;
    const profile = currentProfile();

    // Smooth the chase target toward the player. `selfPosRef` is already
    // the client-authoritative position (no server-echo lag), and it has
    // no vertical bob — so this smoothing is purely to soften any micro
    // jitter on reconnect / zone swap.
    const tx = src.x;
    const tz = src.z;
    if (!initializedRef.current) {
      targetRef.current.set(tx, profile.height, tz);
      initializedRef.current = true;
    } else {
      const k = 1 - Math.exp(-dt / TARGET_FOLLOW_TAU);
      targetRef.current.x = MathUtils.lerp(targetRef.current.x, tx, k);
      targetRef.current.z = MathUtils.lerp(targetRef.current.z, tz, k);
      targetRef.current.y = MathUtils.lerp(targetRef.current.y, profile.height, k);
    }

    const yaw = yawRef.current;
    const sinTilt = Math.sin(profile.tilt);
    const cosTilt = Math.cos(profile.tilt);
    const offX = Math.sin(yaw) * profile.arm * sinTilt;
    const offY = profile.arm * cosTilt;
    const offZ = Math.cos(yaw) * profile.arm * sinTilt;

    camera.position.set(
      targetRef.current.x + offX,
      targetRef.current.y + offY,
      targetRef.current.z + offZ,
    );
    camera.lookAt(targetRef.current);

    if (!fovOverrideActive && camera instanceof PerspectiveCamera) {
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    }
  });

  function profileTransitionProgress(): number {
    const dur = profileDurationRef.current;
    if (dur <= 0) return 1;
    const t = (performance.now() - profileStartRef.current) / dur;
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return easeInOutCubic(t);
  }

  function currentProfile(): CameraProfile {
    const progress = profileTransitionProgress();
    return blendProfile(profileFromRef.current, profileToRef.current, progress);
  }

  return null;
}
