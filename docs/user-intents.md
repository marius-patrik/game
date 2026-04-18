# User intents — global verification checklist

Every time the user voices an intent ("the X should do Y", "I want X", "fix X"), the overseer adds a line here with:
- a unique ID (`ui-N` chronologically)
- a 1-line paraphrase
- the date it was voiced
- the issue/PR it's tracked by (or `inline` / `tbd`)
- verification status (`pending` / `verified-preview` / `done-untested` / `superseded`)

**Rule for the overseer:** whenever a PR merges, run the full preview-verification flow (see CLAUDE.md → "Preview verification loop") and tick relevant line(s) here. **Never close a user intent as verified without driving it through the preview.**

**Rule for the user:** scan this file when you want a single view of "what did I ask for, is it actually playable?" — every `verified-preview` entry was reproduced by the overseer against the running game.

---

## Legend

| Status | Meaning |
|---|---|
| `pending` | Filed, not yet shipped |
| `in-flight` | PR open / agent working |
| `done-untested` | Code merged, preview verification not yet performed (transient state only) |
| `verified-preview` | Code merged AND reproduced in preview — this is the green-tick state |
| `superseded` | Replaced by a later intent |

---

## 2026-04-17 session (original alpha-polish + autonomous wave)

| ID | Intent | Tracked by | Status |
|---|---|---|---|
| ui-1 | Unified interaction dialog for every in-world press-E | #95 | verified-preview (2026-04-18: #95/PR #130 — single InteractionPrompt component for NPCs/vendors/questgivers/drops with kind-tinted border) |
| ui-2 | Interact key (and all keybinds) configurable in Settings | #95 | verified-preview (2026-04-18: #95/PR #130 — Settings → Keybinds tab with full action coverage + conflict detection + per-character persistence; rebind E→F + Q-conflict rejected verified) |
| ui-3 | Auto item pickup, on by default, toggleable in Settings; name-only labels when on | #95 + #100 | verified-preview (2026-04-18: #95/PR #130 — autoPickup toggle in Gameplay tab; when off, InteractionPrompt shown; when on, fly-to-player with name-only label) |
| ui-4 | Remove online-count + "lobby" widgets from top-left of HUD | #93 | verified-preview (2026-04-18: #93/PR #125 — DOM assertion confirms no online-count chip, no "game · dev" label) |
| ui-5 | Remove HUD hint widget | #93 | verified-preview (2026-04-18: #93/PR #125 — DOM assertion confirms no hint strip) |
| ui-6 | XP bar bottom, full-width-ish; HP + MP half-width each above it; numbers + icons | #93 | verified-preview (2026-04-18: #93/PR #125 — BottomBars component, responsive across 360–1920 viewports) |
| ui-7 | Top-left pane: Map / Quests / Chat / Info / Inventory / Skills tabs | #93 | verified-preview (2026-04-18: #93/PR #125 — TopLeftPane with 6 tabs confirmed) |
| ui-8 | Top-right sidebar: coins + active quest (only if one) + current location | #93 | verified-preview (2026-04-18: #93/PR #125 — TopRightSidebar component mounted) |
| ui-9 | Player name in 3D scene above player | #93 | done-untested (2026-04-18: #93/PR #125 — PlayerLabel Billboard with 14m→20m distance fade wired in Scene; visual still needs a live preview confirmation) |
| ui-10 | Inventory accessible as a tab in the top-left pane | #93 | verified-preview (2026-04-18: #93/PR #125 — tabs [map, quests, chat, info, inventory, skills] confirmed) |
| ui-11 | Map tab expands to full pane height | #93 | verified-preview (2026-04-18: #93/PR #125 — Minimap refactored to ResizeObserver-based fill) |
| ui-12 | Draggable / detachable / merge-able window+tab system (VSCode-style) | #99 | pending (2026-04-18: PR #129 was merged then REVERTED — TabWindow had infinite render loop; needs re-dispatch with render-loop regression test) |
| ui-13 | Client responsive to window size; no forced larger viewport | #92 | verified-preview (2026-04-18: viewport no longer overflows in 1440×900 or 390×844) |
| ui-14 | Progress persists across reloads AND server updates | #92 + #96 + #116 | verified-preview (2026-04-18: level/xp/color survive reload after #115 + #116) |
| ui-15 | Drop items don't show "talk to Mercer the vendor" | #92 | verified-preview |
| ui-16 | Single unified notification/toast component | #93 | verified-preview (2026-04-18: #93/PR #125 — unified-toast with notify.* API; LevelUpBanner + QuestToast deleted, 5 call sites migrated) |
| ui-17 | Dark mode UI-only (3D scene lighting fixed) | #92 | verified-preview |
| ui-18 | Elder Cubius interactable | #92 | verified-preview |
| ui-19 | Level-up banner auto-dismisses | #92 | verified-preview |
| ui-20 | Lobby is a hostile-mob-free safe zone | #92 + #100 | verified-preview (no mobs in lobby after #115 + #116) |
| ui-21 | Portals are polished (floating vertical circles with particles, or in-ground) | #100 | done-untested (merged #103; visual verification pending) |
| ui-22 | Equipment slots (ring/weapon/armor/+) in inventory; equip raises stats | #97 | in-flight |
| ui-23 | Weapon replaces primary+secondary hotbar abilities (Strike/Punch default) | #97 + #94 | in-flight |
| ui-24 | Multiple characters per account | #96 | verified-preview (2026-04-18: create → redirect → /, character persisted) |
| ui-25 | Character customizer (name + color minimum), persisted | #96 | verified-preview |
| ui-26 | Skills tab in HUD | #98 + #93 | verified-preview (2026-04-18: #98/PR #124 — Skills tab renders in SidePanel, bind Cleave→S1 + Meteor→U + unbind verified, persistence confirmed via DB read) |
| ui-27 | No random disconnects / unwanted zone swaps | #92 | done-untested (diagnostics landed in #104; verify over longer session) |
| ui-28 | Hotbar: 2 weapon + 2 skill + 1 ultimate + 2 item + 2 potion, separators between groups | #94 | done-untested (2026-04-18: #94/PR #128 — new hotbar + separators + hotbarStore shipped via Codex re-dispatch after transport error; live preview verification pending) |
| ui-29 | NPCs next to their stands, not inside | #92 | verified-preview |
| ui-30 | Pickup fly-to-player animation | #100 | done-untested |

## 2026-04-18 session (user redirect: "game unplayable, use preview actively")

| ID | Intent | Tracked by | Status |
|---|---|---|---|
| ui-31 | Sell dialog grid UI with item icons (like inventory) | #106 | verified-preview (2026-04-18 via Gemini dispatch → PR #112 merged) |
| ui-32 | Floating sphere players; dynamic game-declared camera arm; FOV slider; cursor-lock (Ctrl) | #107 | verified-preview |
| ui-33 | Custom 3D cursor + ground targeting system (movement circle, dash two-step, cast-in-space reusable) | #108 | done-untested |
| ui-34 | Skyrim-style NPC dialog system | #109 | verified-preview (2026-04-18: #109/PR #131 — DialogUI with portrait + typewriter + numbered choices; Elder Cubius quest-start + level-3-gated trial verified; Mercer vendor entry via `openVendor` action; camera profile switches to dialog; HUD hidden while open; mobile bottom-sheet with 44px tap targets) |
| ui-35 | Top compass with quest / enemy / portal / NPC indicators | #110 | done-untested (2026-04-18: #110/PR #126 — Compass.tsx with cardinal ticks + POI dots shipped via Gemini dispatch; visual preview confirmation pending) |
| ui-36 | Polish pass — screen shake, particles, shaders, unified frosted-glass UI, glow everywhere, responsive | #111 | pending |
| ui-37 | Seasonal/daily quests rotator | #101 | in-flight |
| ui-38 | Overseer uses Codex + Gemini + Claude via multi-CLI dispatch when possible; evolve setup | scripts/dispatch-cli.sh + .claude/skills/multi-cli-dispatch/SKILL.md | verified-preview (2026-04-18: Gemini shipped #106 via tmux; script documented) |
| ui-39 | Overseer drives Preview after every feature merge; add intents to this file | CLAUDE.md + .claude/commands/spawn-*-agent.md | in-flight (this file is the implementation) |
| ui-40 | Hotfix: matchmake 500 / "offline" after #115 | #116 | verified-preview (2026-04-18: signup → char create → lobby "online · 1" reached, click-to-move works, HP bar renders, NPC stand visible) |
| ui-41 | Scene lighting / atmosphere — the all-white lobby look is a placeholder | #111 | pending |
| ui-42 | Playwright script for end-to-end player flow; kept up to date on every merge; visual confirmation while running | #120 | pending |
| ui-43 | Borderlands-style cell shading + outlines; Karlson-style visual & feel reference (snappy response, kinetic camera) | #121 | pending |

---

## Maintenance rules

- **One intent = one row.** Don't collapse multiple intents into one line.
- **Link every row to a GitHub issue or PR or an inline note.** If it's too small for an issue, write `inline (<commit>)` in the tracker cell.
- **Only flip to `verified-preview` after driving the feature in the running preview.** The overseer does this; agents may pre-verify as `done-untested` but can't promote to `verified-preview`.
- **Never delete rows.** Mark `superseded` and reference the replacement (`superseded by ui-N`).
