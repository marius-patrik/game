import {
  ALL_SKILL_IDS,
  getAbility,
  SKILL_CATALOG,
  type SkillDef,
  type SkillId,
  type SkillSlot,
  ULTIMATE_COOLDOWN_MULTIPLIER,
} from "@game/shared";
import { Sparkles, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlayerSnapshot } from "@/net/useRoom";

export function SkillsTab({
  player,
  onAllocate,
  onUnbind,
}: {
  player: PlayerSnapshot | undefined;
  onAllocate: (skillId: SkillId, slot: SkillSlot) => void;
  onUnbind: (slot: SkillSlot) => void;
}) {
  const level = player?.level ?? 1;
  const points = player?.skillPoints ?? 0;
  const s1 = player?.skillsEquipped?.[0] ?? "";
  const s2 = player?.skillsEquipped?.[1] ?? "";
  const u = player?.ultimateSkill ?? "";

  const normals = ALL_SKILL_IDS.filter((id) => SKILL_CATALOG[id].slotKind === "normal");
  const ultimates = ALL_SKILL_IDS.filter((id) => SKILL_CATALOG[id].slotKind === "ultimate");

  const slotOf = (id: string): SkillSlot | null => {
    if (id === "") return null;
    if (s1 === id) return "S1";
    if (s2 === id) return "S2";
    if (u === id) return "U";
    return null;
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <Sparkles className="size-3.5 text-amber-400" />
          <span className="font-semibold">Skill points</span>
          <span className="tabular-nums text-muted-foreground">
            {points} available · level {level}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SlotsRow s1={s1} s2={s2} u={u} onUnbind={onUnbind} />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="px-1 font-bold text-muted-foreground text-xs uppercase tracking-wider">
          Skills
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {normals.map((id) => (
            <SkillCard
              key={id}
              skill={SKILL_CATALOG[id]}
              level={level}
              points={points}
              assignedTo={slotOf(id)}
              onAllocate={(slot) => onAllocate(id, slot)}
              onUnbind={onUnbind}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 px-1 font-bold text-amber-400 text-xs uppercase tracking-wider">
          <Star className="size-3" /> Ultimates
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ultimates.map((id) => (
            <SkillCard
              key={id}
              skill={SKILL_CATALOG[id]}
              level={level}
              points={points}
              assignedTo={slotOf(id)}
              onAllocate={(slot) => onAllocate(id, slot)}
              onUnbind={onUnbind}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SlotsRow({
  s1,
  s2,
  u,
  onUnbind,
}: {
  s1: string;
  s2: string;
  u: string;
  onUnbind: (slot: SkillSlot) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <SlotBadge slot="S1" skillId={s1} onUnbind={onUnbind} />
      <SlotBadge slot="S2" skillId={s2} onUnbind={onUnbind} />
      <SlotBadge slot="U" skillId={u} onUnbind={onUnbind} />
    </div>
  );
}

function SlotBadge({
  slot,
  skillId,
  onUnbind,
}: {
  slot: SkillSlot;
  skillId: string;
  onUnbind: (slot: SkillSlot) => void;
}) {
  const skill = skillId ? SKILL_CATALOG[skillId as SkillId] : undefined;
  const ultimate = slot === "U";
  const label = ultimate ? "U" : slot;
  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-0.5 rounded-md border-2 p-1.5 text-[11px]",
        skill ? "border-sky-500/60 bg-sky-500/10" : "border-dashed border-border/50 bg-muted/20",
        ultimate && skill && "border-amber-400/70 bg-amber-400/10",
      )}
      data-slot={slot}
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-muted-foreground text-[10px] uppercase">{label}</span>
        {skill ? (
          <button
            type="button"
            onClick={() => onUnbind(slot)}
            aria-label={`Unbind ${skill.name} from ${slot}`}
            className="rounded bg-background/70 px-1 text-[9px] text-muted-foreground hover:text-foreground"
            data-unbind={slot}
          >
            unbind
          </button>
        ) : null}
      </div>
      <div className={cn("font-semibold", !skill && "text-muted-foreground")}>
        {skill?.name ?? "empty"}
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  level,
  points,
  assignedTo,
  onAllocate,
  onUnbind,
}: {
  skill: SkillDef;
  level: number;
  points: number;
  assignedTo: SkillSlot | null;
  onAllocate: (slot: SkillSlot) => void;
  onUnbind: (slot: SkillSlot) => void;
}) {
  const ability = getAbility(skill.abilityId);
  const locked = level < skill.unlockLevel;
  const ultimate = skill.slotKind === "ultimate";
  const bound = assignedTo !== null;
  const needsPoint = !bound && points < skill.costToAllocate;
  const cooldownMs = ability
    ? ultimate
      ? ability.cooldownMs * ULTIMATE_COOLDOWN_MULTIPLIER
      : ability.cooldownMs
    : 0;

  return (
    <div
      data-skill={skill.id}
      className={cn(
        "flex flex-col gap-1.5 rounded-md border p-2 text-xs",
        locked ? "border-border/30 bg-muted/10 opacity-60" : "border-border/50 bg-muted/30",
        bound && "ring-1 ring-sky-500/50",
        ultimate && !locked && "border-amber-400/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div
            className="size-3 rounded-full"
            style={{ background: ability?.color ?? "#71717a" }}
            aria-hidden="true"
          />
          <div className="font-semibold">{skill.name}</div>
          {ultimate ? <Star className="size-3 text-amber-400" /> : null}
        </div>
        {bound ? (
          <span className="rounded bg-sky-500/20 px-1.5 text-[10px] text-sky-400">
            on {assignedTo}
          </span>
        ) : null}
      </div>

      <p className="text-muted-foreground leading-snug">{skill.description}</p>

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground tabular-nums">
        <span className="flex items-center gap-0.5">
          <Zap className="size-3" />
          {(cooldownMs / 1000).toFixed(1)}s
        </span>
        {ability?.manaCost ? <span className="text-sky-400">{ability.manaCost} mana</span> : null}
        {ability?.damage ? <span>{ability.damage} dmg</span> : null}
      </div>

      {locked ? (
        <div className="text-[11px] text-amber-500/80">Unlocks at level {skill.unlockLevel}</div>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          {ultimate ? (
            <Button
              size="sm"
              variant={assignedTo === "U" ? "secondary" : "default"}
              disabled={needsPoint || assignedTo === "U"}
              onClick={() => onAllocate("U")}
              className="h-7 px-2 text-[11px]"
              data-bind="U"
            >
              {assignedTo === "U" ? "on Ultimate" : "Bind to Ultimate"}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant={assignedTo === "S1" ? "secondary" : "default"}
                disabled={needsPoint || assignedTo === "S1"}
                onClick={() => onAllocate("S1")}
                className="h-7 px-2 text-[11px]"
                data-bind="S1"
              >
                S1
              </Button>
              <Button
                size="sm"
                variant={assignedTo === "S2" ? "secondary" : "default"}
                disabled={needsPoint || assignedTo === "S2"}
                onClick={() => onAllocate("S2")}
                className="h-7 px-2 text-[11px]"
                data-bind="S2"
              >
                S2
              </Button>
            </>
          )}
          {bound ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onUnbind(assignedTo)}
              className="h-7 px-2 text-[11px]"
              data-unbind-from-card={assignedTo}
            >
              Unbind
            </Button>
          ) : null}
          {needsPoint && !bound ? (
            <span className="text-[10px] text-amber-500">Needs {skill.costToAllocate} point</span>
          ) : null}
        </div>
      )}
    </div>
  );
}
