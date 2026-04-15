# Plan: #17 — Shadcn component set

**Status:** draft
**Owner agent:** frontend
**Branch:** `feat/shadcn-ui`

## Context
We have ad-hoc auth forms and admin views with custom CSS. Adding the canonical Shadcn primitives upfront prevents UI drift as we build the HUD, settings panel, inventory, and admin tables.

## Options considered

1. **Shadcn CLI install per component.** Standard path. Requires `components.json` and Tailwind v3 setup.
2. **Hand-port the JSX.** Avoids CLI but loses upgradability. Rejected.
3. **Use a different primitive set (Mantine, Park UI, Radix Themes).** All work, but CLAUDE.md already commits to shadcn/ui. Rejected.

## Chosen approach
Option 1. Install the shadcn CLI dependencies, scaffold `components.json`, configure Tailwind v3, and add the seven components called out in the issue. Migrate the existing auth forms to use the new primitives.

## File impact
- `apps/client/components.json` — **new** (shadcn config).
- `apps/client/tailwind.config.ts` — **new** if not present; ensure `tailwind-animate` plugin.
- `apps/client/postcss.config.js` — **new/updated** for Tailwind v3.
- `apps/client/src/index.css` — Tailwind base/components/utilities + CSS variable theme tokens.
- `apps/client/src/components/ui/{card,dialog,dropdown-menu,input,label,table,toast}.tsx` — **new**.
- `apps/client/src/lib/utils.ts` — `cn()` helper.
- `apps/client/src/auth/SignUp.tsx` + `SignIn.tsx` — migrate to `<Card>`, `<Input>`, `<Label>`.
- `apps/client/src/admin/PlayersPage.tsx`, `RoomsPage.tsx` — migrate to `<Table>`.
- `apps/client/src/App.tsx` — mount `<Toaster />` (sonner).
- `apps/client/src/hud/Header.tsx` — theme toggle becomes `<DropdownMenu>` with light/dark/system.
- `apps/client/package.json` — add `@radix-ui/react-*` (dialog, dropdown-menu, label), `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, `sonner`, `lucide-react`, `tailwindcss@^3.4`.

## Risks / unknowns
- **Tailwind not yet installed.** Inspect `apps/client/src/index.css` and existing styles first; we may have plain CSS today. Need to wire Tailwind without breaking existing styles in the same PR.
- **Bundle size:** Radix primitives + tailwind add ~30–50 KB gz. Acceptable; document baseline in retro.
- **Theme tokens:** must align with the existing dark-mode toggle (commit `f61eb64`). Inspect what's in place — likely a `data-theme` attribute on `<html>`.
- **Sonner:** lives outside `<Toaster />` in some setups; verify mount placement.

## Acceptance mapping
- ✅ Components added under `apps/client/src/components/ui/`: card, dialog, dropdown-menu, input, label, table, toast (sonner).
- ✅ Tailwind config + `tailwind-animate` plugin wired.
- ✅ Existing auth forms migrate to `<Card>`, `<Input>`, `<Label>`.
- ✅ Admin players/rooms pages use `<Table>`.
- ✅ `<Toaster>` mounts at root; connection state changes (disconnected/reconnected) emit toasts.
- ✅ Theme toggle uses `<DropdownMenu>` for light/dark/system.
- ✅ All components typecheck, no biome errors.

## Out of scope
- HUD redesign — only the existing pieces are migrated; new HUD elements come with combat/inventory PRs.
- New animations beyond `tailwindcss-animate` defaults.

## Retro
_(filled after merge)_
