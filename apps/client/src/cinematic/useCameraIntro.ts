import { useQuality } from "@/assets";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { scaleCinematicDuration } from "./durations";
import { easeInOutCubic, lerp } from "./easings";

type CameraIntroProps = {
  active: boolean;
  baseDurationMs?: number;
  from?: [number, number, number];
  to?: [number, number, number];
  onComplete: () => void;
};

export function useCameraIntro({
  active,
  baseDurationMs = 4000,
  from = [0, 12, 22],
  to = [4, 4, 8],
  onComplete,
}: CameraIntroProps) {
  const { tier } = useQuality();
  const camera = useThree((state) => state.camera);
  const durationMs = scaleCinematicDuration(baseDurationMs, tier);
  const elapsedRef = useRef(0);
  const completedRef = useRef(false);
  const targetRef = useRef(new Vector3(0, 0, 0));

  useEffect(() => {
    if (!active) return;
    elapsedRef.current = 0;
    completedRef.current = false;
    camera.position.set(from[0], from[1], from[2]);
    camera.lookAt(targetRef.current);
  }, [active, from, camera]);

  useFrame((_, dt) => {
    if (!active || completedRef.current) return;
    elapsedRef.current += dt * 1000;
    const t = Math.min(1, elapsedRef.current / durationMs);
    const eased = easeInOutCubic(t);
    camera.position.set(
      lerp(from[0], to[0], eased),
      lerp(from[1], to[1], eased),
      lerp(from[2], to[2], eased),
    );
    camera.lookAt(targetRef.current);
    if (t >= 1) {
      completedRef.current = true;
      onComplete();
    }
  });
}
