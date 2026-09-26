import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * "Combined side" matches for Doubles Event and Shift Wars — a single live
 * match where one official team plays alone (the "solo" side) against a
 * temporary grouping of two or more OTHER official teams (the "combined"
 * side), e.g. Graeme's doubles pairing taking on a made-up group pulled
 * from two different other pairings, as a handicap, in one sitting.
 *
 * Deliberately a brand new, additive pair of tables per domain rather than
 * any change to doubles_matches/shift_wars_matches — those two tables and
 * every route/achievement/notification/stat that already reads them assume
 * exactly one winner_team_id and one loser_team_id, and that assumption is
 * load-bearing all over the existing codebase. A combined match is a
 * genuinely different shape (1 team vs N teams), so it gets its own table
 * rather than forcing that shape into columns built for 1-vs-1.
 *
 * The solo side's own result lives directly on the parent row (it's exactly
 * one team). The combined side's result — one row per team that was part of
 * the combined group — lives in the child "_sides" table, since there can be
 * two or more of them. Each combined-side team's points_delta (and, for
 * doubles, elo_delta) is its own proportional SHARE of the match's full pot/
 * elo swing, split by how many of its own players it fielded into the
 * combined group (see lib/wager.ts's splitProportional/applyCombinedWager) —
 * not the full amount, so one physical result never reads as two separate
 * full wins or losses for the two teams that combined. Each combined-side
 * team does still get exactly one win or one loss recorded on its own
 * doubles_teams/shift_wars_teams row, same as if it had played its own
 * match — only the size of the points/elo swing is shared, not whether it
 * counts.
 *
 * Shift Wars has no Elo/tier ladder and isn't season-scoped (see
 * routes/shift-wars.ts's own header comment) — its combined tables mirror
 * that: no elo_delta column, no season_id.
 */
export async function addCombinedMatchesTables(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS doubles_combined_matches (
        id SERIAL PRIMARY KEY,
        season_id INT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
        played_at TIMESTAMP NOT NULL DEFAULT NOW(),
        solo_team_id INT NOT NULL REFERENCES doubles_teams(id) ON DELETE CASCADE,
        solo_fielded_count INT NOT NULL DEFAULT 1,
        solo_won BOOLEAN NOT NULL,
        stake INT NOT NULL,
        pot INT NOT NULL,
        solo_points_delta INT NOT NULL,
        solo_elo_delta INT NOT NULL,
        game_type TEXT NOT NULL DEFAULT 'doubles_501',
        notes TEXT
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_doubles_combined_matches_season_id ON doubles_combined_matches (season_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_doubles_combined_matches_solo_team_id ON doubles_combined_matches (solo_team_id)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS doubles_combined_match_sides (
        id SERIAL PRIMARY KEY,
        match_id INT NOT NULL REFERENCES doubles_combined_matches(id) ON DELETE CASCADE,
        team_id INT NOT NULL REFERENCES doubles_teams(id) ON DELETE CASCADE,
        fielded_count INT NOT NULL DEFAULT 1,
        points_delta INT NOT NULL,
        elo_delta INT NOT NULL,
        eliminated BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_doubles_combined_match_sides_match_id ON doubles_combined_match_sides (match_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_doubles_combined_match_sides_team_id ON doubles_combined_match_sides (team_id)
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS shift_wars_combined_matches (
        id SERIAL PRIMARY KEY,
        played_at TIMESTAMP NOT NULL DEFAULT NOW(),
        solo_team_id INT NOT NULL REFERENCES shift_wars_teams(id) ON DELETE CASCADE,
        solo_fielded_count INT NOT NULL DEFAULT 1,
        solo_won BOOLEAN NOT NULL,
        stake INT NOT NULL,
        pot INT NOT NULL,
        solo_points_delta INT NOT NULL,
        game_type TEXT NOT NULL DEFAULT 'shift_wars_501',
        notes TEXT
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_shift_wars_combined_matches_solo_team_id ON shift_wars_combined_matches (solo_team_id)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS shift_wars_combined_match_sides (
        id SERIAL PRIMARY KEY,
        match_id INT NOT NULL REFERENCES shift_wars_combined_matches(id) ON DELETE CASCADE,
        team_id INT NOT NULL REFERENCES shift_wars_teams(id) ON DELETE CASCADE,
        fielded_count INT NOT NULL DEFAULT 1,
        points_delta INT NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_shift_wars_combined_match_sides_match_id ON shift_wars_combined_match_sides (match_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_shift_wars_combined_match_sides_team_id ON shift_wars_combined_match_sides (team_id)
    `);

    logger.info("Combined-match tables (doubles + shift wars) ready");
  } catch (err) {
    logger.error({ err }, "Failed to create combined-match tables");
  }
}
