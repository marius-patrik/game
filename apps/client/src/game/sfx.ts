/**
 * Lightweight procedural SFX — oscillator blips over a shared WebAudio
 * context. Avoids shipping audio files for the alpha; reusable as a fallback
 * when the Howler-backed AudioEngine has no registered sound for an event.
 */

type SfxName = "attack" | "hit" | "pickup" | "portal" | "levelup" | "death";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let volume = 0.5;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  return ctx;
}

export function setSfxVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
  if (master) master.gain.value = volume;
}

export function getSfxVolume(): number {
  return volume;
}

function blip(
  freq: number,
  durMs: number,
  type: OscillatorType,
  gainStart: number,
  gainEnd: number,
  freqEnd?: number,
): void {
  const c = getContext();
  const bus = master;
  if (!c || !bus) return;
  if (c.state === "suspended") void c.resume();
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (typeof freqEnd === "number")
    osc.frequency.exponentialRampToValueAtTime(freqEnd, now + durMs / 1000);
  g.gain.setValueAtTime(gainStart, now);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, gainEnd), now + durMs / 1000);
  osc.connect(g).connect(bus);
  osc.start(now);
  osc.stop(now + durMs / 1000 + 0.02);
}

function chord(freqs: number[], durMs: number, type: OscillatorType, gain: number): void {
  const c = getContext();
  const bus = master;
  if (!c || !bus) return;
  if (c.state === "suspended") void c.resume();
  const now = c.currentTime;
  freqs.forEach((f, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = f;
    const start = now + i * 0.07;
    const end = start + durMs / 1000;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(g).connect(bus);
    osc.start(start);
    osc.stop(end + 0.02);
  });
}

function noise(durMs: number, gain: number, filterFreq = 2000): void {
  const c = getContext();
  const bus = master;
  if (!c || !bus) return;
  if (c.state === "suspended") void c.resume();
  const frames = Math.floor((c.sampleRate * durMs) / 1000);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(bus);
  src.start();
}

export function playSfx(name: SfxName): void {
  switch (name) {
    case "attack":
      blip(880, 120, "square", 0.35, 0.001, 420);
      break;
    case "hit":
      blip(220, 110, "sawtooth", 0.4, 0.001, 110);
      noise(100, 0.15, 1800);
      break;
    case "pickup":
      chord([880, 1320], 140, "triangle", 0.25);
      break;
    case "portal":
      blip(120, 420, "sine", 0.2, 0.001, 880);
      noise(350, 0.08, 600);
      break;
    case "levelup":
      chord([523, 659, 784, 1046], 420, "triangle", 0.22);
      break;
    case "death":
      blip(440, 420, "sawtooth", 0.35, 0.001, 80);
      noise(380, 0.18, 900);
      break;
  }
}
