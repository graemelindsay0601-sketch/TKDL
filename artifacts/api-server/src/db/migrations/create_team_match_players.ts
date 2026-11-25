import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Records which team members actually threw in a Doubles or Shift Wars match.
 * Team stats and team-wide credit are untouched; this table only feeds the
 * new per-player "your games for the team" numbers. Old matches have no rows.
 */
export async function createTeamMatchPlayers(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS team_match_players (
        id SERIAL PRIMARY KEY,
        competition TEXT NOT NULL,
        match_kind TEXT NOT NULL DEFAULT 'match',
        match_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        player_id INTEGER NOT NULL,
        won BOOLEAN NOT NULL,
        season_id INTEGER,
        played_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (competition, match_kind, match_id, player_id)
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS team_match_players_player_idx ON team_match_players (player_id, competition)`);
    logger.info("team_match_players ready");
  } catch (err) {
    logger.error({ err }, "Failed to create team_match_players");
  }
}
