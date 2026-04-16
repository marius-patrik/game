export type RateLimitConfig = {
  capacity: number;
  refillPerSec: number;
};

export type SecurityConfig = {
  rateLimits: Record<string, RateLimitConfig>;
  movement: {
    maxSpeed: number;
    tolerance: number;
  };
  violations: {
    windowMs: number;
    kickThreshold: number;
  };
};

export const DEFAULT_SECURITY: SecurityConfig = {
  rateLimits: {
    move: { capacity: 30, refillPerSec: 30 },
    attack: { capacity: 5, refillPerSec: 5 },
    chat: { capacity: 2, refillPerSec: 2 },
  },
  movement: {
    maxSpeed: 8,
    tolerance: 1.25,
  },
  violations: {
    windowMs: 30_000,
    kickThreshold: 10,
  },
};
