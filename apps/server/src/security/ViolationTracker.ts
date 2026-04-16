export type ViolationTrackerConfig = {
  windowMs: number;
  kickThreshold: number;
};

export class ViolationTracker {
  private readonly events = new Map<string, number[]>();

  constructor(
    private readonly config: ViolationTrackerConfig,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Record a violation for the session. Returns the count inside the sliding window
   * after recording, and whether the kick threshold was reached.
   */
  record(sessionId: string): { count: number; shouldKick: boolean } {
    const t = this.now();
    const cutoff = t - this.config.windowMs;
    const prior = this.events.get(sessionId) ?? [];
    const pruned = prior.filter((ts) => ts >= cutoff);
    pruned.push(t);
    this.events.set(sessionId, pruned);
    return {
      count: pruned.length,
      shouldKick: pruned.length >= this.config.kickThreshold,
    };
  }

  count(sessionId: string): number {
    const t = this.now();
    const cutoff = t - this.config.windowMs;
    const arr = (this.events.get(sessionId) ?? []).filter((ts) => ts >= cutoff);
    if (arr.length > 0) this.events.set(sessionId, arr);
    else this.events.delete(sessionId);
    return arr.length;
  }

  forget(sessionId: string): void {
    this.events.delete(sessionId);
  }
}
