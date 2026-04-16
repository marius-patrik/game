# Plan: #46 — Chat — global + zone channels

**Status:** draft
**Owner agent:** execution (mixed frontend + backend)
**Branch:** `feat/chat`

## Context
Players can move, fight, and trade items but can't communicate. Chat is the first real social primitive and is a low-lift, high-visibility feature. Two channels: `zone` (broadcast within the current Colyseus room only) and `global` (dispatched across all live zone rooms via `matchMaker.query()`). Messages are transient — no DB persistence this PR.

## Chosen approach
Colyseus broadcast messages, not Schema state. A single `"chat"` message type with a discriminated `channel` field covers both channels. Server validates + rate-limits + routes. Client keeps a bounded ring buffer in React state, renders a collapsible panel, and exposes a `T`-key toggle. No new dependencies.

## File impact

**Shared (`packages/shared/src/`)**
- `chat.ts` — **new**:
  ```ts
  export type ChatChannel = "global" | "zone";
  export type ChatEntry = { id: string; channel: ChatChannel; from: string; text: string; at: number };
  export const CHAT_MAX_LEN = 200;
  export const CHAT_MAX_HISTORY = 200;
  ```
- `index.ts` — add `export * from "./chat";`

**Server (`apps/server/src/`)**
- `security/config.ts` — **edit**: add `chat: { perSec: 5, burst: 3 }` to rate limit config.
- `security/RateLimiter.ts` — no change (already supports named buckets; just register "chat").
- `rooms/GameRoom.ts` — **edit**:
  - Register `this.onMessage<ChatInbound>("chat", (client, msg) => this.handleChat(client, msg))` in `onCreate`.
  - New private `handleChat(client, { channel, text })`:
    - Validate shape: `channel ∈ ["global","zone"]`, `text` is string.
    - Sanitize: `trim()`, strip control chars via `text.replace(/[\x00-\x1f\x7f]/g, "")`.
    - Length guard: 1 ≤ len ≤ `CHAT_MAX_LEN` (reject with `client.send("chat-error", { reason })`).
    - Rate-limit: `rateLimiter.consume(sessionId, "chat")`; on fail, emit violation + `chat-error`.
    - Build `ChatEntry` `{ id: nanoid-ish, channel, from: player.name || sessionId.slice(0,6), text, at: Date.now() }`. Use a simple counter-based id (`c${++chatCounter}`) — no external dep.
    - Dispatch:
      - `zone`: `this.broadcast("chat", entry)`.
      - `global`: walk `matchMaker.query({ name: "zone" })`; for each room, `matchMaker.remoteRoomCall(roomId, "_relayChat", [entry]).catch(noop)`.
    - New private `_relayChat(entry)` that just calls `this.broadcast("chat", entry)`.
- `types.ts` — if there's one; else define `ChatInbound` inline in GameRoom.
- `anti-cheat`: new violation reason `rate_limit:chat` piggybacks on existing tracker.

**Client (`apps/client/src/`)**
- `game/ChatPanel.tsx` — **new**:
  - Positioned at `absolute bottom-20 left-2 sm:bottom-4` so it doesn't overlap inventory bar.
  - Collapsed state: small `MessageSquare` icon button.
  - Expanded state: 320×240 (desktop) / full-width-minus-16px (mobile) panel with:
    - Channel segmented control (`zone` / `global`), default `zone`.
    - Scrollable message list (auto-scroll to bottom on new message unless user scrolled up).
    - Text `<Input>` with placeholder "say…".
    - Send on Enter; `Escape` collapses.
    - Outbound prefix parsing: leading `/g ` → channel=`global`; `/z ` → `zone`.
  - Subscribe to `room.chat` array (via `useRoom` — see below).
  - Rate-limit feedback: on `chat-error`, show `toast.error(msg)` via sonner.
- `game/GameView.tsx` — **edit**: mount `<ChatPanel />` alongside other HUD overlays; guard by `!cinematicActive && room.sessionId`.
- `net/useRoom.ts` — **edit**:
  - Extend `send` tuple: `(type: "chat", payload: { channel: ChatChannel; text: string })`.
  - Add `chat: ChatEntry[]` to `RoomState` (bounded to `CHAT_MAX_HISTORY`).
  - `room.onMessage("chat", (entry) => { chatBuffer.push(entry); while (chatBuffer.length > CHAT_MAX_HISTORY) chatBuffer.shift(); commit(); })`.
  - `room.onMessage("chat-error", (msg) => toast.error(`Chat: ${msg.reason}`))`.
- Input conflict: pressing `T` while typing in another `<input>` must not open the panel. Gate the global listener: ignore when `document.activeElement` is an input/textarea.

**Keyboard binding**
- New `apps/client/src/game/useChatToggle.ts` hook: listens for `T` and focuses the panel input; listens for `Escape` to blur/close. Ignores events originating from inputs.

## Risks / unknowns
- **matchMaker.remoteRoomCall** must exist in Colyseus 0.16. Verify with `grep remoteRoomCall node_modules/@colyseus/core/lib`. Fallback: keep a module-level set of live `GameRoom` instances and iterate directly. Decide in-session.
- **Global-channel back-pressure.** If many rooms exist, global broadcast fan-out is O(rooms × clients). Acceptable at MVP scale. Document in retro.
- **Profanity / moderation.** Explicitly out of scope. Server just sanitizes control characters.
- **Persistence.** Out of scope — a new client sees an empty panel. That's fine for MVP.
- **Mobile keyboard overlap.** On mobile, the keyboard overlaps the joystick area. The panel uses fixed positioning above the inventory bar; test in 390×844.

## Acceptance mapping (from issue #46)
1. ✅ `T` opens, `Escape` closes — `useChatToggle`.
2. ✅ Zone-channel messages visible to same-room clients — `this.broadcast`.
3. ✅ `/g` prefix → global cross-zone visible — `matchMaker` fan-out.
4. ✅ Rate limit throttles cleanly — `rateLimiter.consume`.
5. ✅ Over-200-char rejected with inline error — `chat-error` + toast.
6. ✅ Mobile input works, no pinch-zoom — CSS `font-size: 16px` on input.
7. ✅ No new runtime deps — verified by `apps/client/package.json` diff = 0 outside dev.
8. ✅ typecheck + check + CI green.

## Out of scope
- Persistence across sessions
- DMs / whispers
- Profanity filter
- Emoji/rich text
- Typing indicators

## Retro
_(filled after merge)_
