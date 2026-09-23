import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import type { AchievementDef } from "./achievements";
import { grantIfNotHas } from "./achievement-grant";

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

    for (const playerId of playerIds) {
      if (wins >= 1)  await grantIfNotHas(playerId, "DBL_FIRST_WIN");
      if (wins >= 10) await grantIfNotHas(playerId, "DBL_TEAM_WINS_10");
      if (wins >= 20) await grantIfNotHas(playerId, "DBL_TEAM_WINS_20");
      if (wins >= 35) await grantIfNotHas(playerId, "DBL_TEAM_WINS_35");
      if (eloChangeThisMatch >= 100) await grantIfNotHas(playerId, "DBL_BIG_SWING");
      if (stakeThisMatch >= 20)      await grantIfNotHas(playerId, "DBL_HIGH_STAKES");
      if (elo >= 1400)               await grantIfNotHas(playerId, "DBL_DIAMOND_TIER");
    }
  } catch (err) {
    logger.error({ err, winnerTeamId }, "Failed to check Doubles achievements");
  }
}
