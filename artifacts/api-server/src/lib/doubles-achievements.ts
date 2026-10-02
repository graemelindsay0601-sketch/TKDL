import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import type { AchievementDef } from "./achievements";
import { grantIfNotHas } from "./achievement-grant";
import { doublesTeamResultAchievementKeys } from "./team-achievement-rules";

// ─── Achievement definitions ──────────────────────────────────────────────────
//
// Like Shift Wars, a Doubles match carries no individual attribution beyond
// the team — but here the "team" already IS the fixed 2-3 player partnership
// for the season (doubles_teams.player1Id/player2Id/player3Id), not a big
// department roster, so granting to every current team member is a much
// closer match to "the players who actually won this" than Shift Wars' case.
//
// Grounded in doubles_teams(wins, elo) and doubles_matches(elo_change,
// stake). The 100-Elo swing threshold isn't a guess — it reuses the exact
// value DETONATOR already uses for singles matches (see achievements.ts
// retroactiveSweep), and the Diamond-tier threshold reuses calcTier's real
// 1400 cutoff (lib/elo.ts) rather than inventing a new number.
//
// coinReward only, no packReward — see board-curse-achievements.ts.

export const DOUBLES_ACHIEVEMENT_DEFINITIONS: AchievementDef[] = [
  { key:"DBL_FIRST_WIN",    name:"🎯 Perfect Pair",       description:"Your Doubles team wins its first match",                  icon:"🎯", rarity:"Common", category:"Doubles", hidden:false, priority:20, criteriaType:"DBL_TEAM_WINS", criteriaValue:1,   engineType:"STAT_BASED", coinReward: 15 },
  { key:"DBL_TEAM_WINS_10", name:"🤝 Reliable Duo",       description:"Your Doubles team reaches 10 wins",                       icon:"🤝", rarity:"Common", category:"Doubles", hidden:false, priority:22, criteriaType:"DBL_TEAM_WINS", criteriaValue:10,  engineType:"STAT_BASED", coinReward: 15 },
  { key:"DBL_TEAM_WINS_20", name:"🤝 Dream Team",         description:"Your Doubles team reaches 20 wins",                       icon:"🤝", rarity:"Rare",   category:"Doubles", hidden:false, priority:35, criteriaType:"DBL_TEAM_WINS", criteriaValue:20,  engineType:"STAT_BASED", coinReward: 35 },
  { key:"DBL_TEAM_WINS_35", name:"🏆 Unbreakable Pair",   description:"Your Doubles team reaches 35 wins",                       icon:"🏆", rarity:"Epic",   category:"Doubles", hidden:true,  priority:62, criteriaType:"DBL_TEAM_WINS", criteriaValue:35,  engineType:"STAT_BASED", coinReward: 75 },
  { key:"DBL_BIG_SWING",    name:"💥 Detonator Duo",      description:"Win a Doubles match with a 100+ point Elo swing",         icon:"💥", rarity:"Rare",   category:"Doubles", hidden:false, priority:38, criteriaType:"DBL_ELO_SWING", criteriaValue:100, engineType:"MATCH_EVENT", coinReward: 35 },
  { key:"DBL_HIGH_STAKES",  name:"💰 High Rollers",       description:"Win a Doubles match with a stake of 20+ points",          icon:"💰", rarity:"Rare",   category:"Doubles", hidden:false, priority:36, criteriaType:"DBL_HIGH_STAKE", criteriaValue:20,  engineType:"MATCH_EVENT", coinReward: 35 },
  { key:"DBL_DIAMOND_TIER", name:"💎 Diamond Duo",        description:"Reach Diamond tier as a Doubles team",                    icon:"💎", rarity:"Epic",   category:"Doubles", hidden:false, priority:60, criteriaType:"DBL_TIER",       criteriaValue:1400, engineType:"STAT_BASED", coinReward: 75 },
  { key:"DBL_SOLO_OUTNUMBERED", name:"🛡 Lone Pairing",    description:"Your Doubles team wins while fielding one player against a combined side of at least two", icon:"🛡", rarity:"Epic", category:"Doubles", hidden:false, priority:64, criteriaType:"DBL_SOLO_OUTNUMBERED", criteriaValue:1, engineType:"MATCH_EVENT", coinReward:75 },
  { key:"DBL_MULTI_SURVIVOR",   name:"👑 Last Pair Standing", description:"Your Doubles team wins a match against at least two other pairings", icon:"👑", rarity:"Rare", category:"Doubles", hidden:false, priority:44, criteriaType:"DBL_MULTI_WIN", criteriaValue:1, engineType:"MATCH_EVENT", coinReward:35 },
  { key:"DBL_DEFENDING_CHAMP_WIN", name:"🏆 Crown Defenders", description:"The returning champion pair wins in the following Doubles season", icon:"🏆", rarity:"Epic", category:"Doubles", hidden:false, priority:66, criteriaType:"DBL_DEFENDING_CHAMP_WIN", criteriaValue:1, engineType:"MATCH_EVENT", coinReward:75 },
];

// ─── Main check + award function ─────────────────────────────────────────────
//
// Called right after a Doubles match is recorded, with the values the route
// already computed for that one match (no need to re-query them) plus the
// winning team's current wins/elo (read fresh, since those are what
// determine the milestone achievements).

export async function checkDoublesAchievements(
  playerIds: number[],
  winnerTeamId: number,
  eloChangeThisMatch: number,
  stakeThisMatch: number,
): Promise<void> {
  try {
    if (playerIds.length === 0) return;

    const teamRows = await db.execute(sql`
      SELECT wins, elo FROM doubles_teams WHERE id = ${winnerTeamId}
    `);
    const team = teamRows.rows[0] as any;
    if (!team) return;
    const wins = Number(team.wins ?? 0);
    const elo  = Number(team.elo ?? 0);

    // These are historical EXISTS checks, rather than assumptions about the
    // route that happened to call us. That keeps combined/multi result awards
    // correct when checks are retried and lets grantIfNotHas remain the one
    // race-safe, duplicate-proof award boundary.
    const resultFactRows = await db.execute(sql`
      SELECT
        EXISTS (
          SELECT 1
          FROM doubles_combined_matches m
          WHERE m.solo_team_id = ${winnerTeamId}
            AND m.solo_won = TRUE
            AND m.solo_fielded_count = 1
            AND (
              SELECT COALESCE(SUM(s.fielded_count), 0)
              FROM doubles_combined_match_sides s
              WHERE s.match_id = m.id
            ) >= 2
        ) AS won_solo_outnumbered,
        EXISTS (
          SELECT 1
          FROM doubles_multi_matches m
          WHERE m.winner_team_id = ${winnerTeamId}
            AND m.participant_count >= 3
        ) AS won_multi_team,
        EXISTS (
          WITH current_team AS (
            SELECT season_id, player1_id, player2_id, player3_id
            FROM doubles_teams
            WHERE id = ${winnerTeamId}
          ),
          previous_season AS (
            SELECT s.id
            FROM seasons s, current_team ct
            WHERE s.league_type = 'doubles'
              AND s.is_active = FALSE
              AND s.id <> ct.season_id
            ORDER BY s.end_date DESC NULLS LAST, s.id DESC
            LIMIT 1
          ),
          previous_champion AS (
            SELECT dt.player1_id, dt.player2_id, dt.player3_id
            FROM doubles_teams dt
            JOIN previous_season ps ON ps.id = dt.season_id
            ORDER BY dt.points DESC, dt.elo DESC, dt.id ASC
            LIMIT 1
          )
          SELECT 1
          FROM current_team ct, previous_champion pc
          WHERE ct.player3_id IS NULL
            AND pc.player3_id IS NULL
            AND (
              (ct.player1_id = pc.player1_id AND ct.player2_id = pc.player2_id)
              OR
              (ct.player1_id = pc.player2_id AND ct.player2_id = pc.player1_id)
            )
        ) AS won_as_defending_champions
    `);
    const facts = resultFactRows.rows[0] as {
      won_solo_outnumbered?: boolean;
      won_multi_team?: boolean;
      won_as_defending_champions?: boolean;
    } | undefined;
    const resultAchievementKeys = doublesTeamResultAchievementKeys({
      wonSoloOutnumbered: facts?.won_solo_outnumbered === true,
      wonMultiTeam: facts?.won_multi_team === true,
      wonAsDefendingChampions: wins >= 1 && facts?.won_as_defending_champions === true,
    });

    for (const playerId of playerIds) {
      if (wins >= 1)  await grantIfNotHas(playerId, "DBL_FIRST_WIN");
      if (wins >= 10) await grantIfNotHas(playerId, "DBL_TEAM_WINS_10");
      if (wins >= 20) await grantIfNotHas(playerId, "DBL_TEAM_WINS_20");
      if (wins >= 35) await grantIfNotHas(playerId, "DBL_TEAM_WINS_35");
      if (eloChangeThisMatch >= 100) await grantIfNotHas(playerId, "DBL_BIG_SWING");
      if (stakeThisMatch >= 20)      await grantIfNotHas(playerId, "DBL_HIGH_STAKES");
      if (elo >= 1400)               await grantIfNotHas(playerId, "DBL_DIAMOND_TIER");
      for (const key of resultAchievementKeys) await grantIfNotHas(playerId, key);
    }
  } catch (err) {
    logger.error({ err, winnerTeamId }, "Failed to check Doubles achievements");
  }
}
