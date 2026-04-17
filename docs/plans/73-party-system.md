# Plan: #73 — Party / group system

**Status:** shipped. Agent #73 completed backend scaffolding (PartyManager + schema + parser) then hit the shared Anthropic account rate limit mid-run; overseer finished remaining ~60% (/party command dispatch, XP share, zone-exit hook, client HUD) from the overseer seat.
**Owner agent:** backend (execution — cuts shared + server + client HUD)
**Branch:** `feat/party-system`

## Context
First real group primitive. Alpha has co-op gameplay (mobs, portals, zones) but no "I want to play with my friend" path. Parties of up to 4, shared XP on kills within 10m, party-member HP pips in the HUD. Chat commands (`/party invite`, `/party accept`, `/party leave`).

## Chosen approach
- **Party is scoped to a single zone room** — simplest shape. When a member travels to another zone, they leave the party on zone-exit. Rationale: avoids distributed party state across rooms; re-invite after re-grouping in the same zone. Document this clearly in user-facing help text.
- Persist nothing — parties are ephemeral per-zone.
- Leader election: invite-sender is leader. On leader disconnect, next-longest-member becomes leader automatically.
- Max size = 4.

## File impact

**Shared (`packages/shared/src/schema.ts`)** — **edit**:
- Add `@type("string") partyId = "";` on `Player`. Empty string = no party.
- NO member list on the schema — client derives "party members = all players with matching partyId". Keeps schema small.

**Server (`apps/server/src/`)**
- `party.ts` (new):
  ```ts
  export type PartyState = { id: string; leader: string; members: Set<string>; createdAt: number };
  export class PartyManager {
    private parties = new Map<string, PartyState>();  // partyId → state
    private invites = new Map<string, { partyId: string; from: string; expiresAt: number }>(); // invitee sessionId → invite
    create(leaderSessionId: string): string { ... returns new partyId }
    invite(leaderId: string, inviteeSessionId: string): void
    accept(inviteeSessionId: string): string | null  // returns partyId on success
    leave(sessionId: string): void  // also handles leader reassignment
    getParty(sessionId: string): PartyState | null
    memberCount(partyId: string): number
  }
  ```
  Helpers enforce max-size (4), auto-clean-up empty parties, and auto-leader-promote on leader leave.
- `rooms/GameRoom.ts` — **edit**:
  - Field: `private partyManager = new PartyManager();`.
  - `handleChat` command dispatch additions: `/party invite <name>`, `/party accept`, `/party leave`, `/party status`.
    - `invite`: resolve target name → sessionId; if caller has no party, `partyManager.create(caller)`; then `partyManager.invite(caller, target)`; message target via `client.send("chat", ...)` with "[party invite from X — /party accept]".
    - `accept`: `partyManager.accept(caller)` → set caller's and leader's `Player.partyId`. Reply `chat-ok`.
    - `leave`: `partyManager.leave(caller)` → clear partyId on the leaver and update leader if needed.
    - `status`: list current members.
  - `onMobKilledByPlayer` — change XP awarding:
    ```ts
    const party = this.partyManager.getParty(killerSessionId);
    if (party) {
      for (const memberSid of party.members) {
        const member = this.state.players.get(memberSid);
        if (!member || !member.alive) continue;
        const dx = member.x - mobPos.x;
        const dz = member.z - mobPos.z;
        if (dx*dx + dz*dz > 100) continue;  // >10m
        const share = memberSid === killerSessionId ? fullXp : Math.floor(fullXp * 0.6);
        this.awardXp(member, share);
      }
      // killer's own awardXp is already above in the member loop
    } else {
      this.awardXp(killer, fullXp);
    }
    ```
  - `onLeave` — `this.partyManager.leave(client.sessionId)`.
  - Zone travel — in `handleZoneTick`, when sending `zone-exit`, also call `partyManager.leave(sessionId)` so they're not stuck in a party after travel.

**Client (`apps/client/src/`)**
- `net/useRoom.ts` — **edit** `PlayerSnapshot`: add `partyId: string`. Snap it in `snapPlayer`.
- `game/PartyPanel.tsx` (new) — top-left absolute-positioned HUD. Derives members from `room.players` filtered by matching non-empty partyId (excluding self, since self already has ProgressBar). Renders up to 3 small HP/mana pips with name labels. Uses `Progress` from shadcn.
- `game/GameView.tsx` — **edit**: mount `<PartyPanel players={room.players} sessionId={room.sessionId} />` next to ProgressBar.
- `game/SidePanel.tsx` — **edit**: add a tiny "party" hint under the chat input: `/party invite <name>`.

## Risks / unknowns
- **Name resolution** — same issue as chat DMs (#72). Reuse the same helper if it exists after #72 merges, else duplicate.
- **Invite expiry** — invites time out after 60s. `partyManager.accept` checks `expiresAt`.
- **Shared XP + quest progress** — should party members get quest progress for party kills? **No** for alpha — quest progress only for the killer. Document in retro.
- **Colyseus broadcast overhead** — adding `partyId` to Player schema bumps the per-player sync size by ~8 bytes. Negligible.

## Acceptance mapping (from issue #73)
1. ✅ Two clients form party via `/party invite` + `/party accept` — `PartyManager.invite/accept`.
2. ✅ Shared XP within 10m — modified `onMobKilledByPlayer`.
3. ✅ `/party leave` removes partyId; pips vanish — `leave` + client derive-from-schema.
4. ✅ Party scoped to single zone, cleared on travel — `handleZoneTick` cleanup (documented in issue).
5. ✅ Biome + typecheck clean.

## Out of scope
- Shared quest progress.
- Party-only loot rolls.
- Raid-size parties (>4).
- Private party chat channel.

## Retro
_(filled after merge)_
