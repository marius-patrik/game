import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { MobSnapshot, NpcSnapshot, PlayerSnapshot } from "@/net/useRoom";
import { type ChatChannel, type ChatEntry, QUEST_CATALOG, type ZoneId } from "@game/shared";
import { ChevronsRight, Coins, Map as MapIcon, MessageSquare, ScrollText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Minimap } from "./Minimap";

type Tab = "map" | "quests" | "chat";

export function SidePanel({
  zoneId,
  players,
  mobs,
  npcs,
  sessionId,
  chat,
  onSendChat,
  quests,
  onTurnInQuest,
  canTurnIn,
}: {
  zoneId: ZoneId;
  players: Map<string, PlayerSnapshot>;
  mobs: Map<string, MobSnapshot>;
  npcs: Map<string, NpcSnapshot>;
  sessionId?: string;
  chat: ChatEntry[];
  onSendChat: (channel: ChatChannel, text: string) => void;
  quests: PlayerSnapshot["quests"];
  onTurnInQuest: (id: string) => void;
  canTurnIn: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<Tab>("map");
  const keyboardAutoCollapsedRef = useRef(false);

  // Auto-collapse when the soft keyboard opens while the chat tab is focused
  // (mobile only — the chat input fills the remaining HUD space and would
  // otherwise push the ActionBar offscreen). Re-open once the keyboard dismisses.
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
    <div className="pointer-events-auto absolute right-2 bottom-32 flex max-h-[50vh] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-border/40 bg-background/85 shadow-xl backdrop-blur-md sm:right-4 sm:bottom-24 sm:w-[320px]">
      {collapsed ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-full justify-between"
          onClick={() => setCollapsed(false)}
        >
          <span className="text-xs text-muted-foreground">open panel</span>
          <ChevronsRight className="size-3 rotate-180" />
        </Button>
      ) : (
        <>
          <div className="flex items-center justify-between border-border/40 border-b">
            <div className="flex">
              <TabBtn
                current={tab}
                value="map"
                onChange={setTab}
                icon={<MapIcon className="size-3.5" />}
              >
                Map
              </TabBtn>
              <TabBtn
                current={tab}
                value="quests"
                onChange={setTab}
                icon={<ScrollText className="size-3.5" />}
              >
                Quests
              </TabBtn>
              <TabBtn
                current={tab}
                value="chat"
                onChange={setTab}
                icon={<MessageSquare className="size-3.5" />}
              >
                Chat
              </TabBtn>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse panel"
            >
              <ChevronsRight className="size-3" />
            </Button>
          </div>
          <div className="flex-1 overflow-auto">
            {tab === "map" ? (
              <div className="flex items-center justify-center p-3">
                <Minimap
                  zoneId={zoneId}
                  players={players}
                  mobs={mobs}
                  npcs={npcs}
                  sessionId={sessionId}
                />
              </div>
            ) : null}
            {tab === "quests" ? (
              <QuestsTab quests={quests} onTurnIn={onTurnInQuest} canTurnIn={canTurnIn} />
            ) : null}
            {tab === "chat" ? <ChatTab entries={chat} onSend={onSendChat} /> : null}
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
        "flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors",
        active
          ? "border-primary border-b-2 text-foreground"
          : "border-transparent border-b-2 text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function QuestsTab({
  quests,
  onTurnIn,
  canTurnIn,
}: {
  quests: PlayerSnapshot["quests"];
  onTurnIn: (id: string) => void;
  canTurnIn: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 p-3">
      {quests.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground text-xs">
          No quests yet. Talk to Elder Cubius.
        </p>
      ) : (
        Object.values(QUEST_CATALOG).map((def) => {
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
  );
}

function ChatTab({
  entries,
  onSend,
}: {
  entries: ChatEntry[];
  onSend: (channel: ChatChannel, text: string) => void;
}) {
  const [channel, setChannel] = useState<ChatChannel>("zone");
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
    let ch: ChatChannel = channel;
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
    <div className="flex h-60 flex-col">
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
        className="flex-1 overflow-y-auto px-2 py-1.5 text-xs"
      >
        {entries.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">no messages yet</p>
        ) : (
          entries.map((e) => <ChatLine key={e.id} entry={e} />)
        )}
      </div>
      <form
        className="flex items-center gap-1 border-border/40 border-t p-1.5"
        onSubmit={(ev) => {
          ev.preventDefault();
          submit();
        }}
      >
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
  current: ChatChannel;
  value: ChatChannel;
  onChange: (v: ChatChannel) => void;
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

function ChatLine({ entry }: { entry: ChatEntry }) {
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
