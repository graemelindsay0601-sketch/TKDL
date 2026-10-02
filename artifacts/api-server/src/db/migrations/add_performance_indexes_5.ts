import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Gap-filling indexes found during a performance trace, covering columns the
 * previous four index passes missed — mostly because the tables involved
 * (combined/multi-team Doubles & Shift Wars) were added after those passes:
 *
 * - doubles_matches.season_id: filtered in routes/doubles.ts, routes/admin.ts
 *   and routes/team-match-corrections.ts, but never indexed — shift_wars_matches
 *   got the equivalent index in add_shift_wars_match_season.ts, doubles_matches
 *   was simply missed.
 * - doubles_matches / shift_wars_matches winner_team_id / loser_team_id: no
 *   route filters on these yet, but they're the same shape as matches.winnerId/
 *   loserId (already indexed) and the first "team match history" page would
 *   otherwise silently sequential-scan.
 * - played_at on all four combined/multi-team tables: match-centre.ts always
 *   queries these ORDER BY played_at DESC LIMIT 250/500. Low row-count today,
 *   but cheap to add now rather than waiting for it to matter.
 * - A functional index matching GET /matches/flashback's
 *   EXTRACT(MONTH FROM played_at) / EXTRACT(DAY FROM played_at) equality
 *   predicate, which the existing idx_matches_played_at (a plain btree on the
 *   raw timestamp) can't serve — Postgres can use a matching expression index
 *   for an equality lookup, so this lets that dashboard widget avoid a full
 *   sequential scan of matches without changing the query itself.
 *
 *   played_at is `timestamp with time zone` (lib/db/src/schema/matches.ts),
 *   and Postgres marks EXTRACT(... FROM a timestamptz) as STABLE rather than
 *   IMMUTABLE — its result depends on the session's `timezone` setting — so
 *   Postgres refuses it directly in an index expression ("functions in index
 *   expression must be marked IMMUTABLE"). This has been failing on every
 *   single boot since this migration was added: the failure withholds the
 *   fast-wake marker for the whole deploy (see index.ts/deployment-
 *   bootstrap.ts), so every wake — not just the first one after a deploy —
 *   was paying the full ~40-step schema pass instead of the one-query fast
 *   path. That was the actual cause of "waking up takes much longer than
 *   normal", not the fast-wake mechanism itself.
 *
 *   Fixed the standard way: two tiny SQL wrapper functions that pin the
 *   conversion to a fixed zone (UTC — this app stores played_at in UTC and
 *   the container's own TZ is UTC) before extracting, so the result really
 *   is deterministic for a given input and the IMMUTABLE label is honest.
 *   routes/matches.ts's flashback query now calls these same two functions
 *   (instead of raw EXTRACT) so the planner's expression match actually
 *   finds this index rather than silently falling back to a sequential scan.
 */
export async function addPerformanceIndexes5() {
  const indexes = [
    sql`CREATE INDEX IF NOT EXISTS idx_doubles_matches_season_id ON doubles_matches(season_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_doubles_matches_winner_team_id ON doubles_matches(winner_team_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_doubles_matches_loser_team_id ON doubles_matches(loser_team_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_shift_wars_matches_winner_team_id ON shift_wars_matches(winner_team_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_shift_wars_matches_loser_team_id ON shift_wars_matches(loser_team_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_doubles_combined_matches_played_at ON doubles_combined_matches(played_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_shift_wars_combined_matches_played_at ON shift_wars_combined_matches(played_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_doubles_multi_matches_played_at ON doubles_multi_matches(played_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_shift_wars_multi_matches_played_at ON shift_wars_multi_matches(played_at DESC)`,
    sql`CREATE OR REPLACE FUNCTION immutable_month_utc(ts timestamptz) RETURNS integer
          LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT EXTRACT(MONTH FROM ts AT TIME ZONE 'UTC')::integer $$`,
    sql`CREATE OR REPLACE FUNCTION immutable_day_utc(ts timestamptz) RETURNS integer
          LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT EXTRACT(DAY FROM ts AT TIME ZONE 'UTC')::integer $$`,
    sql`CREATE INDEX IF NOT EXISTS idx_matches_flashback_month_day ON matches(immutable_month_utc(played_at), immutable_day_utc(played_at))`,
  ];

  for (const query of indexes) await db.execute(query);
}
