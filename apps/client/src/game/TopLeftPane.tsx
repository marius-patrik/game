import {
  type ChatChannel,
  type ChatEntry,
  EQUIP_SLOTS,
  type EquipSlot,
  getAbility,
  getItem,
  type ItemId,
  isItemId,
  QUEST_CATALOG,
  type SkillId,
  type SkillSlot,
  type StatKey,
  ZONES,
  type ZoneId,
} from "@game/shared";
import {
  Backpack,
  Box,
  ChevronsRight,
  Coins,
  Info,
  Map as MapIcon,
  MessageSquare,
  Minus,
  Plus,
  ScrollText,
  Shield,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { canBindItemToHotbar, HOTBAR_ITEM_MIME } from "@/game/hotbar/shared";
import { cn } from "@/lib/utils";
import type { HazardSnapshot, MobSnapshot, NpcSnapshot, PlayerSnapshot } from "@/net/useRoom";
import { DailyQuestsHeader } from "./DailyQuestsHeader";
import { Minimap } from "./Minimap";
import { SkillsTab } from "./SkillsTab";

type Tab = "map" | "quests" | "chat" | "info" | "inventory" | "skills";

const TABS: { id: Tab; label: string; Icon: typeof MapIcon }[] = [
  { id: "map", label: "Map", Icon: MapIcon },
  { id: "quests", label: "Quests", Icon: ScrollText },
  { id: "chat", label: "Chat", Icon: MessageSquare },
  { id: "info", label: "Info", Icon: Info },
  { id: "inventory", label: "Inventory", Icon: Backpack },
  { id: "skills", label: "Skills", Icon: Sparkles },
];

/**
 * Top-left tabbed pane — the main HUD container. Holds Map / Quests / Chat /
 * Info / Inventory / Skills. Tabs collapse to icon-only pills on narrow
 * viewports. Each tab's content fills the pane height.
 */
export function TopLeftPane({
  zoneId,
  players,
  mobs,
  npcs,
  hazards,
  sessionId,
  chat,
  onSendChat,
  quests,
  dailyQuests,
  onTurnInQuest,
  canTurnIn,
  self,
  onAllocateStat,
  onUnequipSlot,
  onUse,
  onEquip,
  onEquipSlot,
  onDrop,
  onAllocateSkill,
  onUnbindSkill,
}: {
  zoneId: ZoneId;
  players: Map<string, PlayerSnapshot>;
  mobs: Map<string, MobSnapshot>;
  npcs: Map<string, NpcSnapshot>;
  hazards: Map<string, HazardSnapshot>;
  sessionId?: string;
  chat: ChatEntry[];
  onSendChat: (channel: ChatChannel, text: string) => void;
  quests: PlayerSnapshot["quests"];
  dailyQuests: PlayerSnapshot["dailyQuests"];
  onTurnInQuest: (id: string) => void;
  canTurnIn: boolean;
  self: PlayerSnapshot | undefined;
  onAllocateStat: (stat: StatKey) => void;
  onUnequipSlot: (slot: EquipSlot) => void;
  onUse: (itemId: string) => void;
  onEquip: (itemId: string) => void;
  onEquipSlot: (slot: EquipSlot, itemId: string) => void;
  onDrop: (itemId: string, qty: number) => void;
  onAllocateSkill: (skillId: SkillId, slot: SkillSlot) => void;
  onUnbindSkill: (slot: SkillSlot) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<Tab>("map");
  const keyboardAutoCollapsedRef = useRef(false);

  // Auto-collapse when the soft keyboard opens while the chat tab is focused
  // (mobile only — the chat input fills the remaining HUD space and would
  // otherwise push the bottom bars offscreen). Re-open once the keyboard dismisses.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const baseline = vv.height;
    const onResize = () => {
      if (tab !== "chat") return;
      const shrunk = vv.height < baseline - 120;
      if (shrunk && !collapsed) {
        setCollapsed(true);
        keyboardAutoCollapsedRef.current = true;
      } else if (!shrunk && keyboardAutoCollapsedRef.current) {
        setCollapsed(false);
        keyboardAutoCollapsedRef.current = false;
      }
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, [tab, collapsed]);

  return (
    <div
      className={cn(
        "pointer-events-auto absolute top-2 left-2 flex max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-border/40 bg-background/85 shadow-xl backdrop-blur-md sm:top-4 sm:left-4",
        collapsed ? "h-auto" : "h-[60vh] w-[min(360px,calc(100vw-1rem))] sm:h-[min(520px,70vh)]",
      )}
      data-testid="top-left-pane"
    >
      {collapsed ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-full justify-between px-3"
          onClick={() => setCollapsed(false)}
        >
          <span className="text-xs text-muted-foreground">open panel</span>
          <ChevronsRight className="size-3" />
        </Button>
      ) : (
        <>
          <div className="flex items-center justify-between border-border/40 border-b">
            <div className="flex flex-wrap">
              {TABS.map(({ id, label, Icon }) => (
                <TabBtn
                  key={id}
                  current={tab}
                  value={id}
                  onChange={setTab}
                  icon={<Icon className="size-3.5" />}
                >
                  {label}
                </TabBtn>
              ))}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse panel"
            >
              <ChevronsRight className="size-3 rotate-180" />
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {tab === "map" ? (
              <MapTab
                zoneId={zoneId}
                players={players}
                mobs={mobs}
                npcs={npcs}
                hazards={hazards}
                sessionId={sessionId}
              />
            ) : null}
            {tab === "quests" ? (
              <div className="flex-1 overflow-auto">
                <QuestsTab
                  quests={quests}
                  dailyQuests={dailyQuests}
                  onTurnIn={onTurnInQuest}
                  canTurnIn={canTurnIn}
                />
              </div>
            ) : null}
            {tab === "chat" ? (
              <ChatTab
                entries={chat}
                onSend={onSendChat}
                selfName={sessionId ? (players.get(sessionId)?.name ?? "") : ""}
              />
            ) : null}
            {tab === "info" ? (
              <div className="flex-1 overflow-auto">
                <InfoTab player={self} onAllocate={onAllocateStat} />
              </div>
            ) : null}
            {tab === "inventory" ? (
              <div className="flex-1 overflow-auto">
                <InventoryTab
                  player={self}
                  onUse={onUse}
                  onEquip={onEquip}
                  onEquipSlot={onEquipSlot}
                  onUnequipSlot={onUnequipSlot}
                  onDrop={onDrop}
                />
              </div>
            ) : null}
            {tab === "skills" ? (
              <div className="flex-1 overflow-auto">
                <SkillsTab player={self} onAllocate={onAllocateSkill} onUnbind={onUnbindSkill} />
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function TabBtn({
  current,
  value,
  onChange,
  icon,
  children,
}: {
  current: Tab;
  value: Tab;
  onChange: (t: Tab) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={cn(
        "flex items-center gap-1 px-2.5 py-1.5 text-[11px] transition-colors",
        active
          ? "border-primary border-b-2 text-foreground"
          : "border-transparent border-b-2 text-muted-foreground hover:text-foreground",
      )}
      data-tab={value}
      data-active={active}
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
    </button>
  );
}

function MapTab({
  zoneId,
  players,
  mobs,
  npcs,
  hazards,
  sessionId,
}: {
  zoneId: ZoneId;
  players: Map<string, PlayerSnapshot>;
  mobs: Map<string, MobSnapshot>;
  npcs: Map<string, NpcSnapshot>;
  hazards: Map<string, HazardSnapshot>;
  sessionId?: string;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden p-3">
      <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider">{ZONES[zoneId].name}</span>
        <span>
          {players.size} player{players.size === 1 ? "" : "s"} · {mobs.size} hostile
        </span>
      </div>
      <div className="relative min-h-0 flex-1">
        <Minimap
          zoneId={zoneId}
          players={players}
          mobs={mobs}
          npcs={npcs}
          hazards={hazards}
          sessionId={sessionId}
        />
      </div>
    </div>
  );
}

function QuestsTab({
  quests,
  dailyQuests,
  onTurnIn,
  canTurnIn,
}: {
  quests: PlayerSnapshot["quests"];
  dailyQuests: PlayerSnapshot["dailyQuests"];
  onTurnIn: (id: string) => void;
  canTurnIn: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <DailyQuestsHeader dailyQuests={dailyQuests} />

      <div className="flex flex-col gap-2">
        <h3 className="px-1 font-bold text-muted-foreground text-xs uppercase tracking-wider">
          Side Quests
        </h3>
        {quests.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground text-xs">
            No quests yet. Talk to Elder Cubius.
          </p>
        ) : (
          Object.values(QUEST_CATALOG)
            .filter((def) => !def.isDaily)
            .map((def) => {
              const q = quests.find((x) => x.id === def.id);
              if (!q) return null;
              const frac = q.goal > 0 ? Math.min(100, (q.progress / q.goal) * 100) : 0;
              const turnedIn = q.status === "turned_in";
              const complete = q.status === "complete";
              return (
                <div
                  key={def.id}
                  className="flex flex-col gap-1.5 rounded-md border border-border/40 bg-muted/30 p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm">{def.title}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                      {turnedIn ? "done" : complete ? "ready" : "active"}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{def.summary}</div>
                  <Progress
                    value={frac}
                    indicatorClassName={
                      turnedIn ? "bg-muted-foreground" : complete ? "bg-emerald-500" : "bg-sky-500"
                    }
                    className="h-1.5"
                  />
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="tabular-nums">
                      {q.progress}/{q.goal}
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span>+{def.xpReward} XP</span>
                      <span className="flex items-center gap-1 text-amber-400">
                        <Coins className="size-3" />
                        {def.goldReward}
                      </span>
                    </span>
                  </div>
                  {complete && !turnedIn ? (
                    <Button
                      size="sm"
                      disabled={!canTurnIn}
                      onClick={() => onTurnIn(def.id)}
                      title={canTurnIn ? "Turn in" : "Talk to Elder Cubius in the lobby"}
                    >
                      {canTurnIn ? "Turn in" : "Visit Elder Cubius"}
                    </Button>
                  ) : null}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}

function ChatTab({
  entries,
  onSend,
  selfName,
}: {
  entries: ChatEntry[];
  onSend: (channel: ChatChannel, text: string) => void;
  selfName: string;
}) {
  const [channel, setChannel] = useState<Exclude<ChatChannel, "dm">>("zone");
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are intentional triggers only
  useEffect(() => {
    if (stickRef.current && listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [entries]);

  const submit = () => {
    const raw = draft.trim();
    if (!raw) return;
    let ch: Exclude<ChatChannel, "dm"> = channel;
    let text = raw;
    if (raw.startsWith("/g ")) {
      ch = "global";
      text = raw.slice(3).trim();
    } else if (raw.startsWith("/z ")) {
      ch = "zone";
      text = raw.slice(3).trim();
    }
    if (!text) return;
    onSend(ch, text);
    setDraft("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-border/40 border-b p-1">
        <ChannelChip current={channel} value="zone" onChange={setChannel} label="zone" />
        <ChannelChip current={channel} value="global" onChange={setChannel} label="global" />
      </div>
      <div
        ref={listRef}
        onScroll={() => {
          const l = listRef.current;
          if (!l) return;
          const gap = l.scrollHeight - (l.scrollTop + l.clientHeight);
          stickRef.current = gap <= 24;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5 text-xs"
      >
        {entries.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">no messages yet</p>
        ) : (
          entries.map((e) => <ChatLine key={e.id} entry={e} selfName={selfName} />)
        )}
      </div>
      <form
        className="flex flex-col gap-1 border-border/40 border-t p-1.5"
        onSubmit={(ev) => {
          ev.preventDefault();
          submit();
        }}
      >
        <div className="flex items-center gap-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="say…"
            aria-label="Chat message"
            maxLength={200}
            style={{ fontSize: "14px" }}
            className="flex-1 rounded bg-muted px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button type="submit" size="sm" className="h-8" disabled={draft.trim().length === 0}>
            Send
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground leading-tight">
          /w &lt;name&gt; msg · /block &lt;name&gt; · /party invite &lt;name&gt; · /party accept ·
          /party leave
        </p>
      </form>
    </div>
  );
}

function ChannelChip({
  current,
  value,
  onChange,
  label,
}: {
  current: Exclude<ChatChannel, "dm">;
  value: Exclude<ChatChannel, "dm">;
  onChange: (v: Exclude<ChatChannel, "dm">) => void;
  label: string;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={cn(
        "rounded px-2 py-0.5 text-[11px] transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-transparent text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

function ChatLine({ entry, selfName }: { entry: ChatEntry; selfName: string }) {
  if (entry.channel === "dm") {
    const outgoing = entry.from === selfName;
    const peer = outgoing ? (entry.to ?? "?") : entry.from;
    const prefix = outgoing ? `[dm to ${peer}]` : `[dm from ${peer}]`;
    return (
      <div className="break-words font-mono text-[11px] italic leading-5">
        <span className="mr-1 text-violet-400">{prefix}</span>
        <span className="text-muted-foreground">: </span>
        <span className="text-foreground">{entry.text}</span>
      </div>
    );
  }
  const channelColor = entry.channel === "global" ? "text-amber-500" : "text-sky-500";
  const channelLabel = entry.channel === "global" ? "[g]" : "[z]";
  return (
    <div className="break-words font-mono text-[11px] leading-5">
      <span className={cn("mr-1", channelColor)}>{channelLabel}</span>
      <span className="font-semibold text-foreground">{entry.from}</span>
      <span className="text-muted-foreground">: </span>
      <span className="text-foreground">{entry.text}</span>
    </div>
  );
}

const STAT_ROWS: { key: StatKey; label: string; desc: string }[] = [
  { key: "strength", label: "Strength", desc: "+1 damage per 2 STR" },
  { key: "dexterity", label: "Dexterity", desc: "-15ms attack cooldown per DEX" },
  { key: "vitality", label: "Vitality", desc: "+8 max HP per VIT" },
  { key: "intellect", label: "Intellect", desc: "+6 max mana, faster mana regen" },
];

function baseKeyFor(
  stat: StatKey,
): "baseStrength" | "baseDexterity" | "baseVitality" | "baseIntellect" {
  if (stat === "strength") return "baseStrength";
  if (stat === "dexterity") return "baseDexterity";
  if (stat === "vitality") return "baseVitality";
  return "baseIntellect";
}

function InfoTab({
  player,
  onAllocate,
}: {
  player: PlayerSnapshot | undefined;
  onAllocate: (stat: StatKey) => void;
}) {
  if (!player) {
    return <div className="p-3 text-center text-muted-foreground text-xs">loading…</div>;
  }
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-0.5">
        <div className="font-semibold text-sm">{player.name || "Adventurer"}</div>
        <div className="text-muted-foreground text-xs">
          Level {player.level} · {player.statPoints} unspent stat point
          {player.statPoints === 1 ? "" : "s"}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {STAT_ROWS.map((row) => {
          const base = player[baseKeyFor(row.key)];
          const effective = player[row.key];
          const bonus = effective - base;
          return (
            <div
              key={row.key}
              className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-muted/30 p-2"
            >
              <div className="min-w-0">
                <div className="font-semibold text-sm">
                  {row.label}{" "}
                  <span className="text-muted-foreground tabular-nums">{effective}</span>
                  {bonus !== 0 ? (
                    <span
                      className={cn(
                        "ml-1 text-[11px] tabular-nums",
                        bonus > 0 ? "text-emerald-400" : "text-rose-400",
                      )}
                    >
                      ({base}
                      {bonus >= 0 ? " +" : " "}
                      {bonus})
                    </span>
                  ) : null}
                </div>
                <div className="text-muted-foreground text-[11px] leading-snug">{row.desc}</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={player.statPoints <= 0}
                onClick={() => onAllocate(row.key)}
                aria-label={`Spend point on ${row.label}`}
              >
                <Plus className="size-3" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SLOT_LABEL: Record<EquipSlot, string> = {
  weapon: "Weapon",
  head: "Head",
  chest: "Chest",
  ring: "Ring",
};

function InventoryTab({
  player,
  onUse,
  onEquip,
  onEquipSlot,
  onUnequipSlot,
  onDrop,
}: {
  player: PlayerSnapshot | undefined;
  onUse: (itemId: string) => void;
  onEquip: (itemId: string) => void;
  onEquipSlot: (slot: EquipSlot, itemId: string) => void;
  onUnequipSlot: (slot: EquipSlot) => void;
  onDrop: (itemId: string, qty: number) => void;
}) {
  if (!player) {
    return <div className="p-3 text-center text-muted-foreground text-xs">loading…</div>;
  }
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 px-1 font-bold text-muted-foreground text-xs uppercase tracking-wider">
          <Shield className="size-3" /> Equipment
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {EQUIP_SLOTS.map((slot) => (
            <EquipSlotRow
              key={slot}
              slot={slot}
              itemId={player.equipment?.[slot] ?? ""}
              onUnequip={() => onUnequipSlot(slot)}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 px-1 font-bold text-muted-foreground text-xs uppercase tracking-wider">
          <Box className="size-3" /> Inventory
        </h3>
        {player.inventory.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground text-xs">Empty</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {player.inventory.map((slot, idx) => (
              <InventoryItemRow
                key={`${slot.itemId}-${idx}`}
                itemId={slot.itemId}
                qty={slot.qty}
                onUse={() => onUse(slot.itemId)}
                onEquip={() => {
                  const def = getItem(slot.itemId);
                  if (def?.slot) onEquipSlot(def.slot, slot.itemId);
                  else onEquip(slot.itemId);
                }}
                onDrop={() => onDrop(slot.itemId, 1)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EquipSlotRow({
  slot,
  itemId,
  onUnequip,
}: {
  slot: EquipSlot;
  itemId: string;
  onUnequip: () => void;
}) {
  const def = itemId ? getItem(itemId) : undefined;
  const primary = def?.primaryAbilityId ? getAbility(def.primaryAbilityId) : undefined;
  const secondary = def?.secondaryAbilityId ? getAbility(def.secondaryAbilityId) : undefined;
  const color =
    def?.rarity === "legendary"
      ? "#fbbf24"
      : def?.rarity === "rare"
        ? "#60a5fa"
        : def
          ? "#a1a1aa"
          : "#4b5563";
  return (
    <div
      className="flex flex-col gap-1 rounded-md border border-border/40 bg-muted/30 p-2"
      data-slot={slot}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
          {SLOT_LABEL[slot]}
        </span>
        {def ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onUnequip}
            aria-label={`Unequip ${SLOT_LABEL[slot]}`}
            title={`Unequip ${def.name}`}
          >
            <Minus className="size-3" />
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <div className="size-5 shrink-0 rounded" style={{ background: color }} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-xs" style={{ color }}>
            {def?.name ?? "Empty"}
          </div>
          {def ? (
            <div className="text-[10px] text-muted-foreground">
              {[
                def.damageBonus ? `+${def.damageBonus} dmg` : null,
                def.strBonus ? `+${def.strBonus} STR` : null,
                def.dexBonus ? `+${def.dexBonus} DEX` : null,
                def.vitBonus ? `+${def.vitBonus} VIT` : null,
                def.intBonus ? `+${def.intBonus} INT` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "no bonuses"}
            </div>
          ) : null}
        </div>
      </div>
      {slot === "weapon" && (primary || secondary) ? (
        <div className="flex items-center gap-1 border-border/40 border-t pt-1 text-[10px] text-muted-foreground">
          {primary ? (
            <span title={primary.description}>
              <span className="text-foreground/80">W1</span>{" "}
              <span style={{ color: primary.color }}>{primary.name}</span>
            </span>
          ) : null}
          {secondary ? (
            <span className="ml-2" title={secondary.description}>
              <span className="text-foreground/80">W2</span>{" "}
              <span style={{ color: secondary.color }}>{secondary.name}</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function InventoryItemRow({
  itemId,
  qty,
  onUse,
  onEquip,
  onDrop,
}: {
  itemId: string;
  qty: number;
  onUse: () => void;
  onEquip: () => void;
  onDrop: () => void;
}) {
  const def = isItemId(itemId) ? getItem(itemId as ItemId) : undefined;
  const color =
    def?.rarity === "legendary"
      ? "#fbbf24"
      : def?.rarity === "rare"
        ? "#60a5fa"
        : def
          ? "#a1a1aa"
          : "#4b5563";
  const canUse = def?.kind === "consumable";
  const canEquip = Boolean(def?.slot);
  const canDragToHotbar = canBindItemToHotbar(itemId);
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-md border border-border/40 bg-muted/30 p-2",
        canDragToHotbar && "cursor-grab active:cursor-grabbing",
      )}
      data-item={itemId}
    >
      <div className="flex items-center gap-2">
        <div className="size-4 shrink-0 rounded" style={{ background: color }} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-xs" style={{ color }}>
            {def?.name ?? itemId}
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground tabular-nums">
            <span>×{qty}</span>
            {canDragToHotbar ? (
              <button
                type="button"
                draggable
                className="cursor-grab uppercase tracking-wide active:cursor-grabbing"
                title={`${def?.name ?? itemId} — drag to I1/I2 or use the action buttons below`}
                aria-label={`Drag ${def?.name ?? itemId} into a hotbar item slot`}
                onClick={(event) => event.preventDefault()}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(HOTBAR_ITEM_MIME, itemId);
                }}
              >
                drag
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        {canUse ? (
          <Button
            size="sm"
            variant="secondary"
            className="h-6 flex-1 px-2 text-[11px]"
            onClick={onUse}
          >
            Use
          </Button>
        ) : null}
        {canEquip ? (
          <Button
            size="sm"
            variant="secondary"
            className="h-6 flex-1 px-2 text-[11px]"
            onClick={onEquip}
          >
            Equip
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[11px] text-muted-foreground"
          onClick={onDrop}
          title="Drop one"
        >
          Drop
        </Button>
      </div>
    </div>
  );
}
