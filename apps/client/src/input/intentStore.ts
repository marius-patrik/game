import type { MoveIntent } from "./types";

type SourceId = "keyboard" | "touch";

const sources: Record<SourceId, MoveIntent> = {
  keyboard: { x: 0, z: 0 },
  touch: { x: 0, z: 0 },
};

export function setSourceIntent(id: SourceId, intent: MoveIntent) {
  sources[id].x = intent.x;
  sources[id].z = intent.z;
}

export function readMoveIntent(out: MoveIntent): MoveIntent {
  let x = 0;
  let z = 0;
  for (const id of Object.keys(sources) as SourceId[]) {
    x += sources[id].x;
    z += sources[id].z;
  }
  const mag = Math.hypot(x, z);
  if (mag > 1) {
    x /= mag;
    z /= mag;
  }
  out.x = x;
  out.z = z;
  return out;
}
