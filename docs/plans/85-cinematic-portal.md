# Plan: #85 — Cinematic portal transition via theatre.js

**Status:** draft
**Owner agent:** frontend
**Branch:** `feat/cinematic-portal`

## Context

Zone swaps currently use a 350ms black fade ([apps/client/src/game/ZoneTransition.tsx](../../apps/client/src/game/ZoneTransition.tsx)) tied to `room.status`. It papers over reconnect latency but feels utilitarian. Issue #85 asks for a proper cinematic: camera push + radial wipe + white-flash + fade-in — the first real use of theatre.js in the project.

theatre.js (both `@theatre/core` and `@theatre/studio`) is already in `apps/client/package.json` from the initial stack setup but unused. `@theatre/studio` must NOT ship to production — it's dev-only and adds ~600 KB gzipped.

ADR-0002 requires mobile parity (390×844 @ ≥30 FPS, <150 draw calls). The cinematic must honor this.

## Options considered

1. **Full theatre.js sequence with studio in dev** — author the sequence in the browser via studio, persist it as a JSON sheet, play via `@theatre/core` in prod. Classic theatre.js workflow.
   - ✅ Authorable. Non-programmers can tweak.
   - ⚠️ Two bundle profiles (dev vs prod) — studio must be tree-shaken out.
   - ⚠️ Adds meaningful bundle weight for core (~80 KB gzipped).

2. **Hand-rolled sequence with @react-spring/three** — spring-animated camera + a drei `Sparkles` burst + framer `motion.div` wipe. No theatre.js at all.
   - ✅ Zero new bundle weight (all three already used).
   - ✅ Simpler — no external JSON sheet to maintain.
   - ❌ Less authorable. Timing knobs live in code.
   - ❌ Punts on the backlog line that explicitly mentions theatre.js ("theatre.js-scripted zone swap").

3. **Hybrid: @theatre/core only, sequence authored in code** — use theatre.js's sheet/sequence primitive for timing but skip studio entirely. Author the sheet programmatically with `project.sheet().sequence.position = t` calls.
   - ✅ Single bundle profile. No studio = no dev/prod split.
   - ✅ Still uses theatre.js machinery for the time-based sequencing.
   - ✅ Lets future agents add studio-authoring later without breaking this PR's contract.
   - ⚠️ Slightly underuses theatre.js (main value is the studio authoring UX).
   - ⚠️ Bundle adds ~80 KB gzipped for core.

## Chosen approach

**Option 3: hybrid — `@theatre/core` only, programmatic sequence.** Reasons:
- Avoids the dev/prod bundle fork risk. `@theatre/studio` stays unused/uninstalled from the client app (keep it in package.json if the root workspace needs it; verify nothing imports it from `apps/client/src`).
- Honors the backlog intent (first use of theatre.js) without over-investing in the authoring pipeline.
- ~80 KB gzipped for `@theatre/core` is inside our budget — the client bundle is ~3 MB gzipped currently.

The cinematic is **1.2s total**, split as:
- **0.0s – 0.6s:** camera push — position lerps forward ~3 units along current look vector, slight tilt +8°.
- **0.3s – 0.9s:** radial wipe — a full-screen DOM `motion.div` with a CSS `radial-gradient(circle at center, transparent X%, #000 Y%)` where X/Y animates from (100,100) → (0,0). Pure DOM, no particles on mobile.
- **0.8s – 0.9s:** white flash — opacity 0 → 0.9 → 0 on a white full-screen div.
- **0.9s – 1.2s:** fade-in of the new scene — black overlay opacity 1 → 0.

**Reconnect orchestration:** The new cinematic replaces the entire visible behavior of `ZoneTransition`. The reconnect itself (Colyseus teardown + rejoin) keeps happening in the background driven by `useRoom`; the cinematic duration is decoupled from reconnect duration. If reconnect is slower than 1.2s, hold the last frame (full black) until `status === "connected"`, then play the 0.3s fade-in. If reconnect is faster (typical), the cinematic's own timeline gates the reveal — no pop-in.

**Skip toggle:** Add a third section to [SettingsPanel.tsx](../../apps/client/src/game/SettingsPanel.tsx) — "Skip cinematics" checkbox (shadcn `Switch`). Persisted via a new zustand slice in a new `apps/client/src/state/preferencesStore.ts` (or extended from existing zustand store if there is one — check first). When `skipCinematics === true`, `ZoneTransition` falls back to the current framer fade. Preserves current behavior as the escape hatch.

## File impact

**New**
- `apps/client/src/game/cinematics/PortalTransition.tsx` — the theatre.js sequence component. Takes `status`, `skipCinematics` props. Renders three overlay layers (wipe, white-flash, fade) + a `<useFrame>` hook (or a parallel R3F hook) that drives camera position/rotation offsets within the Canvas. Coordinates with `Scene` via a shared R3F context (the current camera ref).
- `apps/client/src/game/cinematics/portalSheet.ts` — theatre.js project + sheet setup. Exports a helper `playPortalTransition({ onEnd })` that creates/reuses a singleton project, sets sequence position from 0→1.2s over 1200ms via `requestAnimationFrame`, fires frame-level callbacks with interpolated values for camera + overlays.
- `apps/client/src/state/preferencesStore.ts` — **new** (if no existing preferences store) with `skipCinematics: boolean` + setter. Persist via `persist` middleware from `zustand/middleware` (localStorage key `game.preferences.v1`).

**Edit**
- `apps/client/src/game/ZoneTransition.tsx` — split into two branches:
  - `skipCinematics` → keep current framer fade (rename current component to `PlainFade` or keep inline).
  - Otherwise → render `<PortalTransition />`.
- `apps/client/src/game/Scene.tsx` — expose the camera ref (or re-use whatever is already exposed for chase-camera) so `PortalTransition` can drive camera position during the 0.6s push. If this collides with `OrbitControls`, disable controls for the cinematic's duration via a shared zustand flag or by passing `enabled={!cinematicActive}` to the controls.
- `apps/client/src/game/SettingsPanel.tsx` — add the "Skip cinematics" section. Two new props (`skipCinematics`, `onSkipCinematicsChange`) — prop-passed like `tier` and `volume`, **not** read directly from the store inside the panel (keeps the panel stateless + tested same way as existing controls).
- `apps/client/src/game/GameView.tsx` — wire `skipCinematics` from the preferences store into `ZoneTransition` + `SettingsPanel`.

**Verify-only / should not change**
- `apps/client/src/net/useRoom.ts` — reconnect logic stays identical. Cinematic listens to `room.status`, doesn't drive it.
- No changes to `apps/server/` or `packages/shared/`.

## Performance & mobile

- **Draw calls:** the cinematic uses only DOM overlays + 1 camera tween. Zero new R3F meshes. Draw call budget untouched.
- **Bundle size:** `@theatre/core` ~80 KB gzipped. Verify via `bun run build` size diff (flag in PR if it exceeds 100 KB).
- **Mobile:** DOM gradient wipe is cheap (GPU-composited). White flash is a single `<div>`. Tested in 390×844 should hit ≥30 FPS without breaking a sweat.
- **Studio exclusion:** grep the final bundle for `@theatre/studio` — it should NOT appear. If `@theatre/core` pulls it transitively, add it to rsbuild's `external`/`splitChunks` config or use a module-aliasing trick. Expected: it doesn't, but verify.

## Risks / unknowns

- **theatre.js camera-in-R3F integration.** theatre.js has `@theatre/r3f` but that's a separate package and pulls more weight. Plan skips it — we drive the camera manually from `useFrame` using theatre's interpolated value at the current time. If that's awkward, fall back to @react-spring/three for the camera leg and keep theatre.js for the overlay timing only (still gets the "theatre.js powered" claim).
- **Reconnect-race edge case.** If the user triggers a second travel during the cinematic, we need to cancel the first sequence and start the second from the current state. Simple cancellation token inside `playPortalTransition` handles it.
- **OrbitControls reset.** If the chase-camera depends on user input during travel, disabling controls for 1.2s might feel weird. Acceptable — the transition is brief.
- **Storage-disabled mobile browsers** (private Safari) — `persist` will fail silently. Skip toggle defaults to `false` and just won't remember. Acceptable.

## Acceptance mapping (from #85)

1. ✅ 1.2s sequence — camera push, radial wipe, white flash, fade-in — `PortalTransition` drives all four layers.
2. ✅ Wired into zone-swap path via `ZoneTransition` swap; cinematic decoupled from reconnect duration.
3. ✅ Camera input disabled during cinematic — OrbitControls `enabled={!cinematicActive}`.
4. ✅ Mobile parity — DOM-only wipe, no added meshes. Verify in 390×844.
5. ✅ Skip toggle — SettingsPanel checkbox → preferences store → ZoneTransition branch.
6. ✅ No studio in bundle — grep confirmed.
7. ✅ Bundle diff < 100 KB gzipped — confirmed via `bun run build` comparison.
8. ✅ Biome + typecheck + CI green.

## Verification checklist for the agent

1. `preview_start client` + `preview_start server`. Log in, travel lobby→arena. Cinematic plays cleanly. Run at 1440×900 and 390×844 (`preview_resize`).
2. Enable "Skip cinematics" in Settings. Travel again — fallback fade plays instead. Persist across page reload.
3. Rapid-swap: trigger two travels within 300ms of each other. Cinematic cancels + restarts cleanly, no stuck overlay, no double camera drift.
4. `bun run build --filter @game/client` — note output size; compare to a pre-change baseline. Flag in PR if >100 KB gzipped delta.
5. `grep -r "@theatre/studio" apps/client/dist` — should produce no results.
6. `bun run check` + `bun run typecheck` clean.
7. `bun test` server suite still 66 pass.

## Out of scope

- theatre.js studio-authored sequence — programmatic sheet only this PR.
- Per-portal variations (different animations per destination) — single sequence for all portals now.
- Audio cues tied to the cinematic — deferred; can layer with existing SFX later.
- Particle wipe — DOM gradient only. Particles are a follow-up.

## Retro
_(filled after merge)_
