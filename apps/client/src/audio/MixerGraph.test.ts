import { describe, expect, test } from "bun:test";
import { MixerGraph } from "./MixerGraph";

describe("MixerGraph", () => {
  test("default snapshot has all four buses", () => {
    const g = new MixerGraph();
    const snap = g.getSnapshot();
    expect(Object.keys(snap).sort()).toEqual(["master", "music", "sfx", "ui"]);
    expect(snap.master.volume).toBe(1);
    expect(snap.master.muted).toBe(false);
  });

  test("setVolume clamps to [0, 1]", () => {
    const g = new MixerGraph();
    g.setVolume("sfx", -0.5);
    expect(g.getSnapshot().sfx.volume).toBe(0);
    g.setVolume("sfx", 2);
    expect(g.getSnapshot().sfx.volume).toBe(1);
    g.setVolume("sfx", 0.42);
    expect(g.getSnapshot().sfx.volume).toBe(0.42);
  });

  test("setVolume ignores NaN", () => {
    const g = new MixerGraph();
    g.setVolume("music", Number.NaN);
    expect(g.getSnapshot().music.volume).toBe(0);
  });

  test("effectiveVolume multiplies master and bus", () => {
    const g = new MixerGraph();
    g.setVolume("master", 0.5);
    g.setVolume("sfx", 0.8);
    expect(g.effectiveVolume("sfx")).toBeCloseTo(0.4, 5);
  });

  test("muting master silences all buses", () => {
    const g = new MixerGraph();
    g.setMuted("master", true);
    expect(g.effectiveVolume("music")).toBe(0);
    expect(g.effectiveVolume("sfx")).toBe(0);
    expect(g.effectiveVolume("ui")).toBe(0);
  });

  test("muting a single bus does not affect others", () => {
    const g = new MixerGraph();
    g.setMuted("music", true);
    expect(g.effectiveVolume("music")).toBe(0);
    expect(g.effectiveVolume("sfx")).toBeGreaterThan(0);
  });

  test("snapshot is a defensive copy", () => {
    const g = new MixerGraph();
    const s = g.getSnapshot();
    s.master.volume = 0;
    expect(g.getSnapshot().master.volume).toBe(1);
  });

  test("accepts partial initial state", () => {
    const g = new MixerGraph({ music: { volume: 0.2, muted: true } });
    expect(g.effectiveVolume("music")).toBe(0);
    g.setMuted("music", false);
    expect(g.effectiveVolume("music")).toBeCloseTo(0.2, 5);
  });
});
