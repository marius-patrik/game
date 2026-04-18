import { describe, expect, test } from "bun:test";
import {
  angleToScreenX,
  bearingFromTo,
  normalizeAngle,
  normalizeAngleSigned,
} from "./computeBearings";

const PI = Math.PI;

describe("computeBearings", () => {
  describe("bearingFromTo", () => {
    const origin = { x: 0, y: 0, z: 0 };

    test("North is 0 (towards -Z)", () => {
      expect(bearingFromTo(origin, { x: 0, y: 0, z: -10 })).toBeCloseTo(0);
    });

    test("East is PI/2 (towards +X)", () => {
      expect(bearingFromTo(origin, { x: 10, y: 0, z: 0 })).toBeCloseTo(PI / 2);
    });

    test("South is PI (towards +Z)", () => {
      expect(bearingFromTo(origin, { x: 0, y: 0, z: 10 })).toBeCloseTo(PI);
    });

    test("West is 3PI/2 (towards -X)", () => {
      expect(bearingFromTo(origin, { x: -10, y: 0, z: 0 })).toBeCloseTo((3 * PI) / 2);
    });
  });

  describe("normalizeAngle", () => {
    test("keeps [0, 2PI) range", () => {
      expect(normalizeAngle(0.5)).toBeCloseTo(0.5);
      expect(normalizeAngle(PI * 2)).toBeCloseTo(0);
      expect(normalizeAngle(PI * 3)).toBeCloseTo(PI);
      expect(normalizeAngle(-0.1)).toBeCloseTo(PI * 2 - 0.1);
    });
  });

  describe("normalizeAngleSigned", () => {
    test("keeps [-PI, PI) range", () => {
      expect(normalizeAngleSigned(0)).toBeCloseTo(0);
      expect(normalizeAngleSigned(PI - 0.1)).toBeCloseTo(PI - 0.1);
      expect(normalizeAngleSigned(PI + 0.1)).toBeCloseTo(-PI + 0.1);
      expect(normalizeAngleSigned(-PI - 0.1)).toBeCloseTo(PI - 0.1);
    });
  });

  describe("angleToScreenX", () => {
    test("maps 0 centered when bearing == facing", () => {
      expect(angleToScreenX(1, 1, 1)).toBe(0.5);
    });

    test("maps edge of FOV correctly", () => {
      const fov = PI / 2; // 90 deg
      expect(angleToScreenX(0.5, 0, fov)).not.toBeNull();
      expect(angleToScreenX(0.5, 0, PI / 2)).toBeCloseTo(0.5 + 0.5 / (PI / 2));
      expect(angleToScreenX(PI / 4, 0, PI / 2)).toBeCloseTo(1.0);
      expect(angleToScreenX(-PI / 4, 0, PI / 2)).toBeCloseTo(0.0);
      expect(angleToScreenX(PI / 4 + 0.01, 0, PI / 2)).toBeNull();
    });

    test("handles wrap-around", () => {
      const fov = PI / 2;
      // Facing North (0), POI is North-West (e.g. 7 * PI / 4 = -PI / 4)
      expect(angleToScreenX((7 * PI) / 4, 0, fov)).toBeCloseTo(0);
      // Facing North (0), POI is North-East (PI / 4)
      expect(angleToScreenX(PI / 4, 0, fov)).toBeCloseTo(1);
    });
  });
});
