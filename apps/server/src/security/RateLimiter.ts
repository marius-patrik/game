import type { RateLimitConfig } from "./config";

type Bucket = { tokens: number; updatedAt: number };

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly configs: Record<string, RateLimitConfig>,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Consume one token from the bucket keyed by (sessionId, type).
   * Returns true if allowed, false if the bucket is empty.
   * Unknown types are allowed (no limit configured).
   */
  consume(sessionId: string, type: string): boolean {
    const cfg = this.configs[type];
    if (!cfg) return true;

    const key = `${sessionId}:${type}`;
    const t = this.now();
    const bucket = this.buckets.get(key);

    if (!bucket) {
      this.buckets.set(key, { tokens: cfg.capacity - 1, updatedAt: t });
      return true;
    }

    const elapsedSec = (t - bucket.updatedAt) / 1000;
    const refilled = Math.min(cfg.capacity, bucket.tokens + elapsedSec * cfg.refillPerSec);
    if (refilled < 1) {
      bucket.tokens = refilled;
      bucket.updatedAt = t;
      return false;
    }
    bucket.tokens = refilled - 1;
    bucket.updatedAt = t;
    return true;
  }

  forget(sessionId: string): void {
    for (const key of this.buckets.keys()) {
      if (key.startsWith(`${sessionId}:`)) this.buckets.delete(key);
    }
  }
}
