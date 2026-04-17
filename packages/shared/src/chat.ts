export type ChatChannel = "global" | "zone";

export type ChatEntry = {
  id: string;
  channel: ChatChannel;
  from: string;
  text: string;
  at: number;
};

export type ChatInbound = {
  channel: ChatChannel;
  text: string;
};

export type ChatError = {
  reason: "rate_limit" | "too_long" | "empty" | "invalid_channel";
};

export const CHAT_MAX_LEN = 200;
export const CHAT_MAX_HISTORY = 200;

export function isChatChannel(v: unknown): v is ChatChannel {
  return v === "global" || v === "zone";
}
