/**
 * REMOVED 2026-09-25 — this file is now inert and unreferenced.
 *
 * This used to be an in-memory API response cache (see git history for
 * the full original implementation). It was mounted with
 * `app.use("/api", cacheMiddleware())` in app.ts, then disabled with the
 * comment "TEMPORARILY DISABLED — testing if it causes match submission
 * to fail" — and never revisited.
 *
 * Investigated and confirmed why: invalidateCache(), the function meant to
 * clear a stale cache entry after any mutation, was only ever called from
 * one route in the entire app (stats-detailed.ts's drill-completion
 * route). Every other mutation — including submitting a match — never
 * invalidated anything, so re-enabling this as it stood would have served
 * cached (stale) leaderboard/match/player-stats responses for up to 10
 * minutes after almost any real write. That's exactly the "match
 * submission looks broken" symptom the disabling comment described — the
 * submission itself worked, but the leaderboard/stats the player checked
 * right after kept showing the old numbers.
 *
 * There was a second, independent bug: the cache key tried to fold in the
 * logged-in player's id via `req.user?.id`, but this app authenticates
 * entirely through `req.session.playerId` — `req.user` is never set
 * anywhere in the codebase, so that part of the key always resolved to
 * the literal string "anon" for every request, from every player.
 *
 * Decision: remove rather than fix-and-re-enable. Re-enabling it correctly
 * would mean auditing every mutation route in the app (achievements,
 * practice sessions, matches, community, cosmetics, self-play-unlocks —
 * a large and growing list) to add a real invalidateCache() call, which is
 * more ongoing maintenance risk than the performance win is worth right
 * now. app.ts no longer imports or mounts this file.
 *
 * Left in place only because this session couldn't delete files on the
 * user's machine — safe to delete this file entirely; nothing references
 * it anymore.
 */
export {};
