// Per-room party state. Ephemeral — no persistence; parties are scoped to a
// single zone room and vanish when the room disposes or members travel out.
//
// Leader election: the invite-sender is the initial leader. On leader leave
// we promote the member whose join is oldest (the "next-longest-member"),
// which for this data shape is the first remaining entry in the Set insertion
// order. On empty we delete the party. On invite expiry we forget the invite
// silently.

export type PartyState = {
  id: string;
  leader: string;
  /** Insertion order is preserved — used for deterministic leader promotion. */
  members: Set<string>;
  createdAt: number;
};

export type PartyInvite = {
  partyId: string;
  fromSessionId: string;
  expiresAt: number;
};

export type InviteResult =
  | { ok: true; partyId: string }
  | { ok: false; reason: "full" | "not_in_party" | "already_in_party" | "self" };

export type AcceptResult =
  | { ok: true; partyId: string; leader: string }
  | { ok: false; reason: "no_invite" | "expired" | "full" };

export const MAX_PARTY_SIZE = 4;
export const INVITE_TTL_MS = 60_000;

export class PartyManager {
  private parties = new Map<string, PartyState>();
  private invites = new Map<string, PartyInvite>();
  private counter = 0;

  constructor(private readonly now: () => number = () => Date.now()) {}

  /**
   * Returns the party containing the given session, or undefined.
   */
  getPartyBySession(sessionId: string): PartyState | undefined {
    for (const [, p] of this.parties) {
      if (p.members.has(sessionId)) return p;
    }
    return undefined;
  }

  memberCount(partyId: string): number {
    return this.parties.get(partyId)?.members.size ?? 0;
  }

  /**
   * Create a fresh party for the caller. If they are already in a party, no-op
   * and return that id. Used by `invite()` internally — callers shouldn't need
   * to invoke this directly.
   */
  private ensureParty(leaderSessionId: string): string {
    const existing = this.getPartyBySession(leaderSessionId);
    if (existing) return existing.id;
    this.counter += 1;
    const id = `p${this.counter.toString(36)}-${this.now().toString(36).slice(-4)}`;
    this.parties.set(id, {
      id,
      leader: leaderSessionId,
      members: new Set([leaderSessionId]),
      createdAt: this.now(),
    });
    return id;
  }

  /**
   * Issue an invite from `fromSessionId` to `inviteeSessionId`. The sender
   * becomes party leader (creating a solo party if needed). Overwrites any
   * prior pending invite for the invitee.
   */
  invite(fromSessionId: string, inviteeSessionId: string): InviteResult {
    if (fromSessionId === inviteeSessionId) return { ok: false, reason: "self" };
    const existing = this.getPartyBySession(inviteeSessionId);
    if (existing) return { ok: false, reason: "already_in_party" };
    const partyId = this.ensureParty(fromSessionId);
    const party = this.parties.get(partyId);
    if (!party) return { ok: false, reason: "not_in_party" };
    if (party.members.size >= MAX_PARTY_SIZE) return { ok: false, reason: "full" };
    this.invites.set(inviteeSessionId, {
      partyId,
      fromSessionId,
      expiresAt: this.now() + INVITE_TTL_MS,
    });
    return { ok: true, partyId };
  }

  /**
   * Accept a pending invite for `inviteeSessionId`. Deletes the invite whether
   * or not acceptance succeeds.
   */
  accept(inviteeSessionId: string): AcceptResult {
    const invite = this.invites.get(inviteeSessionId);
    if (!invite) return { ok: false, reason: "no_invite" };
    this.invites.delete(inviteeSessionId);
    if (this.now() > invite.expiresAt) return { ok: false, reason: "expired" };
    const party = this.parties.get(invite.partyId);
    if (!party) return { ok: false, reason: "no_invite" };
    if (party.members.size >= MAX_PARTY_SIZE) return { ok: false, reason: "full" };
    party.members.add(inviteeSessionId);
    return { ok: true, partyId: party.id, leader: party.leader };
  }

  /**
   * Remove `sessionId` from whatever party they're in. Drops empty parties and
   * promotes the next member to leader if the leader left. Also clears any
   * pending invite addressed to the departing session.
   *
   * Returns the party id the session was in (if any) and a flag indicating
   * whether the party was deleted as a result, so the caller can broadcast
   * cleanup messages.
   */
  leave(sessionId: string): { partyId?: string; dissolved: boolean; newLeader?: string } {
    this.invites.delete(sessionId);
    const party = this.getPartyBySession(sessionId);
    if (!party) return { dissolved: false };
    party.members.delete(sessionId);
    if (party.members.size === 0) {
      this.parties.delete(party.id);
      return { partyId: party.id, dissolved: true };
    }
    if (party.leader === sessionId) {
      // Promote the next member in insertion order — the longest-running
      // remaining member. Sets preserve insertion order in JS.
      const next = party.members.values().next().value;
      if (next) party.leader = next;
      return { partyId: party.id, dissolved: false, newLeader: party.leader };
    }
    return { partyId: party.id, dissolved: false };
  }

  /**
   * Return member session ids for a party as a stable array, or an empty list
   * if the party no longer exists. Preserves insertion order (leader first is
   * NOT guaranteed — callers should read `leader` separately).
   */
  membersOf(partyId: string): string[] {
    const party = this.parties.get(partyId);
    if (!party) return [];
    return Array.from(party.members);
  }

  /**
   * Prune invites whose TTL has expired. Safe to call on a schedule; lazy
   * cleanup also happens on accept.
   */
  pruneExpiredInvites(): void {
    const now = this.now();
    for (const [sid, invite] of this.invites) {
      if (now > invite.expiresAt) this.invites.delete(sid);
    }
  }

  /** Test/diag helpers. Not used by production code paths. */
  _debugPartyCount(): number {
    return this.parties.size;
  }
  _debugInviteCount(): number {
    return this.invites.size;
  }
}
