import { Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { PlayerSnapshot } from "@/net/useRoom";

/**
 * Always-visible party HUD — top-left, shows up to 3 other members' HP/mana
 * pips when the local player is in a party. Hidden when solo. Members are
 * derived from the shared players map matching the local player's partyId.
 */
export function PartyPanel({
  players,
  sessionId,
}: {
  players: Map<string, PlayerSnapshot>;
  sessionId?: string;
}) {
  const self = sessionId ? players.get(sessionId) : undefined;
  if (!self?.partyId) return null;

  const members: PlayerSnapshot[] = [];
  for (const p of players.values()) {
    if (p.partyId !== self.partyId) continue;
    if (p.id === sessionId) continue;
    members.push(p);
  }
  if (members.length === 0) return null;

  return (
    <div className="polish-glass pointer-events-none absolute bottom-[168px] left-2 z-10 flex flex-col gap-1.5 rounded-[var(--radius-lg)] px-2.5 py-2 sm:bottom-[184px] sm:left-4">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
        <Users className="size-3" />
        Party
      </div>
      {members.slice(0, 3).map((m) => (
        <MemberPip key={m.id} member={m} />
      ))}
    </div>
  );
}

function MemberPip({ member }: { member: PlayerSnapshot }) {
  const hpPct = member.maxHp > 0 ? Math.min(100, (member.hp / member.maxHp) * 100) : 0;
  const manaPct = member.maxMana > 0 ? Math.min(100, (member.mana / member.maxMana) * 100) : 0;
  return (
    <div className="flex min-w-[140px] flex-col gap-0.5">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="truncate font-medium">{member.name || member.id.slice(0, 6)}</span>
        <span className="tabular-nums text-muted-foreground">Lv {member.level}</span>
      </div>
      <Progress
        value={hpPct}
        indicatorClassName={!member.alive ? "bg-muted-foreground" : "bg-rose-500"}
        className="h-1.5"
      />
      <Progress value={manaPct} indicatorClassName="bg-sky-500" className="h-1" />
    </div>
  );
}
