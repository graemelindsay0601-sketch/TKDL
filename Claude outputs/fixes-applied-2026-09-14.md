# TKDL fixes applied — 2026-09-14 (sweep follow-up)

Four items from `full-project-sweep-2026-09-12.md` you picked to fix: `practice.ts` + `team-matches.ts`, `lib/seasonReset.ts`, and `challenge-manager.ts`/`challenge-service.ts`. All four are the same double-award/lost-update shape already fixed twice earlier this session, just in new places. Verified after every change: `pnpm run typecheck` clean, `pnpm run test` 692/692 passing, both production builds succeed.

All 10 changed/new files are already written into `C:\Users\demo.000\Documents\GitHub\TKDL` — spot-checked by reading one back off your machine and diffing against my copy (identical). Nothing committed or pushed, as always.

---

## practice.ts — no idempotency protection

`POST /practice/sessions` has no login check by design (a shared walk-up device), which also meant no natural resource to guard a retry against — every call just inserted a fresh row, so a flaky connection retry duplicated the session, the 10-coin win award, and the challenge-progress update.

Fixed with a server-computed idempotency key: a hash of the full validated request body (every scoring/checkout dart, not just the summary numbers), stored on the row with a unique index and `ON CONFLICT DO NOTHING`. A genuine retry reproduces the hash exactly and the duplicate insert is silently absorbed — no client changes needed. New migration: `add_practice_session_idempotency_key.ts`.

## team-matches.ts — lost-update race

The one place this session's row-locking fix pattern hadn't been applied yet. `matches.ts`/`doubles.ts`/`shift-wars.ts` all re-read and lock both players `FOR UPDATE` inside their transaction before computing new stats; `team-matches.ts` computed everything from a snapshot read taken *before* the transaction opened. Two team matches sharing a player, submitted close together, could have the second one silently overwrite the first's stat gains.

Fixed the same way: every involved player (up to 12, across both teams) is now locked inside the transaction in a fixed id order (to avoid deadlocking against another overlapping match), elimination/stake are re-validated against that locked state, and every derived value (Elo, points, shares) is recomputed from it. Also fixed the season match counter to use a database-side increment instead of a pre-transaction read — non-overlapping-player matches could still race on that shared counter even with no player-lock contention between them.

## lib/seasonReset.ts — non-transactional, no concurrency guard

Season close/reset was a long check-then-act sequence with nothing stopping two concurrent triggers — a manual admin "reset now" racing the scheduled daily cron, or a double click — from both running the whole thing for the same league.

Added a per-league lock (new `season_reset_lock` table, claimed with a short staleness timeout — these resets are fast, so no heartbeat needed like the admin build lock). The scheduled path skips silently if it loses the race (something else is already handling it); the three manual admin routes (`/seasons/reset`, `/seasons/doubles/reset`, `/seasons/shift-wars/reset`) return 409. Also added the missing unique constraint on `season_standings(season_id, player_id)` (de-duplicating any existing doubles first) with `ON CONFLICT DO NOTHING` on the snapshot insert, as defense in depth. The close-season/reset-players/open-new-season sequence is now one transaction per league, so a crash partway through can no longer leave players reset with no season to play into (or vice versa).

## challenge-manager.ts / challenge-service.ts — double-award race

Both had the identical shape: read a challenge's progress into JS, write it back with a plain UPDATE, then separately decide "just completed" and award coins — two calls landing close together (two games finishing at once) could both read the same stale progress and both award. This is shared code — `challenge-manager.ts` is called from `practice.ts` and `tour.ts` as well as Card Clash's own `card-clash-service.ts`, so this fix incidentally also closes the same race there, even though Card Clash's own dedicated bugs are still untouched per your standing instruction.

Fixed with one atomic `UPDATE ... FROM ... WHERE is_completed = false ... RETURNING` per challenge row: the increment, the completion flip, and the guard all happen in one database statement, so a second concurrent call simply matches zero rows once the first has committed. Also fixed `challenge-service.ts`'s own `awardCoins`, which did an unsafe read-then-write on the coin balance instead of reusing `addCoinsToPlayer` (the app's one atomic increment-in-place helper) — same race, and it now also tracks `lifetimeCoinsEarned` correctly, which it never did before.

---

## Still open

Unchanged from the sweep report — not yet actioned, awaiting your call:
- The lower-priority admin-only races (`admin.ts`, `auth.ts`, `seasons.ts` playoff crowning, `boss-battles.ts`) — each needs two admins acting at once to trigger.
- Repo hygiene (114 stray root files, old Replit leftovers) — needs your explicit go-ahead given the volume.
- The 4 Card-Clash-specific idempotency bugs (`card-clash-service.ts`, `card-clash-login-service.ts`, `card-clash-achievements.ts`, `free-pack-service.ts`) — left alone per your steer, though see the challenge-manager.ts note above for the one partial overlap.
