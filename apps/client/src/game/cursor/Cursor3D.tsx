import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { Group } from "three";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import {
  peekLocked,
  peekScreen,
  setCursorLocked,
  setGroundCursor,
  setScreenCursor,
} from "./cursorStore";

/**
 * 3D cursor — the visible replacement for the hidden system pointer.
 *
 * - Tracks mouse position at the window level, or writes viewport-centre
 *   when pointer lock is active (cursor-lock camera mode).
 * - Every frame raycasts the cursor onto the ground plane (y=0) and writes
 *   the result into the shared cursorStore so other components (Targeter,
 *   ClickBurst, Scene) can consume it without their own raycasters.
 * - Renders a small reticule (thin ring + four cardinal ticks) at the
 *   ground position. Tone-mapping off so the reticule reads crisp on
 *   any palette.
 */
export function Cursor3D() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const groupRef = useRef<Group>(null);

  // Scratch objects — never reallocate per frame.
  const rayRef = useRef(new Raycaster());
  const ndcRef = useRef(new Vector2());
  const planeRef = useRef(new Plane(new Vector3(0, 1, 0), 0));
  const hitRef = useRef(new Vector3());
  const tmpScreenRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const setFromEvent = (clientX: number, clientY: number) => {
      setScreenCursor(clientX, clientY);
    };

    const centreOnViewport = () => {
      if (typeof window === "undefined") return;
      setScreenCursor(window.innerWidth / 2, window.innerHeight / 2);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (document.pointerLockElement === document.body) return;
      setFromEvent(e.clientX, e.clientY);
    };

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === document.body;
      setCursorLocked(locked);
      if (locked) centreOnViewport();
    };

    const onResize = () => {
      if (peekLocked()) centreOnViewport();
    };

    // Seed once so targeting overlays have a value before the first mouse
    // move event (desktop before mouse enters the canvas, or touch devices
    // that never fire a move).
    if (typeof window !== "undefined") {
      if (document.pointerLockElement === document.body) centreOnViewport();
      else setScreenCursor(window.innerWidth / 2, window.innerHeight / 2);
      setCursorLocked(document.pointerLockElement === document.body);
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerlockchange", onPointerLockChange);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useFrame((_, dt) => {
    const dom = gl.domElement;
    const rect = dom.getBoundingClientRect();
    let screen: { x: number; y: number };
    if (peekLocked()) {
      tmpScreenRef.current.x = rect.left + rect.width / 2;
      tmpScreenRef.current.y = rect.top + rect.height / 2;
      screen = tmpScreenRef.current;
    } else {
      screen = peekScreen();
    }

    // Convert CSS pixels → NDC within the canvas rect.
    const ndc = ndcRef.current;
    ndc.x = ((screen.x - rect.left) / rect.width) * 2 - 1;
    ndc.y = -(((screen.y - rect.top) / rect.height) * 2 - 1);

    if (Number.isNaN(ndc.x) || Number.isNaN(ndc.y) || rect.width === 0) {
      setGroundCursor(null);
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }

    rayRef.current.setFromCamera(ndc, camera);
    const hit = rayRef.current.ray.intersectPlane(planeRef.current, hitRef.current);
    if (!hit) {
      setGroundCursor(null);
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }

    setGroundCursor({ x: hit.x, y: 0, z: hit.z });

    if (groupRef.current) {
      groupRef.current.position.set(hit.x, 0.02, hit.z);
      groupRef.current.rotation.y += dt * 0.8;
      groupRef.current.visible = true;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* Outer ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.22, 48]} />
        <meshBasicMaterial color="#f8fafc" transparent opacity={0.85} toneMapped={false} />
      </mesh>
      {/* Inner dot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <circleGeometry args={[0.04, 24]} />
        <meshBasicMaterial color="#f8fafc" transparent opacity={0.9} toneMapped={false} />
      </mesh>
      {/* Cardinal ticks so the reticule keeps orientation at low contrast. */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((theta) => (
        <mesh
          key={theta}
          rotation={[-Math.PI / 2, 0, theta]}
          position={[Math.cos(theta) * 0.28, 0.0015, Math.sin(theta) * 0.28]}
        >
          <planeGeometry args={[0.04, 0.1]} />
          <meshBasicMaterial color="#f8fafc" transparent opacity={0.8} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
