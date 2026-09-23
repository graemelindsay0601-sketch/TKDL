import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import type { AchievementDef } from "./achievements";
import { grantIfNotHas } from "./achievement-grant";

// ─── Achievement definitions ──────────────────────────────────────────────────
//
// Shift Wars matches carry no individual player attribution — only
// team_id vs team_id (see routes/shift-wars.ts) — points/wins/losses live on
// shift_wars_teams, not on any one player. So these are team achievements,
// granted to every player currently on the winning team's roster
// (players.shift_wars_team_id) at the moment the milestone is hit — the same
// "whoever's on the roster right now" approximation the existing
// sendShiftWarsMatchResultNotification already uses for push notifications,
// not something new invented for this.
//
// coinReward only, no packReward — see board-curse-achievements.ts.

export const SHIFT_WARS_ACHIEVEMENT_DEFINITIONS: AchievementDef[] = [
  { key:"SW_FIRST_WIN",    name:"🎯 Shift Change",     description:"Your department wins its first Shift Wars match",         icon:"🎯", rarity:"Common", category:"Shift Wars", hidden:false, priority:20, criteriaType:"SW_TEAM_WINS", criteriaValue:1,  engineType:"STAT_BASED", coinReward: 15 },
  { key:"SW_TEAM_WINS_10", name:"🏭 Department Regular", description:"Your department reaches 10 Shift Wars wins",              icon:"🏭", rarity:"Common", category:"Shift Wars", hidden:false, priority:22, criteriaType:"SW_TEAM_WINS", criteriaValue:10, engineType:"STAT_BASED", coinReward: 15 },
  { key:"SW_TEAM_WINS_25", name:"🏭 Department Force",   description:"Your department reaches 25 Shift Wars wins",              icon:"🏭", rarity:"Rare",   category:"Shift Wars", hidden:false, priority:35, criteriaType:"SW_TEAM_WINS", criteriaValue:25, engineType:"STAT_BASED", coinReward: 35 },
  { key:"SW_TEAM_WINS_50", name:"🏆 Department Dynasty", description:"Your department reaches 50 Shift Wars wins",              icon:"🏆", rarity:"Epic",   category:"Shift Wars", hidden:true,  priority:62, criteriaType:"SW_TEAM_WINS", criteriaValue:50, engineType:"STAT_BASED", coinReward: 75 },
  { key:"SW_HIGH_STAKES",  name:"💰 Big Shift Energy",   description:"Win a Shift Wars match with a stake of 20+ points",       icon:"💰", rarity:"Rare",   category:"Shift Wars", hidden:false, priority:36, criteriaType:"SW_HIGH_STAKE", criteriaValue:20, engineType:"MATCH_EVENT", coinReward: 35 },
  { key:"SW_TOP_TEAM",     name:"👑 Top of the Rota",    description:"Your department is in 1st place on the Shift Wars board", icon:"👑", rarity:"Epic",   category:"Shift Wars", hidden:false, priority:60, criteriaType:"SW_TOP_TEAM",  criteriaValue:1,  engineType:"STAT_BASED", coinReward: 75 },
  { key:"SW_RIVALRY_3",    name:"⚔️ Old Rivalry",        description:"Beat the same rival department 3 times",                  icon:"⚔️", rarity:"Rare",   category:"Shift Wars", hidden:false, priority:38, criteriaType:"SW_RIVAL_WINS", criteriaValue:3,  engineType:"STAT_BASED", coinReward: 35 },
];

// ─── Main check + award function ─────────────────────────────────────────────
//
// Called with the winning team's id right after a Shift Wars match is
// recorded. Reads the team's current standing back off the DB rather than
// trusting values computed in the request handler, then fans the grant out
// to every player presently assigned to that team.

export async function checkShiftWarsAchievements(winnerTeamId: number): Promise<void> {
  try {
    const teamRows = await db.execute(sql`
      SELECT id, points, wins FROM shift_wars_teams WHERE id = ${winnerTeamId}
    `);
    const team = teamRows.rows[0] as any;
    if (!team) return;
    const wins = Number(team.wins ?? 0);

    const isTopTeam = await db.execute(sql`
      SELECT 1 FROM shift_wars_teams
      WHERE points > (SELECT points FROM shift_wars_teams WHERE id = ${winnerTeamId})
      LIMIT 1
    `);
    const topTeam = isTopTeam.rows.length === 0;

    const highStakeWin = await db.execute(sql`
      SELECT 1 FROM shift_wars_matches
      WHERE winner_team_id = ${winnerTeamId} AND stake >= 20
      ORDER BY played_at DESC LIMIT 1
    `);
    const hadHighStake = highStakeWin.rows.length > 0;

    const rivalRows = await db.execute(sql`
      SELECT loser_team_id, COUNT(*)::int AS wins FROM shift_wars_matches
      WHERE winner_team_id = ${winnerTeamId}
      GROUP BY loser_team_id
      HAVING COUNT(*) >= 3
      LIMIT 1
    `);
    const hasRivalry3 = rivalRows.rows.length > 0;

    const rosterRows = await db.execute(sql`
      SELECT id FROM players WHERE shift_wars_team_id = ${winnerTeamId}
    `);
    const rosterIds = (rosterRows.rows as { id: number }[]).map(r => r.id);

    for (const playerId of rosterIds) {
      if (wins >= 1)  await grantIfNotHas(playerId, "SW_FIRST_WIN");
      if (wins >= 10) await grantIfNotHas(playerId, "SW_TEAM_WINS_10");
      if (wins >= 25) await grantIfNotHas(playerId, "SW_TEAM_WINS_25");
      if (wins >= 50) await grantIfNotHas(playerId, "SW_TEAM_WINS_50");
      if (hadHighStake) await grantIfNotHas(playerId, "SW_HIGH_STAKES");
      if (topTeam)       await grantIfNotHas(playerId, "SW_TOP_TEAM");
      if (hasRivalry3)   await grantIfNotHas(playerId, "SW_RIVALRY_3");
    }
  } catch (err) {
    logger.error({ err, winnerTeamId }, "Failed to check Shift Wars achievements");
  }
}
