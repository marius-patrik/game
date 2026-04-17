import { describe, expect, test } from "bun:test";
import { INVITE_TTL_MS, MAX_PARTY_SIZE, PartyManager } from "./party";

function makeManager(clock: { now: number }) {
  return new PartyManager(() => clock.now);
}

describe("PartyManager", () => {
  test("invite creates a solo party on the sender and issues an invite", () => {
    const clock = { now: 1000 };
    const mgr = makeManager(clock);
    const res = mgr.invite("alice", "bob");
    expect(res.ok).toBe(true);
    expect(mgr.getPartyBySession("alice")).toBeDefined();
    expect(mgr.getPartyBySession("bob")).toBeUndefined();
  });

  test("accept puts the invitee into the sender's party", () => {
    const clock = { now: 1000 };
    const mgr = makeManager(clock);
    mgr.invite("alice", "bob");
    const res = mgr.accept("bob");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.leader).toBe("alice");
    const party = mgr.getPartyBySession("bob");
    expect(party?.members.has("alice")).toBe(true);
    expect(party?.members.has("bob")).toBe(true);
  });

  test("accept without an invite fails cleanly", () => {
    const mgr = makeManager({ now: 0 });
    const res = mgr.accept("nobody");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("no_invite");
  });

  test("invite TTL expires", () => {
    const clock = { now: 1000 };
    const mgr = makeManager(clock);
    mgr.invite("alice", "bob");
    clock.now += INVITE_TTL_MS + 1;
    const res = mgr.accept("bob");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("expired");
  });

  test("self-invite is rejected", () => {
    const mgr = makeManager({ now: 0 });
    const res = mgr.invite("alice", "alice");
    expect(res.ok).toBe(false);
  });

  test("inviting a player already in another party is rejected", () => {
    const mgr = makeManager({ now: 0 });
    mgr.invite("alice", "bob");
    mgr.accept("bob");
    // Carol tries to grab Bob — should fail because Bob is already grouped.
    const res = mgr.invite("carol", "bob");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("already_in_party");
  });

  test("party caps at MAX_PARTY_SIZE", () => {
    const mgr = makeManager({ now: 0 });
    const names = ["a", "b", "c", "d", "e"];
    for (let i = 1; i < names.length - 1; i++) {
      const name = names[i];
      if (!name) continue;
      mgr.invite("a", name);
      mgr.accept(name);
    }
    expect(mgr.getPartyBySession("a")?.members.size).toBe(MAX_PARTY_SIZE);
    const overflow = mgr.invite("a", "e");
    expect(overflow.ok).toBe(false);
    if (overflow.ok) return;
    expect(overflow.reason).toBe("full");
  });

  test("leaving clears the member and dissolves an empty party", () => {
    const mgr = makeManager({ now: 0 });
    mgr.invite("alice", "bob");
    mgr.accept("bob");
    mgr.leave("bob");
    const party = mgr.getPartyBySession("alice");
    expect(party?.members.has("bob")).toBe(false);
    // Now alice leaves her solo party — dissolves.
    const res = mgr.leave("alice");
    expect(res.dissolved).toBe(true);
    expect(mgr.getPartyBySession("alice")).toBeUndefined();
  });

  test("leader leaving promotes the next-longest member", () => {
    const mgr = makeManager({ now: 0 });
    mgr.invite("alice", "bob");
    mgr.accept("bob");
    mgr.invite("alice", "carol");
    mgr.accept("carol");
    const res = mgr.leave("alice");
    expect(res.dissolved).toBe(false);
    expect(res.newLeader).toBe("bob");
    expect(mgr.getPartyBySession("bob")?.leader).toBe("bob");
  });

  test("pruneExpiredInvites drops timed-out invites", () => {
    const clock = { now: 0 };
    const mgr = makeManager(clock);
    mgr.invite("alice", "bob");
    expect(mgr._debugInviteCount()).toBe(1);
    clock.now = INVITE_TTL_MS + 100;
    mgr.pruneExpiredInvites();
    expect(mgr._debugInviteCount()).toBe(0);
  });
});
