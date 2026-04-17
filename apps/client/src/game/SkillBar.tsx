import { cn } from "@/lib/utils";
import { SKILL_BAR, SKILL_CATALOG, type SkillId } from "@game/shared";
import { useCallback, useEffect, useRef, useState } from "react";

type Cd = Partial<Record<SkillId, number>>; // skillId -> ready-at ts

export function SkillBar({
  enabled,
  mana,
  onCast,
}: {
  enabled: boolean;
  mana: number;
  onCast: (id: SkillId) => void;
}) {
  const [, force] = useState(0);
  const cdRef = useRef<Cd>({});
  const manaRef = useRef(mana);
  manaRef.current = mana;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const cast = useCallback(
    (id: SkillId) => {
      if (!enabledRef.current) return;
      const skill = SKILL_CATALOG[id];
      const now = Date.now();
      const ready = cdRef.current[id] ?? 0;
      if (now < ready) return;
      if (manaRef.current < skill.manaCost) return;
      cdRef.current = { ...cdRef.current, [id]: now + skill.cooldownMs };
      force((v) => v + 1);
      onCast(id);
    },
    [onCast],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const idx = Number.parseInt(e.key, 10);
      if (!Number.isFinite(idx)) return;
      const id = SKILL_BAR[idx - 1];
      if (!id) return;
      e.preventDefault();
      cast(id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cast]);

  useEffect(() => {
    const id = setInterval(() => force((v) => v + 1), 100);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pointer-events-auto absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-2 sm:bottom-14">
      {SKILL_BAR.map((id, idx) => {
        const skill = SKILL_CATALOG[id];
        const ready = cdRef.current[id] ?? 0;
        const now = Date.now();
        const cd = Math.max(0, ready - now);
        const cdFrac = cd > 0 ? cd / skill.cooldownMs : 0;
        const canAfford = mana >= skill.manaCost;
        const disabled = !enabled || cd > 0 || !canAfford;
        return (
          <button
            key={id}
            type="button"
            onClick={() => cast(id)}
            disabled={disabled}
            aria-label={`${skill.name} (key ${idx + 1})`}
            className={cn(
              "group relative h-14 w-14 overflow-hidden rounded-lg border-2 bg-background/80 shadow-md backdrop-blur-md transition-transform",
              disabled ? "opacity-70" : "hover:scale-105",
            )}
            style={{ borderColor: skill.color }}
          >
            <span
              className="-translate-x-1/2 absolute top-1 left-1/2 font-bold text-[11px] tabular-nums"
              style={{ color: skill.color }}
            >
              {skill.name}
            </span>
            <span className="absolute right-1 bottom-1 rounded bg-background/60 px-1 font-mono text-[10px] text-muted-foreground">
              {idx + 1}
            </span>
            <span className="-translate-x-1/2 absolute bottom-1 left-1/2 text-[10px] text-sky-400 tabular-nums">
              {skill.manaCost}
            </span>
            {cd > 0 ? (
              <span
                className="absolute inset-x-0 bottom-0 bg-background/70"
                style={{ height: `${cdFrac * 100}%` }}
              />
            ) : null}
            {cd > 0 ? (
              <span className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 font-mono font-semibold text-white text-xs">
                {(cd / 1000).toFixed(1)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
