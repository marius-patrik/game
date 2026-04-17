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
    | "not_found"
    | "party_full"
    | "party_other_party";
};

export const CHAT_MAX_LEN = 200;
export const CHAT_MAX_HISTORY = 200;

export function isChatChannel(v: unknown): v is ChatChannel {
  return v === "global" || v === "zone" || v === "dm";
}

export type PartySubcommand =
  | { action: "invite"; target: string }
  | { action: "accept" }
  | { action: "leave" }
  | { action: "status" };

export type ChatCommand =
  | { kind: "chat"; text: string }
  | { kind: "whisper"; to: string; text: string }
  | { kind: "block"; target: string }
  | { kind: "unblock"; target: string }
  | { kind: "party"; sub: PartySubcommand };

// Parses a raw chat string for slash-commands. /w <name> <msg> opens a DM,
// /block and /unblock manage the per-user ignore list, /party wires group play.
// Anything else (including /g and /z which are channel switches handled on the
// client) passes through as plain chat. Empty targets or empty whisper bodies
// return "chat" so the server's empty-text guard produces a clean error.
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
  if (cmd === "party" || cmd === "p") {
    const sub = parsePartySub(rest);
    if (!sub) return { kind: "chat", text: trimmed };
    return { kind: "party", sub };
  }
  return { kind: "chat", text: trimmed };
}

function parsePartySub(rest: string): PartySubcommand | undefined {
  const trimmed = rest.trim();
  if (trimmed.length === 0) return { action: "status" };
  const spaceIdx = trimmed.indexOf(" ");
  const verb = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const arg = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();
  if (verb === "invite" || verb === "inv") {
    if (arg.length === 0) return undefined;
    return { action: "invite", target: arg };
  }
  if (verb === "accept" || verb === "join") return { action: "accept" };
  if (verb === "leave" || verb === "quit") return { action: "leave" };
  if (verb === "status" || verb === "who") return { action: "status" };
  return undefined;
}
