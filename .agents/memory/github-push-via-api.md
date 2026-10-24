---
name: GitHub merge safety
description: Safe checks for integrating a local branch with the live GitHub main branch.
---

Verify the current `main` commit through the GitHub integration/API before relying on local remote-tracking refs. If GitHub main has advanced, merge that history and reconcile changes before updating main; do not force-push.

**Why:** local refs can be stale, and a tree API update that deletes paths already absent from the base tree can fail with `GitRPC::BadObjectState`.

**How to apply:** compare the live API SHA with the branch's common base, inspect overlapping paths, and only update main after validation against the combined tree.

If the Git remote rejects authentication but the GitHub integration is connected, publish through the integration API: build the desired tree from the verified live main tree, confirm it matches the local tree, create a commit with live main as its parent, and update the ref with `force: false`. Recheck the live ref immediately before updating it.

**Why:** Git HTTPS credentials may be unavailable even while the managed GitHub integration can write; a checked tree and fast-forward-only ref update avoid losing concurrent work.

**How to apply:** never ask for or expose credentials to repair a failed push; use the managed connection and stop if the live branch moved or the tree does not match.

The internal GitHub remote can accept a push and update the hosted branch, then return a nonzero status because Replit blocks updating its local remote-tracking ref lock. Verify the hosted ref through the GitHub integration before deciding whether the push failed; do not retry with `DANGEROUSLY_ALLOW_GIT`.

**Why:** retrying after a server-side success risks duplicate or conflicting work, while bypassing the local Git guard can damage Replit's repository metadata.

**How to apply:** when push output shows the remote accepted the update but local ref refresh failed, check the live branch SHA through GitHub and leave local tracking refs alone unless a separate repair is necessary.

For this project, push each fully completed work step to GitHub `main` instead of accumulating completed steps locally. If direct Git push is unavailable, a verified API snapshot commit is acceptable when it includes the complete merged tree.

**Why:** the user wants completed work on `main` promptly so later integration does not accumulate a large local backlog.

**How to apply:** after each completed step, verify the live `main` SHA, validate the complete intended tree, and publish without force-updating the ref.
