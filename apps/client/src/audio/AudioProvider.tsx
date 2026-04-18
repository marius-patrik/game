import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { AudioEngine } from "./AudioEngine";

type AudioContextValue = {
  engine: AudioEngine;
  unlocked: boolean;
};

const Ctx = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) engineRef.current = new AudioEngine();
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const unlock = () => {
      engine.unlock();
      setUnlocked(true);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  return <Ctx.Provider value={{ engine: engineRef.current, unlocked }}>{children}</Ctx.Provider>;
}

export function useAudio(): AudioContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAudio must be used inside <AudioProvider>");
  return ctx;
}
