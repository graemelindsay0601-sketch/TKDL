# Self-review before shipping — 2026-09-14

You asked me to review my own work and flag anything I'd fix before you ship it. Here's what that turned up, and what I did about each item. Also below: confirmation that everything is now actually on your computer, not just in my sandbox.

## What the review found

**1. Admin build lock could jam on a legitimately slow build — fixed.**
The lock added for "regenerate", "create episode" and "clean sweep" originally used a flat timeout to decide a lock was stale. But build time scales with the admin-configurable simulation count (up to 50,000), so a flat timeout can't be both safe against a real crash and tolerant of a real slow build — set it too short and a slow-but-healthy build gets its own lock stolen out from under it; too long and a genuinely crashed build jams the other two actions for that whole window.

Replaced it with a heartbeat: the lock holder refreshes `locked_at` every 2 minutes for as long as the build is actually running, and staleness is judged by silence (3 missed heartbeats = 6 minutes with no refresh), not by elapsed time. A build can now run as long as it needs to; a crash is still caught within 6 minutes. Wired into all three entry points (`forceRebuildCurrentEdition`, `createManualBroadcastEpisode`, `createBroadcastCleanSweep`) identically.

**2. story-engine.ts's Singles loop wasn't isolating failures the same way as Doubles — fixed.**
The per-match try/catch added earlier this session wrapped `processSinglesMatch` itself, but the loop that writes each detected story (`recordUpsert`) sat *outside* that try — so a database write failure on one match's story would still crash the whole batch, which is exactly the failure mode the try/catch was supposed to close off. The Doubles loop already had this right (both the detection call and its write loop share one try/catch). Moved the Singles write loop inside its try so it now matches.

**3. Checked, not a bug: the dropped duplicate `maybeAutoResetLeagueSeasons()` call.**
Earlier in this session I removed a second, duplicate call to this function that existed on both sides of `seedPlayoffMatches()` in `app.ts`'s boot sequence. The review flagged this as worth double-checking rather than assuming. Read the function's own code comment: it explicitly documents that each per-league check is idempotent (it only resets when the active season's start month differs from the current month), so calling it once instead of twice on boot is safe — not a regression.

## Verified after all of the above

- `pnpm run typecheck` — clean across all 4 workspace projects.
- `pnpm run test` — 692/692 passing.
- `pnpm --filter @workspace/api-server run build` — succeeds.
- `pnpm --filter @workspace/tkdl run build` — succeeds.

## It's actually on your computer now

19 changed/added files are written into `C:\Users\demo.000\Documents\GitHub\TKDL`, in place, at their real paths — not just delivered as a download. I spot-checked two of them (`edition-engine.ts`, `tour.ts`) by reading them back off your machine and diffing against my working copy: byte-identical. GitHub Desktop should now show these as modified/new files ready for you to review and commit yourself — I haven't touched git at all, that's still entirely your call.

**Four files were not written**, because I can only write files through this connection, not delete them, and these four are dead-code removals (562-1015 lines of superseded code with no remaining references, each documented in-place with a comment explaining why — the old duplicate achievement-reward lookup, an old purchase-date migration, a route file, and an unused shop migration). Leaving them in place is harmless — they're inert, unreferenced, and match what's already on `origin/main`. If you want them gone too, either delete them yourself or apply the attached patch (`git apply`), which removes them cleanly:

- `artifacts/api-server/src/db/migrations/add_purchase_date.ts`
- `artifacts/api-server/src/lib/achievement-rewards.ts`
- `artifacts/api-server/src/routes/enhanced-features-routes.ts`
- `lib/db/src/migrations/featured-card-shop.ts`

## What's still open

Nothing from this review is left undone. Still waiting on your call, unchanged from before:
- The `full-project-sweep-2026-09-12.md` findings (practice.ts, challenge-manager.ts/challenge-service.ts, team-matches.ts, lib/seasonReset.ts, and the lower-priority items).
- The 4 Card-Clash-scoped idempotency bugs, left alone per your instruction.
- Repo hygiene (114 stray root files, old Replit leftovers) — needs your explicit go-ahead given the volume.
