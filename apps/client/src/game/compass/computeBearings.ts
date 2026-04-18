export type Vec2 = { x: number; y: number };
export type Vec3 = { x: number; y: number; z: number };

export type POI = {
  id: string;
  kind: "mob" | "npc" | "portal" | "quest" | "boss";
  pos: Vec3;
  label?: string;
};

/**
 * Returns the bearing from source to target in radians.
 * 0 = North (-Z), PI/2 = East (+X), PI = South (+Z), 3PI/2 = West (-X).
 */
export function bearingFromTo(from: Vec3, to: Vec3): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  // Math.atan2(x, -z) gives 0 for North, PI/2 for East, etc.
  return normalizeAngle(Math.atan2(dx, -dz));
}

/**
 * Normalizes an angle to [0, 2*PI).
 */
export function normalizeAngle(rad: number): number {
  const twoPi = Math.PI * 2;
  return ((rad % twoPi) + twoPi) % twoPi;
}

/**
 * Normalizes an angle to [-PI, PI).
 */
export function normalizeAngleSigned(rad: number): number {
  let a = rad % (Math.PI * 2);
  if (a >= Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Maps a bearing to a horizontal screen position [0, 1] relative to the
 * compass center. Returns null if the POI is outside the compass FOV.
 */
export function angleToScreenX(bearing: number, facing: number, fovRad: number): number | null {
  const diff = normalizeAngleSigned(bearing - facing);
  const halfFov = fovRad / 2;
  if (Math.abs(diff) > halfFov) return null;

  // Linear map: -halfFov -> 0, 0 -> 0.5, +halfFov -> 1
  return 0.5 + diff / fovRad;
}

/**
 * Returns distance between two points on the XZ plane.
 */
export function distanceXZ(a: Vec3, b: Vec3): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dz * dz);
}
