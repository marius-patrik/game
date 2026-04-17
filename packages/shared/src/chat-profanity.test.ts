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
});
