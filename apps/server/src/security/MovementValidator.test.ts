import { describe, expect, test } from "bun:test";
import type { Zone } from "@game/shared";
import { validateMovement } from "./MovementValidator";

const zone: Zone = {
  id: "test",
  name: "test",
  maxClients: 10,
  spawn: { x: 0, y: 0, z: 0 },
  bounds: { min: { x: -20, y: 0, z: -20 }, max: { x: 20, y: 10, z: 20 } },
  portals: [],
  theme: {
    preset: "city",
    ground: "#000",
    gridMajor: "#000",
    gridMinor: "#000",
    fog: { near: 10, far: 40 },
  },
};

describe("validateMovement", () => {
  test("accepts legal delta within speed budget", () => {
    const result = validateMovement({
      prev: { x: 0, y: 0, z: 0 },
      next: { x: 0.05, y: 0, z: 0 },
      dtMs: 50,
      zone,
      maxSpeed: 8,
      tolerance: 1.25,
    });
    expect(result.ok).toBe(true);
    expect(result.position.x).toBeCloseTo(0.05);
  });

  test("rejects teleport beyond tolerance", () => {
    const result = validateMovement({
      prev: { x: 0, y: 0, z: 0 },
      next: { x: 10, y: 0, z: 0 },
      dtMs: 50,
      zone,
      maxSpeed: 8,
      tolerance: 1.25,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("teleport");
    expect(result.position).toEqual({ x: 0, y: 0, z: 0 });
  });

  test("clamps OOB coords to zone bounds even on ok deltas", () => {
    const result = validateMovement({
      prev: { x: 19.9, y: 0, z: 0 },
      next: { x: 20.01, y: 0, z: 0 },
      dtMs: 50,
      zone,
      maxSpeed: 8,
      tolerance: 1.25,
    });
    expect(result.ok).toBe(true);
    expect(result.position.x).toBe(20);
  });

  test("applies 1/60s dt floor so dt=0 still has a finite budget", () => {
    const tiny = validateMovement({
      prev: { x: 0, y: 0, z: 0 },
      next: { x: 0.1, y: 0, z: 0 },
      dtMs: 0,
      zone,
      maxSpeed: 8,
      tolerance: 1.25,
    });
    expect(tiny.ok).toBe(true);

    const huge = validateMovement({
      prev: { x: 0, y: 0, z: 0 },
      next: { x: 5, y: 0, z: 0 },
      dtMs: 0,
      zone,
      maxSpeed: 8,
      tolerance: 1.25,
    });
    expect(huge.ok).toBe(false);
  });

  test("large teleport inside bounds is still rejected after clamp", () => {
    const result = validateMovement({
      prev: { x: 0, y: 0, z: 0 },
      next: { x: 30, y: 0, z: 30 },
      dtMs: 50,
      zone,
      maxSpeed: 8,
      tolerance: 1.25,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("teleport");
  });
});
