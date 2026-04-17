export type ChatChannel = "global" | "zone" | "dm";

export type ChatEntry = {
  id: string;
  channel: ChatChannel;
  from: string;
  text: string;
  at: number;
  // Only populated for dm entries — the display name of the recipient.
  // Senders see "[dm to <to>]", recipients see "[dm from <from>]".
  to?: string;
};

export type ChatInbound = {
  channel: ChatChannel;
  text: string;
};

export type ChatError = {
  reason:
    | "rate_limit"
    | "too_long"
    | "empty"
    | "invalid_channel"
    | "muted"
    | "blocked"
    | "not_found";
};

export const CHAT_MAX_LEN = 200;
export const CHAT_MAX_HISTORY = 200;

export function isChatChannel(v: unknown): v is ChatChannel {
  return v === "global" || v === "zone" || v === "dm";
}

export type ChatCommand =
  | { kind: "chat"; text: string }
  | { kind: "whisper"; to: string; text: string }
  | { kind: "block"; target: string }
  | { kind: "unblock"; target: string };

// Parses a raw chat string for slash-commands. /w <name> <msg> opens a DM,
// /block and /unblock manage the per-user ignore list. Anything else (including
// /g and /z which are channel switches handled on the client) passes through
// as plain chat. Empty targets or empty whisper bodies return "chat" so the
// server's empty-text guard produces a clean error.
export function parseChatCommand(raw: string): ChatCommand {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return { kind: "chat", text: trimmed };

  const spaceIdx = trimmed.indexOf(" ");
  const cmd = spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx);
  const rest = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

  if (cmd === "w" || cmd === "whisper" || cmd === "msg" || cmd === "tell") {
    if (rest.length === 0) return { kind: "chat", text: trimmed };
    const targetSpace = rest.indexOf(" ");
    if (targetSpace === -1) return { kind: "chat", text: trimmed };
    const to = rest.slice(0, targetSpace).trim();
    const text = rest.slice(targetSpace + 1).trim();
    if (to.length === 0 || text.length === 0) return { kind: "chat", text: trimmed };
    return { kind: "whisper", to, text };
  }
  if (cmd === "block" || cmd === "ignore") {
    const target = rest.trim();
    if (target.length === 0) return { kind: "chat", text: trimmed };
    return { kind: "block", target };
  }
  if (cmd === "unblock" || cmd === "unignore") {
    const target = rest.trim();
    if (target.length === 0) return { kind: "chat", text: trimmed };
    return { kind: "unblock", target };
  }
  return { kind: "chat", text: trimmed };
}
