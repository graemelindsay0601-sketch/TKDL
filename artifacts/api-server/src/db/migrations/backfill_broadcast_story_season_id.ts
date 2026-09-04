import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * One-time backfill for broadcast_stories.season_id.
 *
 * add_broadcast_story_season_id.ts's own comment assumed there was "no
 * reliable value to backfill it WITH" for rows written before that column
 * existed, and left collectSeasonHighlights() to fall back to a
 * detectedAt-inside-the-season-window match for them instead. A real
 * captured diagnostic proved that assumption wrong in the one case that
 * actually matters: August 2026's closed season showed 182 real,
 * season-highlight-eligible stories and the fallback matched ZERO of them —
 * every single one had detectedAt clustered at one moment (2026-09-03
 * 08:24:32, seconds before the very first Edition was built), which lines
 * up with a bulk historical-data seed, not with when each underlying match
 * was actually played. detectedAt is simply the wrong signal for this data;
 * there was a reliable value all along, it just wasn't the one being used.
 *
 * Step 1 is that reliable value: a match-anchored story (most of RESULT/
 * PERFORMANCE, and any other family that happens to carry one) names one
 * specific real match, and that match's own season_id IS this story's
 * season — always correct, for any league, any number of past seasons.
 *
 * Step 2 covers the remainder — subject-anchored stories with no single
 * match to point at (most of FORM/H2H/MILESTONE: "player X's current win
 * streak" isn't about one match). These can't be derived precisely after
 * the fact, so this only assigns them when a league has EXACTLY ONE closed
 * season so far — safe today (that's the real, current state of every
 * league), and it deliberately stays scoped to just the season-highlight-
 * eligible story types (story-engine.ts's own HIGHLIGHT_ELIGIBLE_FAMILIES),
 * never the LEAGUE family, so a genuinely CURRENT story (this month's title
 * race) can never be misfiled into a closed season by this step. The moment
 * a second closed season exists for a league, the "exactly one" guard makes
 * this a no-op for it rather than a wrong guess — real detection from here
 * on already threads a correct seasonId through on every upsert (see
 * upsertStoryCandidate's own comment), so this file only ever needs to
 * clean up the one transitional gap between "the column didn't exist yet"
 * and "every story since has carried it properly."
 *
 * Idempotent — every statement is scoped to `season_id IS NULL` — so it's
 * safe to run on every startup alongside this folder's other migrations.
 */
export async function backfillBroadcastStorySeasonId(): Promise<boolean> {
  try {
    // Step 1 — Singles: anchor_match_id -> matches.season_id.
    await db.execute(sql`
      UPDATE broadcast_stories bs
      SET season_id = m.season_id
      FROM matches m
      WHERE bs.season_id IS NULL
        AND bs.league_type = 'singles'
        AND bs.anchor_match_id IS NOT NULL
        AND bs.anchor_match_id = m.id
    `);

    // Step 1 — Doubles/Shift Wars: anchor_match_id -> team_matches.season_id
    // (shared match table for both team leagues — team-matches.ts's own
    // header). A no-op today (both leagues show 0 stories so far) but
    // correct and ready for when they have real history to backfill too.
    await db.execute(sql`
      UPDATE broadcast_stories bs
      SET season_id = tm.season_id
      FROM team_matches tm
      WHERE bs.season_id IS NULL
        AND bs.league_type IN ('doubles', 'shift_wars')
        AND bs.anchor_match_id IS NOT NULL
        AND bs.anchor_match_id = tm.id
    `);

    // Step 2 — remaining subject-anchored rows, only the eligible types,
    // only when exactly one closed season exists for that league.
    const ELIGIBLE_TYPES_BY_LEAGUE: Record<string, string[]> = {
      singles: [
        "UPSET", "MAJOR_UPSET", "MODEL_SHOCK", "HIGH_STAKE_WIN", "HIGH_STAKE_LOSS",
        "ELIMINATION", "LEADER_BEATEN", "STREAK_BREAKER", "DROUGHT_ENDED", "FIRST_H2H_WIN", "REVENGE",
        "WIN_STREAK", "LOSS_STREAK", "FORM_REVERSAL", "QUIET_CLIMBER", "FREEFALL", "ABOVE_BASELINE",
        "H2H_DOMINANCE", "RIVALRY", "RIVALRY_SWING",
        "CLINICAL_FINISHING", "DOUBLE_TROUBLE", "SCORING_POWER", "SCORING_WITHOUT_FINISHING", "SEASON_BEST", "PERSONAL_BEST",
        "CAREER_MATCH_MILESTONE", "CAREER_WIN_MILESTONE", "180_MILESTONE", "ELIMINATION_MILESTONE",
      ],
      doubles: ["UNBEATEN_PAIR", "PAIR_SURGE", "PAIR_UPSET", "PAIR_ELIMINATED"],
      shift_wars: ["SHIFT_LEAD_CHANGE", "SHIFT_MOMENTUM", "SHIFT_COMEBACK", "SHIFT_DOMINANCE"],
    };

    for (const [leagueType, types] of Object.entries(ELIGIBLE_TYPES_BY_LEAGUE)) {
      await db.execute(sql`
        UPDATE broadcast_stories bs
        SET season_id = closed.id
        FROM (
          SELECT id FROM seasons
          WHERE league_type = ${leagueType} AND is_active = false
          ORDER BY end_date DESC NULLS LAST
          LIMIT 1
        ) closed
        WHERE bs.season_id IS NULL
          AND bs.league_type = ${leagueType}
          AND bs.story_type = ANY(${types}::text[])
          AND (SELECT COUNT(*) FROM seasons WHERE league_type = ${leagueType} AND is_active = false) = 1
      `);
    }

    logger.info("broadcast_stories.season_id backfill complete");
    return true;
  } catch (err) {
    logger.error({ err }, "Failed to backfill broadcast_stories.season_id");
    throw err;
  }
}
