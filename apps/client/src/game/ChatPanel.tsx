import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CHAT_MAX_LEN, type ChatChannel, type ChatEntry } from "@game/shared";
import { MessageSquare, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useChatToggle } from "./useChatToggle";

type Send = (channel: ChatChannel, text: string) => void;

const AUTOSCROLL_SLACK_PX = 24;

function parsePrefix(raw: string, current: ChatChannel): { channel: ChatChannel; text: string } {
  if (raw.startsWith("/g ")) return { channel: "global", text: raw.slice(3) };
  if (raw.startsWith("/z ")) return { channel: "zone", text: raw.slice(3) };
  return { channel: current, text: raw };
}

export function ChatPanel({
  entries,
  onSend,
  enabled,
}: {
  entries: ChatEntry[];
  onSend: Send;
  enabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<ChatChannel>("zone");
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);

  const openPanel = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);
  const closePanel = useCallback(() => {
    setOpen(false);
    inputRef.current?.blur();
  }, []);

  useChatToggle({ enabled, isOpen: open, onOpen: openPanel, onClose: closePanel });

  const onScroll = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const gap = list.scrollHeight - (list.scrollTop + list.clientHeight);
    stickRef.current = gap <= AUTOSCROLL_SLACK_PX;
  }, []);

  const submit = useCallback(() => {
    const raw = draft.trim();
    if (raw.length === 0) return;
    const parsed = parsePrefix(raw, channel);
    const text = parsed.text.trim();
    if (text.length === 0) return;
    if (text.length > CHAT_MAX_LEN) return;
    onSend(parsed.channel, text);
    setDraft("");
  }, [draft, channel, onSend]);

  const lastCount = entries.length;
  useEffect(() => {
    if (!open || lastCount < 0) return;
    const list = listRef.current;
    if (!list) return;
    if (stickRef.current) list.scrollTop = list.scrollHeight;
  }, [open, lastCount]);

  if (!enabled) return null;

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Open chat"
        onClick={openPanel}
        className="pointer-events-auto absolute bottom-24 left-2 flex h-10 w-10 items-center justify-center rounded-full border border-border/50 bg-background/60 text-foreground shadow-sm backdrop-blur-md hover:bg-background/80 sm:bottom-4"
      >
        <MessageSquare className="size-4" />
      </button>
    );
  }

  return (
    <div className="pointer-events-auto absolute bottom-24 left-2 right-2 flex w-auto flex-col overflow-hidden rounded-lg border border-border/50 bg-background/80 text-sm shadow-md backdrop-blur-md sm:bottom-4 sm:right-auto sm:w-[320px]">
      <div className="flex items-center justify-between border-border/50 border-b px-2 py-1.5">
        <div className="flex items-center gap-1">
          <ChannelChip
            current={channel}
            value="zone"
            onClick={() => setChannel("zone")}
            label="zone"
          />
          <ChannelChip
            current={channel}
            value="global"
            onClick={() => setChannel("global")}
            label="global"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Close chat"
          onClick={closePanel}
        >
          <X />
        </Button>
      </div>
      <div
        ref={listRef}
        onScroll={onScroll}
        className="flex h-52 flex-col gap-0.5 overflow-y-auto px-2 py-1.5"
      >
        {entries.length === 0 ? (
          <div className="py-2 text-center text-muted-foreground text-xs">
            No messages yet. Say hi.
          </div>
        ) : (
          entries.map((e) => <ChatLine key={e.id} entry={e} />)
        )}
      </div>
      <form
        className="flex items-center gap-1 border-border/50 border-t p-1.5"
        onSubmit={(ev) => {
          ev.preventDefault();
          submit();
        }}
      >
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="say…"
          aria-label="Chat message"
          maxLength={CHAT_MAX_LEN}
          style={{ fontSize: "16px" }}
          className="h-8"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              closePanel();
            }
          }}
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
  onClick,
  label,
}: {
  current: ChatChannel;
  value: ChatChannel;
  onClick: () => void;
  label: string;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-2 py-0.5 text-xs transition-colors",
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
    <div className="break-words font-mono text-[12px] leading-5">
      <span className={cn("mr-1", channelColor)}>{channelLabel}</span>
      <span className="font-semibold text-foreground">{entry.from}</span>
      <span className="text-muted-foreground">: </span>
      <span className="text-foreground">{entry.text}</span>
    </div>
  );
}
