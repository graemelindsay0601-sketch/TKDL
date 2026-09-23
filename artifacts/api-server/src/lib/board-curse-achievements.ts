import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import type { AchievementDef } from "./achievements";
import { grantIfNotHas } from "./achievement-grant";

// ─── Achievement definitions ──────────────────────────────────────────────────
//
// Board Curse only tracks a thin set of aggregates per player — best_visits
// (personal-best fewest visits to clear, lower is better), best_streak
// (personal-best Endless run, higher is better), and wins/losses split by
// format (bot/local) — there's no per-game log to build richer criteria on.
// Every achievement below is grounded in exactly those columns.
//
// coinReward only, no packReward — packs are real Card Clash pack_inventory
// rows (see achievement-grant.ts), and Card Clash is currently benched, so
// nothing here should hand out Card Clash inventory. Coin amounts follow the
// existing Common/Rare/Epic/Legendary scale used elsewhere (15/35/75/150).
// The best_visits thresholds (15 / 12) are estimates, not measured from real
// play data yet — worth revisiting once there's a decent sample of scores.

export const BOARD_CURSE_ACHIEVEMENT_DEFINITIONS: AchievementDef[] = [
  { key:"BC_FIRST_WIN",   name:"🎯 Curse Broken",     description:"Win your first Board Curse match",                       icon:"🎯", rarity:"Common",    category:"Board Curse", hidden:false, priority:20, criteriaType:"BC_WINS",        criteriaValue:1,  engineType:"STAT_BASED", coinReward: 15 },
  { key:"BC_WINS_10",     name:"🩹 Getting Steady",   description:"Win 10 Board Curse matches",                              icon:"🩹", rarity:"Common",    category:"Board Curse", hidden:false, priority:21, criteriaType:"BC_WINS",        criteriaValue:10, engineType:"STAT_BASED", coinReward: 15 },
  { key:"BC_WINS_25",     name:"🩹 Curse Slayer",     description:"Win 25 Board Curse matches",                              icon:"🩹", rarity:"Rare",      category:"Board Curse", hidden:false, priority:35, criteriaType:"BC_WINS",        criteriaValue:25, engineType:"STAT_BASED", coinReward: 35 },
  { key:"BC_WINS_50",     name:"💀 Curse Breaker",    description:"Win 50 Board Curse matches",                              icon:"💀", rarity:"Epic",      category:"Board Curse", hidden:true,  priority:60, criteriaType:"BC_WINS",        criteriaValue:50, engineType:"STAT_BASED", coinReward: 75 },
  { key:"BC_BOTH_FORMATS",name:"⚔️ All-Rounder",      description:"Beat both a Bot and a Local opponent in Board Curse",     icon:"⚔️", rarity:"Common",    category:"Board Curse", hidden:false, priority:22, criteriaType:"BC_BOTH_FORMATS",criteriaValue:1,  engineType:"STAT_BASED", coinReward: 15 },
  { key:"BC_STREAK_10",   name:"🔥 Ten Alive",        description:"Reach a 10-run Endless streak in Board Curse",            icon:"🔥", rarity:"Rare",      category:"Board Curse", hidden:false, priority:35, criteriaType:"BC_STREAK",      criteriaValue:10, engineType:"STAT_BASED", coinReward: 35 },
  { key:"BC_STREAK_25",   name:"🔥 Unshakeable",      description:"Reach a 25-run Endless streak in Board Curse",            icon:"🔥", rarity:"Epic",      category:"Board Curse", hidden:false, priority:60, criteriaType:"BC_STREAK",      criteriaValue:25, engineType:"STAT_BASED", coinReward: 75 },
  { key:"BC_STREAK_50",   name:"👑 Immortal Streak",  description:"Reach a 50-run Endless streak in Board Curse",            icon:"👑", rarity:"Legendary", category:"Board Curse", hidden:true,  priority:85, criteriaType:"BC_STREAK",      criteriaValue:50, engineType:"STAT_BASED", coinReward: 150 },
  { key:"BC_EFFICIENT",   name:"🎯 Efficient Clear",  description:"Clear a board in 15 visits or fewer",                     icon:"🎯", rarity:"Rare",      category:"Board Curse", hidden:false, priority:38, criteriaType:"BC_VISITS",      criteriaValue:15, engineType:"STAT_BASED", coinReward: 35 },
  { key:"BC_RUTHLESS",    name:"🩸 Ruthless Clear",   description:"Clear a board in 12 visits or fewer",                     icon:"🩸", rarity:"Epic",      category:"Board Curse", hidden:true,  priority:62, criteriaType:"BC_VISITS",      criteriaValue:12, engineType:"STAT_BASED", coinReward: 75 },
];

// ─── Main check + award function ─────────────────────────────────────────────
//
// Called after either board-curse write route (POST /board-curse/best and
// POST /board-curse/record both feed this) since either one can move a
// player past a new milestone. Reads the current aggregates straight back
// off the two tables rather than trusting the just-written request body, so
// it's correct regardless of which route triggered the check.

export async function checkBoardCurseAchievements(playerId: number): Promise<void> {
  try {
    const bestRows = await db.execute(sql`
      SELECT
        MIN(best_visits) FILTER (WHERE best_visits IS NOT NULL) AS min_visits,
        MAX(best_streak) FILTER (WHERE best_streak IS NOT NULL) AS max_streak
      FROM board_curse_best WHERE player_id = ${playerId}
    `);
    const best       = bestRows.rows[0] as any;
    const minVisits  = best?.min_visits !== null && best?.min_visits !== undefined ? Number(best.min_visits) : null;
    const maxStreak  = best?.max_streak !== null && best?.max_streak !== undefined ? Number(best.max_streak) : null;

    const recordRows = await db.execute(sql`
      SELECT format, wins FROM board_curse_records WHERE player_id = ${playerId}
    `);
    const records   = recordRows.rows as { format: string; wins: number }[];
    const totalWins = records.reduce((sum, r) => sum + Number(r.wins ?? 0), 0);
    const wonBot    = records.some(r => r.format === "bot"   && Number(r.wins ?? 0) > 0);
    const wonLocal  = records.some(r => r.format === "local" && Number(r.wins ?? 0) > 0);

    if (totalWins >= 1)  await grantIfNotHas(playerId, "BC_FIRST_WIN");
    if (totalWins >= 10) await grantIfNotHas(playerId, "BC_WINS_10");
    if (totalWins >= 25) await grantIfNotHas(playerId, "BC_WINS_25");
    if (totalWins >= 50) await grantIfNotHas(playerId, "BC_WINS_50");
    if (wonBot && wonLocal) await grantIfNotHas(playerId, "BC_BOTH_FORMATS");

    if (maxStreak !== null) {
      if (maxStreak >= 10) await grantIfNotHas(playerId, "BC_STREAK_10");
      if (maxStreak >= 25) await grantIfNotHas(playerId, "BC_STREAK_25");
      if (maxStreak >= 50) await grantIfNotHas(playerId, "BC_STREAK_50");
    }
    if (minVisits !== null) {
      if (minVisits <= 15) await grantIfNotHas(playerId, "BC_EFFICIENT");
      if (minVisits <= 12) await grantIfNotHas(playerId, "BC_RUTHLESS");
    }
  } catch (err) {
    logger.error({ err, playerId }, "Failed to check Board Curse achievements");
  }
}
