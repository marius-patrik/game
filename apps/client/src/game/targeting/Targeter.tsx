import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useRef } from "react";
import { peekGround } from "../cursor/cursorStore";
import { CircleTargeter, ConeTargeter, RectTargeter } from "./shapes";
import { useActiveTargeting } from "./targetingStore";

type Vec3 = { x: number; y: number; z: number };

type TargeterProps = {
  /** Live ref to the self-player position so the targeter origin tracks
   * the player each frame even while aiming. */
  selfPosRef?: MutableRefObject<Vec3>;
};

/**
 * Scene-mounted abstract targeter. Reads the active request from
 * `targetingStore` and renders the appropriate shape overlay. Delegates
 * input handling to `useTargetingInputHandlers` (mounted at the
 * `GameView` root), so this component is purely presentational.
 */
export function Targeter({ selfPosRef }: TargeterProps) {
  const active = useActiveTargeting();
  const originRef = useRef<Vec3>({ x: 0, y: 0, z: 0 });
  const groundRef = useRef<Vec3>({ x: 0, y: 0, z: 0 });

  useFrame(() => {
    if (!active) return;
    if (selfPosRef) {
      const p = selfPosRef.current;
      originRef.current.x = p.x;
      originRef.current.y = p.y;
      originRef.current.z = p.z;
    }
    const g = peekGround();
    if (g) {
      groundRef.current.x = g.x;
      groundRef.current.y = g.y;
      groundRef.current.z = g.z;
    }
  });

  if (!active) return null;

  const origin = originRef.current;
  const ground = groundRef.current;

  const shapeProps = {
    origin,
    ground,
    rangeMax: active.rangeMax,
    paramA: active.paramA,
    paramB: active.paramB,
    color: active.color,
    outOfRangeColor: active.outOfRangeColor,
  } as const;

  if (active.shape === "circle") return <CircleTargeter {...shapeProps} />;
  if (active.shape === "cone") return <ConeTargeter {...shapeProps} />;
  return <RectTargeter {...shapeProps} />;
}
