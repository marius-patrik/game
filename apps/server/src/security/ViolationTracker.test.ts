import { describe, expect, test } from "bun:test";
import { ViolationTracker } from "./ViolationTracker";

describe("ViolationTracker", () => {
  test("records within window and signals kick at threshold", () => {
    const t = 0;
    const vt = new ViolationTracker({ windowMs: 1000, kickThreshold: 3 }, () => t);
    expect(vt.record("s1")).toEqual({ count: 1, shouldKick: false });
    expect(vt.record("s1")).toEqual({ count: 2, shouldKick: false });
    expect(vt.record("s1")).toEqual({ count: 3, shouldKick: true });
  });

  test("prunes stale events outside window", () => {
    let t = 0;
    const vt = new ViolationTracker({ windowMs: 1000, kickThreshold: 5 }, () => t);
    vt.record("s1");
    vt.record("s1");
    t = 1500;
    expect(vt.record("s1")).toEqual({ count: 1, shouldKick: false });
  });

  test("count reflects live window without recording", () => {
    let t = 0;
    const vt = new ViolationTracker({ windowMs: 500, kickThreshold: 10 }, () => t);
    vt.record("s1");
    vt.record("s1");
    expect(vt.count("s1")).toBe(2);
    t = 600;
    expect(vt.count("s1")).toBe(0);
  });

  test("per-session isolation", () => {
    const vt = new ViolationTracker({ windowMs: 1000, kickThreshold: 2 }, () => 0);
    vt.record("a");
    expect(vt.record("a").shouldKick).toBe(true);
    expect(vt.record("b").shouldKick).toBe(false);
  });

  test("forget removes session history", () => {
    const vt = new ViolationTracker({ windowMs: 1000, kickThreshold: 2 }, () => 0);
    vt.record("s1");
    vt.forget("s1");
    expect(vt.count("s1")).toBe(0);
  });
});
