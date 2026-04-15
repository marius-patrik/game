---
name: maintenance
description: Proactive code / doc / dependency hygiene. Run between feature shipments or when idle.
---

# maintenance

Always running in the background of any agent's mindset. Between features, or when a natural break appears, sweep for rot and fix it in a dedicated `chore/<name>` PR.

## Checklist

Run each item. If you find something, fix it in a small PR rather than piling it onto a feature PR.

### Code

1. **Dead code**: grep for unused exports (`knip` or manual). Delete anything unreferenced.
2. **TODO / FIXME / XXX**: `rg "TODO|FIXME|XXX"`. Either fix or file an issue with the line as context; never leave untracked.
3. **`any` creep**: `rg "as any|@ts-ignore|@ts-expect-error"` — every match must either have a biome ignore comment explaining WHY or be replaced with a real type.
4. **Biome warnings** (not just errors): `bun run check` — treat warnings as failures.
5. **Circular deps**: if `bun run typecheck` starts slowing down or any module imports itself transitively, break the cycle.

### Tests

6. **Skipped tests**: `rg "\.skip\(|\.only\("`. Must be zero on main.
7. **Flaky tests**: any test that's been re-run in CI more than once in the last week — investigate.

### Docs

8. **Stale references**: `rg "docs/work.md|CLAUDE.md|\.claude/"` in all files — confirm every path still exists.
9. **Outdated screenshots**: if a PR changed UI, ensure README/docs screenshots aren't stale.
10. **New gotcha**: if you tripped on something non-obvious during the last feature, append to [.claude/memory/pitfalls.md](../../memory/pitfalls.md).
11. **ADR**: if the last feature made an architectural choice (e.g. "server-authoritative combat via X"), write an ADR under [docs/decisions/](../../../docs/decisions/).

### Deps

12. **Security advisories**: `bun outdated` — update anything with a CVE immediately. Otherwise batch non-breaking minors monthly.
13. **Unused deps**: check `package.json` against actual imports. Remove.
14. **Bundle size**: `bun --cwd apps/client run build` and compare `dist/static/js/*.js` sizes against last known. If a commit bloated the bundle > 10 %, investigate.

### Infra

15. **CI time**: if CI runtime doubled, profile. Caching dropped? Tests slow?
16. **Gitignore**: `git status -s` with a fresh clone should be empty. Anything showing up that should be ignored → add.

## When to run

- After every shipped feature (skim the checklist — fix quick wins inline, file issues for big ones).
- When the **Next** queue is empty, instead of asking the user.
- When you notice symptoms mid-feature (but open a separate PR — don't mix cleanup into feature work).
