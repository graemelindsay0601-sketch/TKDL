---
name: GitHub merge safety
description: Safe checks for integrating a local branch with the live GitHub main branch.
---

Verify the current `main` commit through the GitHub integration/API before relying on local remote-tracking refs. If GitHub main has advanced, merge that history and reconcile changes before updating main; do not force-push.

**Why:** local refs can be stale, and a tree API update that deletes paths already absent from the base tree can fail with `GitRPC::BadObjectState`.

**How to apply:** compare the live API SHA with the branch's common base, inspect overlapping paths, and only update main after validation against the combined tree.
