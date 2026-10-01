import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * "Multi-team" matches for Doubles Event and Shift Wars — 3 or more official
 * teams (pairings or departments) play ONE live elimination game together
 * (MultiKillerScorer on the frontend — the same engine Singles' existing
 * Killer Free-for-All mode already uses for 3-6 individual players), with a
 * single overall winner and everyone else eliminated along the way.
 *
 * Deliberately a brand new, additive pair of tables per domain, same
 * reasoning as add_combined_matches.ts: doubles_matches/shift_wars_matches
 * assume exactly one winner_team_id and one loser_team_id everywhere they're
 * read, and a 3+-way result is a genuinely different shape. Settlement
 * itself mirrors Singles' Killer FFA (routes/team-matches.ts, "per-player"
 * stakeMode: one winner vs N-1 losers) rather than the combined-side match's
 * proportional split — every participant here is a full, independent
 * official team, not an uneven sub-group — see lib/wager.ts's
 * multiMatchPot/applyMultiWager.
 *
 * The winner's own result lives on the parent row; one row per participant
 * (winner included, for a complete roster of who played) lives in the child
 * "_participants" table. Shift Wars has no Elo/tier ladder, so its table has
 * no elo_delta — same split as the combined-match tables.
 */
export async function addMultiMatchesTables(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS doubles_multi_matches (
        id SERIAL PRIMARY KEY,
        season_id INT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
        played_at TIMESTAMP NOT NULL DEFAULT NOW(),
        winner_team_id INT NOT NULL REFERENCES doubles_teams(id) ON DELETE CASCADE,
        participant_count INT NOT NULL,
        stake INT NOT NULL,
        pot INT NOT NULL,
        elo_change INT NOT NULL,
        game_type TEXT NOT NULL DEFAULT 'doubles_501',
        notes TEXT
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_doubles_multi_matches_season_id ON doubles_multi_matches (season_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_doubles_multi_matches_winner_team_id ON doubles_multi_matches (winner_team_id)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS doubles_multi_match_participants (
        id SERIAL PRIMARY KEY,
        match_id INT NOT NULL REFERENCES doubles_multi_matches(id) ON DELETE CASCADE,
        team_id INT NOT NULL REFERENCES doubles_teams(id) ON DELETE CASCADE,
        is_winner BOOLEAN NOT NULL,
        points_delta INT NOT NULL,
        elo_delta INT NOT NULL,
        eliminated BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_doubles_multi_match_participants_match_id ON doubles_multi_match_participants (match_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_doubles_multi_match_participants_team_id ON doubles_multi_match_participants (team_id)
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS shift_wars_multi_matches (
        id SERIAL PRIMARY KEY,
        season_id INT REFERENCES seasons(id) ON DELETE CASCADE,
        played_at TIMESTAMP NOT NULL DEFAULT NOW(),
        winner_team_id INT NOT NULL REFERENCES shift_wars_teams(id) ON DELETE CASCADE,
        participant_count INT NOT NULL,
        stake INT NOT NULL,
        pot INT NOT NULL,
        game_type TEXT NOT NULL DEFAULT 'shift_wars_501',
        notes TEXT
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_shift_wars_multi_matches_season_id ON shift_wars_multi_matches (season_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_shift_wars_multi_matches_winner_team_id ON shift_wars_multi_matches (winner_team_id)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS shift_wars_multi_match_participants (
        id SERIAL PRIMARY KEY,
        match_id INT NOT NULL REFERENCES shift_wars_multi_matches(id) ON DELETE CASCADE,
        team_id INT NOT NULL REFERENCES shift_wars_teams(id) ON DELETE CASCADE,
        is_winner BOOLEAN NOT NULL,
        points_delta INT NOT NULL,
        eliminated BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_shift_wars_multi_match_participants_match_id ON shift_wars_multi_match_participants (match_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_shift_wars_multi_match_participants_team_id ON shift_wars_multi_match_participants (team_id)
    `);

    logger.info("Multi-team match tables (doubles + shift wars) ready");
  } catch (err) {
    logger.error({ err }, "Failed to create multi-team match tables");
  }
}
