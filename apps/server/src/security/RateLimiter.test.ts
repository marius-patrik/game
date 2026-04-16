import { describe, expect, test } from "bun:test";
import { RateLimiter } from "./RateLimiter";

describe("RateLimiter", () => {
  test("allows up to capacity without refill", () => {
    const rl = new RateLimiter({ move: { capacity: 3, refillPerSec: 0 } }, () => 0);
    expect(rl.consume("s1", "move")).toBe(true);
    expect(rl.consume("s1", "move")).toBe(true);
    expect(rl.consume("s1", "move")).toBe(true);
    expect(rl.consume("s1", "move")).toBe(false);
  });

  test("refills over time", () => {
    let t = 0;
    const rl = new RateLimiter({ move: { capacity: 2, refillPerSec: 2 } }, () => t);
    expect(rl.consume("s1", "move")).toBe(true);
    expect(rl.consume("s1", "move")).toBe(true);
    expect(rl.consume("s1", "move")).toBe(false);
    t = 500;
    expect(rl.consume("s1", "move")).toBe(true);
    expect(rl.consume("s1", "move")).toBe(false);
  });

  test("caps refill at capacity", () => {
    let t = 0;
    const rl = new RateLimiter({ move: { capacity: 2, refillPerSec: 10 } }, () => t);
    rl.consume("s1", "move");
    rl.consume("s1", "move");
    t = 60_000;
    expect(rl.consume("s1", "move")).toBe(true);
    expect(rl.consume("s1", "move")).toBe(true);
    expect(rl.consume("s1", "move")).toBe(false);
  });

  test("per-session isolation", () => {
    const rl = new RateLimiter({ move: { capacity: 1, refillPerSec: 0 } }, () => 0);
    expect(rl.consume("a", "move")).toBe(true);
    expect(rl.consume("a", "move")).toBe(false);
    expect(rl.consume("b", "move")).toBe(true);
    expect(rl.consume("b", "move")).toBe(false);
  });

  test("per-type isolation", () => {
    const rl = new RateLimiter(
      { move: { capacity: 1, refillPerSec: 0 }, attack: { capacity: 1, refillPerSec: 0 } },
      () => 0,
    );
    expect(rl.consume("s1", "move")).toBe(true);
    expect(rl.consume("s1", "attack")).toBe(true);
    expect(rl.consume("s1", "move")).toBe(false);
    expect(rl.consume("s1", "attack")).toBe(false);
  });

  test("unknown types are allowed", () => {
    const rl = new RateLimiter({}, () => 0);
    expect(rl.consume("s1", "random")).toBe(true);
    expect(rl.consume("s1", "random")).toBe(true);
  });

  test("forget clears buckets", () => {
    const rl = new RateLimiter({ move: { capacity: 1, refillPerSec: 0 } }, () => 0);
    rl.consume("s1", "move");
    expect(rl.consume("s1", "move")).toBe(false);
    rl.forget("s1");
    expect(rl.consume("s1", "move")).toBe(true);
  });
});
