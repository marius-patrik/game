import { useEffect, useRef, useState } from "react";
import { setSourceIntent } from "./intentStore";

const SIZE = 120;
const KNOB = 48;
const RADIUS = (SIZE - KNOB) / 2;
const DEADZONE = 0.12;

export function VirtualJoystick() {
  const padRef = useRef<HTMLDivElement | null>(null);
  const pointerId = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;

    const compute = (clientX: number, clientY: number) => {
      const start = origin.current;
      if (!start) return;
      const dx = clientX - start.x;
      const dy = clientY - start.y;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, RADIUS);
      const nx = dist > 0 ? (dx / dist) * clamped : 0;
      const ny = dist > 0 ? (dy / dist) * clamped : 0;
      setOffset({ x: nx, y: ny });

      const mag = clamped / RADIUS;
      if (mag < DEADZONE) {
        setSourceIntent("touch", { x: 0, z: 0 });
        return;
      }
      const scaled = (mag - DEADZONE) / (1 - DEADZONE);
      setSourceIntent("touch", {
        x: (nx / clamped) * scaled,
        z: (ny / clamped) * scaled,
      });
    };

    const onDown = (e: PointerEvent) => {
      if (pointerId.current !== null) return;
      pointerId.current = e.pointerId;
      const rect = pad.getBoundingClientRect();
      origin.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      pad.setPointerCapture(e.pointerId);
      setActive(true);
      compute(e.clientX, e.clientY);
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId.current) return;
      compute(e.clientX, e.clientY);
      e.preventDefault();
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId.current) return;
      pointerId.current = null;
      origin.current = null;
      setOffset({ x: 0, y: 0 });
      setActive(false);
      setSourceIntent("touch", { x: 0, z: 0 });
      try {
        pad.releasePointerCapture(e.pointerId);
      } catch {}
    };

    pad.addEventListener("pointerdown", onDown);
    pad.addEventListener("pointermove", onMove);
    pad.addEventListener("pointerup", onUp);
    pad.addEventListener("pointercancel", onUp);
    return () => {
      pad.removeEventListener("pointerdown", onDown);
      pad.removeEventListener("pointermove", onMove);
      pad.removeEventListener("pointerup", onUp);
      pad.removeEventListener("pointercancel", onUp);
      setSourceIntent("touch", { x: 0, z: 0 });
    };
  }, []);

  return (
    <div
      className="pointer-events-none absolute bottom-6 left-6 touch-none select-none"
      aria-hidden="true"
    >
      <div
        ref={padRef}
        className="pointer-events-auto relative rounded-full border border-border/50 bg-background/30 backdrop-blur-md"
        style={{ width: SIZE, height: SIZE, touchAction: "none" }}
      >
        <div
          className="absolute rounded-full border border-border/60 bg-foreground/80 shadow-lg transition-transform"
          style={{
            width: KNOB,
            height: KNOB,
            left: (SIZE - KNOB) / 2,
            top: (SIZE - KNOB) / 2,
            transform: `translate(${offset.x}px, ${offset.y}px)`,
            opacity: active ? 1 : 0.6,
            transitionDuration: active ? "0ms" : "180ms",
          }}
        />
      </div>
    </div>
  );
}
