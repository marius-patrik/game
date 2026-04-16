export type BusId = "master" | "music" | "sfx" | "ui";

export type BusState = { volume: number; muted: boolean };

export type MixerSnapshot = Record<BusId, BusState>;

const BUSES: readonly BusId[] = ["master", "music", "sfx", "ui"] as const;

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export class MixerGraph {
  private state: MixerSnapshot;

  constructor(initial?: Partial<MixerSnapshot>) {
    const base: MixerSnapshot = {
      master: { volume: 1, muted: false },
      music: { volume: 0.6, muted: false },
      sfx: { volume: 0.9, muted: false },
      ui: { volume: 0.8, muted: false },
    };
    this.state = { ...base, ...(initial ?? {}) };
  }

  getSnapshot(): MixerSnapshot {
    return {
      master: { ...this.state.master },
      music: { ...this.state.music },
      sfx: { ...this.state.sfx },
      ui: { ...this.state.ui },
    };
  }

  setVolume(bus: BusId, volume: number): void {
    this.state[bus] = { ...this.state[bus], volume: clamp01(volume) };
  }

  setMuted(bus: BusId, muted: boolean): void {
    this.state[bus] = { ...this.state[bus], muted };
  }

  effectiveVolume(bus: Exclude<BusId, "master">): number {
    if (this.state.master.muted || this.state[bus].muted) return 0;
    return clamp01(this.state.master.volume * this.state[bus].volume);
  }

  static buses(): readonly BusId[] {
    return BUSES;
  }
}
