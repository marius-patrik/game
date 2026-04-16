import { Howl, Howler } from "howler";
import { type BusId, MixerGraph, type MixerSnapshot } from "./MixerGraph";

export type SoundDef = {
  id: string;
  src: string | string[];
  bus: Exclude<BusId, "master">;
  loop?: boolean;
  preload?: boolean;
};

type RegisteredSound = SoundDef & { howl: Howl };

export class AudioEngine {
  private readonly mixer = new MixerGraph();
  private readonly sounds = new Map<string, RegisteredSound>();
  private unlocked = false;

  constructor() {
    Howler.autoUnlock = true;
  }

  register(def: SoundDef): void {
    if (this.sounds.has(def.id)) return;
    const howl = new Howl({
      src: Array.isArray(def.src) ? def.src : [def.src],
      loop: def.loop ?? false,
      preload: def.preload ?? true,
      volume: this.mixer.effectiveVolume(def.bus),
    });
    this.sounds.set(def.id, { ...def, howl });
  }

  play(id: string): number | null {
    const entry = this.sounds.get(id);
    if (!entry) return null;
    entry.howl.volume(this.mixer.effectiveVolume(entry.bus));
    return entry.howl.play();
  }

  stop(id: string): void {
    this.sounds.get(id)?.howl.stop();
  }

  setBusVolume(bus: BusId, volume: number): void {
    this.mixer.setVolume(bus, volume);
    this.applyBusVolumes();
  }

  setBusMuted(bus: BusId, muted: boolean): void {
    this.mixer.setMuted(bus, muted);
    this.applyBusVolumes();
  }

  snapshot(): MixerSnapshot {
    return this.mixer.getSnapshot();
  }

  unlock(): void {
    if (this.unlocked) return;
    // Howler unlock is triggered by any play; poke it with a silent no-op.
    const ctx = Howler.ctx;
    if (ctx && ctx.state === "suspended") {
      void ctx.resume();
    }
    this.unlocked = true;
  }

  private applyBusVolumes(): void {
    for (const sound of this.sounds.values()) {
      sound.howl.volume(this.mixer.effectiveVolume(sound.bus));
    }
  }
}
