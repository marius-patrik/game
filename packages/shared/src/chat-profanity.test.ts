import { describe, expect, test } from "bun:test";
import { parseChatCommand } from "./chat";
import { filterProfanity } from "./chat-profanity";

describe("filterProfanity", () => {
  test("leaves clean text untouched", () => {
    expect(filterProfanity("hello there traveller")).toBe("hello there traveller");
  });

  test("masks a banned word with same-length stars", () => {
    expect(filterProfanity("you shit")).toBe("you ****");
  });

  test("is case insensitive and preserves surrounding punctuation", () => {
    expect(filterProfanity("Shit! really?")).toBe("****! really?");
    expect(filterProfanity("what the FUCK")).toBe("what the ****");
  });

  test("does not match substrings inside longer words", () => {
    // "class" contains "ass" — must not trigger.
    expect(filterProfanity("our class is here")).toBe("our class is here");
    // "scunthorpe" contains "cunt" — the word-boundary anchor must protect it.
    expect(filterProfanity("welcome to scunthorpe")).toBe("welcome to scunthorpe");
    // "assassin" — "ass" substring guard.
    expect(filterProfanity("silent assassin")).toBe("silent assassin");
  });

  test("masks multiple occurrences in one message", () => {
    expect(filterProfanity("shit shit shit")).toBe("**** **** ****");
  });

  test("respects word boundaries with punctuation", () => {
    expect(filterProfanity("shit.")).toBe("****.");
    expect(filterProfanity("(shit)")).toBe("(****)");
    expect(filterProfanity("'shit'")).toBe("'****'");
  });
});

describe("parseChatCommand", () => {
  test("plain text is a chat command", () => {
    expect(parseChatCommand("hello world")).toEqual({ kind: "chat", text: "hello world" });
  });

  test("/w <name> <text> becomes a whisper", () => {
    expect(parseChatCommand("/w alice hi there")).toEqual({
      kind: "whisper",
      to: "alice",
      text: "hi there",
    });
  });

  test("/whisper alias works", () => {
    expect(parseChatCommand("/whisper bob hey")).toEqual({
      kind: "whisper",
      to: "bob",
      text: "hey",
    });
  });

  test("/w without body falls back to chat", () => {
    expect(parseChatCommand("/w alice")).toEqual({ kind: "chat", text: "/w alice" });
  });

  test("/block <name> is a block command", () => {
    expect(parseChatCommand("/block alice")).toEqual({ kind: "block", target: "alice" });
  });

  test("/unblock <name> is an unblock command", () => {
    expect(parseChatCommand("/unblock alice")).toEqual({ kind: "unblock", target: "alice" });
  });

  test("/block without a target falls back to chat", () => {
    expect(parseChatCommand("/block")).toEqual({ kind: "chat", text: "/block" });
  });

  test("unknown slash commands pass through as chat", () => {
    expect(parseChatCommand("/dance")).toEqual({ kind: "chat", text: "/dance" });
  });

  test("/party invite <name> becomes a party invite", () => {
    expect(parseChatCommand("/party invite alice")).toEqual({
      kind: "party",
      sub: { action: "invite", target: "alice" },
    });
  });

  test("/p alias works", () => {
    expect(parseChatCommand("/p invite bob")).toEqual({
      kind: "party",
      sub: { action: "invite", target: "bob" },
    });
  });

  test("/party accept / leave / status parse", () => {
    expect(parseChatCommand("/party accept")).toEqual({
      kind: "party",
      sub: { action: "accept" },
    });
    expect(parseChatCommand("/party leave")).toEqual({
      kind: "party",
      sub: { action: "leave" },
    });
    expect(parseChatCommand("/party status")).toEqual({
      kind: "party",
      sub: { action: "status" },
    });
  });

  test("bare /party defaults to status", () => {
    expect(parseChatCommand("/party")).toEqual({
      kind: "party",
      sub: { action: "status" },
    });
  });

  test("/party invite without a name falls back to chat", () => {
    expect(parseChatCommand("/party invite")).toEqual({
      kind: "chat",
      text: "/party invite",
    });
  });

  test("unknown /party subcommand falls back to chat", () => {
    expect(parseChatCommand("/party disco")).toEqual({
      kind: "chat",
      text: "/party disco",
    });
  });
});
