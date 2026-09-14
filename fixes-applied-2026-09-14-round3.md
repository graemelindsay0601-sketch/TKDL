# TKDL fixes applied — 2026-09-14 (round 3: admin-only races)

The four remaining "admin-only" items from `full-project-sweep-2026-09-12.md` you picked to fix: `admin.ts` (two routes), `auth.ts`, `seasons.ts` playoff crowning (two routes), and `boss-battles.ts`. Each needs two admins acting at once (or an admin double-submitting) to actually trigger, which is why they were lower priority than the earlier batch — but the same lost-update/double-insert shape applies. Verified after every change: `pnpm run typecheck` clean across the whole monorepo, `pnpm run test` 692/692 passing, both production builds succeed.

All 6 changed/new files are already written into `C:\Users\demo.000\Documents\GitHub\TKDL` — spot-checked by reading `boss-battles.ts` back off your machine and diffing against my copy (identical). Nothing committed or pushed, as always.

---

## admin.ts — PATCH /admin/matches/:id (match edit)

Editing a match recomputed both players' stats from a plain read taken before the update — two admins editing overlapping matches (or the same match twice) close together could have one edit's stat changes silently overwritten by the other's.

Fixed with the same pattern used everywhere else this session: the match row and every involved player (old winner/loser plus whatever the edit changes them to, up to 4 distinct players) are locked `FOR UPDATE` inside a transaction, in a fixed sorted order so two overlapping edits can't deadlock each other. The revert-old-stats/apply-new-stats math is unchanged, just computed against the locked rows instead of a stale snapshot.

## admin.ts — PATCH /admin/seasons/:id/standings/:playerId (standings edit)

Manually editing a player's season standing did a check-then-insert-or-update — the same shape that caused double rows elsewhere in the sweep. Two admins editing the same player's standing at once could both pass the "does a row exist" check and both insert, leaving two rows for one player/season.

Fixed with `onConflictDoUpdate` against the `season_standings(season_id, player_id)` unique index (the one added for `seasonReset.ts` last round), so the insert-or-update is one atomic statement instead of two separate ones with a gap between them.

## auth.ts — POST /admin/users (create account)

Creating a login for a player did a plain "does this player already have an account" check, then inserted — nothing stopped two admins (or a double-click) from both passing that check for the same player and both inserting, giving one player two accounts.

Fixed with a new unique index on `users.player_id` (new migration `add_users_player_id_unique.ts`) and `ON CONFLICT DO NOTHING` on the insert; the route now reports "this player already has an account" if it loses the race, instead of silently creating a duplicate. The migration deliberately does **not** auto-delete any pre-existing duplicate the way the `season_standings` fix did — a duplicate user account carries its own password hash, admin flag, and login history, and guessing which one to delete on boot risks locking someone out or dropping an admin grant. If a duplicate already exists in the database, the index creation will fail (logged, not thrown, per this codebase's migration convention) and needs a manual look; the fix still takes effect for every account created from here on.

## seasons.ts — playoff crowning (POST + PATCH)

Recording a playoff match result and crowning a season champion was multiple separate statements (insert or update the match, then — if it was the deciding game — update the season and both players' standings). A crash or lost connection partway through could leave a season closed with no champion recorded, or a champion recorded with the season still open.

Both routes now do that sequence — the match write plus the conditional champion-crowning — inside one transaction, so it's all-or-nothing.

**Separate finding, not fixed, needs your call:** while in this file I found that `PATCH /seasons/:id/playoff/:matchId` builds `sets`/`vals` arrays meant for a dynamic update (so a caller can update just `notes`, just `round`, or both), but the actual UPDATE statement that runs ignores them and only ever sets `winner_id` — meaning any `notes` or `round` value sent to this route silently never gets saved. This is unrelated to the race-condition fix above (I left it untouched, consistent with not expanding scope without asking) — let me know if you want it fixed.

## boss-battles.ts — POST /boss-battles/attempt

Recording a boss fight did two separate statements: upsert the attempt/win/best-time stats, then (on a win) insert the ladder-unlock row. Both are individually safe (each uses `ON CONFLICT`), but a crash between the two could leave a win's stats recorded with the unlock never written, blocking the player from starting the next boss despite having beaten this one.

Wrapped both statements in one transaction so they succeed or fail together.

---

## Still open

Unchanged from the sweep report — not yet actioned, awaiting your call:
- The `seasons.ts` PATCH-route dead-code bug noted above (notes/round silently never persist).
- Repo hygiene (114 stray root files, old Replit leftovers, two dead zip/bundle files in git history) — approved this session, not yet started; picking this up next.
- The 4 Card-Clash-specific idempotency bugs (`card-clash-service.ts`, `card-clash-login-service.ts`, `card-clash-achievements.ts`, `free-pack-service.ts`) — left alone per your standing instruction.
