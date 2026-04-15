export type Vec3 = { x: number; y: number; z: number };

export type Zone = {
  id: string;
  name: string;
  spawn: Vec3;
  bounds: { min: Vec3; max: Vec3 };
  maxClients: number;
};

export const ZONES = {
  lobby: {
    id: "lobby",
    name: "Lobby",
    spawn: { x: 0, y: 0.5, z: 0 },
    bounds: { min: { x: -18, y: 0, z: -18 }, max: { x: 18, y: 8, z: 18 } },
    maxClients: 64,
  },
  arena: {
    id: "arena",
    name: "Arena",
    spawn: { x: 0, y: 0.5, z: 0 },
    bounds: { min: { x: -40, y: 0, z: -40 }, max: { x: 40, y: 12, z: 40 } },
    maxClients: 32,
  },
} as const satisfies Record<string, Zone>;

export type ZoneId = keyof typeof ZONES;

export const DEFAULT_ZONE: ZoneId = "lobby";

export function getZone(id: string): Zone | undefined {
  return (ZONES as Record<string, Zone>)[id];
}

export function clampToBounds(p: Vec3, zone: Zone): Vec3 {
  const { min, max } = zone.bounds;
  return {
    x: Math.min(max.x, Math.max(min.x, p.x)),
    y: Math.min(max.y, Math.max(min.y, p.y)),
    z: Math.min(max.z, Math.max(min.z, p.z)),
  };
}
