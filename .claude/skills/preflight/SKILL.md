---
name: preflight
description: Run the checks that CI will run — biome + typecheck. Invoke before every git commit.
---

# preflight

Mirror of what CI runs. Must be clean before commit.

```bash
cd /Users/user/Documents/projects/game
bun run check:fix   # biome autofix
bun run typecheck   # tsc --noEmit across workspaces
```

If either fails, fix and re-run. Never commit red.

For UI-touching changes, also:
1. `preview_start client` and `preview_start server`
2. Manually exercise the changed flow (signup, zone switch, etc.)
3. `preview_console_logs level=error` — must be empty
