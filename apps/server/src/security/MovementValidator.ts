import { clampToBounds, type Vec3, type Zone } from "@game/shared/zones";

export type MovementInput = {
  prev: Vec3;
  next: Vec3;
  dtMs: number;
  zone: Zone;
  maxSpeed: number;
  tolerance: number;
};

export type MovementResult =
  | { ok: true; position: Vec3 }
  | { ok: false; reason: "teleport"; position: Vec3 };

/**
 * Validates a client-submitted next position against the previous server-accepted one.
 * - Out-of-bounds coordinates are clamped to the zone AABB.
 * - Deltas exceeding maxSpeed * dt * tolerance are rejected; the previous position is kept.
 * Returns the server-authoritative position to write to state.
 */
export function validateMovement(input: MovementInput): MovementResult {
  const clamped = clampToBounds(input.next, input.zone);
  const dx = clamped.x - input.prev.x;
  const dy = clamped.y - input.prev.y;
  const dz = clamped.z - input.prev.z;
  const distSq = dx * dx + dy * dy + dz * dz;

  const dtSec = Math.max(input.dtMs, 0) / 1000;
  const maxDist = input.maxSpeed * input.tolerance * Math.max(dtSec, 1 / 60);
  const maxDistSq = maxDist * maxDist;

  if (distSq > maxDistSq) {
    return { ok: false, reason: "teleport", position: input.prev };
  }
  return { ok: true, position: clamped };
}
