---
name: update-work
description: Move a shipped item to Done in docs/work.md. Invoke after every PR merge.
---

# update-work

Edit [docs/work.md](../../../docs/work.md) in place:

1. Find the Backlog/Next line for the item.
2. Delete it from Backlog (don't strike-through in the live list — only in Done).
3. Append a line to **Done** in this format:
   ```
   - [x] <short description>. [#<PR>](../../issues/<N>)
   ```
   Use the issue number, not the PR number, in the link path — GitHub redirects `issues/<N>` → PR if N is a PR.
4. If the Now section now has nothing, set:
   ```
   ## Now
   _Nothing in flight._ Pick from **Next**.
   ```
5. Commit as `docs(work): mark #<N> done` directly on main — no PR needed for work.md updates.
