# Plan: #93 — HUD teardown + layout rebuild (bars, sidebar, unified toasts)

**Status:** draft
**Owner agent:** frontend
**Branch:** `feat/hud-rebuild`

## Context

Relocates the entire HUD per user direction. Bottom-bars, top-left tab pane, top-right sidebar, 3D player name, unified toasts. Does NOT add new features — moves existing content into the new layout. Depends on #96/#97/#98 so each tab has real content.

## Key layout

```
  [top-left tab pane]                            [top-right sidebar]
  Map | Quests | Chat | Info | Inventory | Skills   Coins ◉ 1,234
                                                    Active quest:
                                                      Slay 3 grunts — 1/3
                                                    Location: Arena


             (scene)



          ┌──────── HP ────────┐┌──────── MP ────────┐
          └────────────────────┘└────────────────────┘
          ┌──────────────── XP ──────────────────────┐
          └──────────────────────────────────────────┘
          (hotbar from #94)
```

- Player name label rendered in-scene above the player capsule.

## Scope

**Delete (existing widgets)**
- Top-left "online count" + "lobby" label + hint widget — pure client, remove their mounts + files.
- Old bottom-left HP/MP/XP info card — moved to the new bottom bars.
- `LevelUpBanner.tsx` + `QuestToast.tsx` — migrate logic to unified toast variants.

**New / move**
- `apps/client/src/game/TopLeftPane.tsx` — tab container for Map/Quests/Chat/Info/Inventory/Skills. Each tab is an existing component migrated over.
- `apps/client/src/game/TopRightSidebar.tsx` — coins + conditional active quest + current location. Conditional quest: only renders a card when `activeQuest !== undefined`.
- `apps/client/src/game/BottomBars.tsx` — XP bar (near-full width) + HP + MP (half width each). Numbers + icons. Uses existing `Progress` component.
- `apps/client/src/game/PlayerLabel.tsx` — in-scene drei `Html` billboard above player. Only renders for the local player's name + other players'.
- `apps/client/src/components/ui/unified-toast.tsx` (or extend sonner-toast wrappers) — single API covering info/success/warning/error/level-up/quest-ready variants. Every call site in the app routes through this module.

**Edit**
- `apps/client/src/game/GameView.tsx` — re-arrange mounts (delete old widgets, mount new components).
- `apps/client/src/game/SidePanel.tsx` — the shared tab switcher moves in here (feeds the top-left pane). If the current SidePanel is the same concept, rename/reshape.
- `apps/client/src/game/Scene.tsx` — mount `PlayerLabel` for each player.
- Map tab height fix — inside Map.tsx the container uses `h-full` + the parent sets a fixed frame so the map fills available height.

## Dependencies

- #96 → characterId on Player schema (for name label).
- #97 → Inventory tab content is the new equipment-aware inventory panel.
- #98 → Skills tab content.

## Verify

- Desktop 1440×900: all regions visible, no overlap.
- Mobile 390×844: top-right sidebar collapses behind a toggle; bottom bars remain full-width; top-left pane tabs become pills.
- Every toast call site uses the unified module — grep for `toast.` returns only the wrapper's internal calls; old `<LevelUpBanner>` / `<QuestToast>` imports are gone.
- Player label floats cleanly above the capsule in the 3D scene. Distance-fade at > 20m away from camera.
- Map tab fills the pane height when selected.
- `bun run check` + `bun run typecheck` clean.

## Out of scope

- Draggable tabs (#99).
- Hotbar redesign (#94).
- Keybind config (#95).

## Retro
_(filled after merge)_
