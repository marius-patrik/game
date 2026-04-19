---
name: preflight
description: Run the checks that CI will run — biome + typecheck + tests. Invoke before every git commit and before opening a PR.
---

# preflight

Mirror of what CI runs. Must be clean before commit.

```bash
repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"
bun run check:fix   # biome autofix
bun run typecheck   # tsc --noEmit across workspaces
bun test            # workspace test suite
```

If either fails, fix and re-run. Never commit red.

For UI-touching changes, also:
1. `preview_start client` and `preview_start server`
2. Manually exercise the changed flow (signup, zone switch, etc.)
3. `preview_console_logs level=error` — must be empty
