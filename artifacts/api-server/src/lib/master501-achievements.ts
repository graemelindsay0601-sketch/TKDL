import { db } from "@workspace/db";
import { achievementsTable, playerAchievementsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import type { AchievementDef } from "./achievements";

// ─── Achievement definitions ──────────────────────────────────────────────────

export const MASTER501_ACHIEVEMENT_DEFINITIONS: AchievementDef[] = [
  // ── First steps ─────────────────────────────────────────────────────────────
  { key:"M501_FIRST_WIN",        name:"🎯 First Blood",          description:"Win your first Master-501 match",                      icon:"🎯", rarity:"Common",    category:"Master-501", hidden:false, priority:20, criteriaType:"M501_WINS",         criteriaValue:1,   engineType:"STAT_BASED" },
  { key:"M501_FIRST_180",        name:"💯 Triple Ton",           description:"Hit a 180 in a Master-501 match",                      icon:"💯", rarity:"Common",    category:"Master-501", hidden:false, priority:20, criteriaType:"M501_TOTAL_180S",   criteriaValue:1,   engineType:"STAT_BASED" },
  { key:"M501_FIRST_CO",         name:"✅ First Finish",          description:"Land your first checkout in a Master-501 match",       icon:"✅", rarity:"Common",    category:"Master-501", hidden:false, priority:20, criteriaType:"M501_TOTAL_CO",     criteriaValue:1,   engineType:"STAT_BASED" },
  { key:"M501_TEN_RUNS",         name:"📋 Getting Going",        description:"Complete 10 Master-501 runs",                          icon:"📋", rarity:"Common",    category:"Master-501", hidden:false, priority:20, criteriaType:"M501_TOTAL_RUNS",   criteriaValue:10,  engineType:"STAT_BASED" },

  // ── Tier progression ─────────────────────────────────────────────────────────
  { key:"M501_CHALLENGER_CLEAR", name:"🥈 Challenger Cleared",   description:"Beat the Challenger Tier — clear all 3 rounds",        icon:"🥈", rarity:"Rare",      category:"Master-501", hidden:false, priority:40, criteriaType:"M501_TIER_CLEAR",  criteriaValue:1,   engineType:"STAT_BASED" },
  { key:"M501_PRO_CLEAR",        name:"🥇 Circuit Pro",          description:"Beat the Pro Circuit Tier — clear all 3 rounds",       icon:"🥇", rarity:"Rare",      category:"Master-501", hidden:false, priority:45, criteriaType:"M501_TIER_CLEAR",  criteriaValue:2,   engineType:"STAT_BASED" },
  { key:"M501_PREMIER_CLEAR",    name:"💎 Premier Class",        description:"Beat the Premier Tier — clear all 3 rounds",           icon:"💎", rarity:"Epic",      category:"Master-501", hidden:false, priority:60, criteriaType:"M501_TIER_CLEAR",  criteriaValue:3,   engineType:"STAT_BASED" },
  { key:"M501_GRAND_PRIX_CLEAR", name:"🏁 Grand Prix Winner",    description:"Beat the Grand Prix Tier — clear all 3 rounds",        icon:"🏁", rarity:"Epic",      category:"Master-501", hidden:false, priority:65, criteriaType:"M501_TIER_CLEAR",  criteriaValue:4,   engineType:"STAT_BASED" },
  { key:"M501_WORLD_CHAMP",      name:"👑 World Champion",       description:"Conquer the World Championship — complete the full ladder", icon:"👑", rarity:"Legendary", category:"Master-501", hidden:false, priority:90, criteriaType:"M501_TIER_CLEAR", criteriaValue:5, engineType:"STAT_BASED" },

  // ── Win streaks ───────────────────────────────────────────────────────────────
  { key:"M501_HEAT",             name:"🔥 On Heat",              description:"Win 3 consecutive Master-501 matches",                  icon:"🔥", rarity:"Rare",      category:"Master-501", hidden:false, priority:40, criteriaType:"M501_STREAK",      criteriaValue:3,   engineType:"STAT_BASED" },
  { key:"M501_ON_FIRE",          name:"⚡ Electric",             description:"Win 5 consecutive Master-501 matches",                  icon:"⚡", rarity:"Epic",      category:"Master-501", hidden:false, priority:60, criteriaType:"M501_STREAK",      criteriaValue:5,   engineType:"STAT_BASED" },
  { key:"M501_UNSTOPPABLE",      name:"🌪️ Unstoppable",          description:"Win 10 consecutive Master-501 matches",                 icon:"🌪️", rarity:"Legendary", category:"Master-501", hidden:true,  priority:85, criteriaType:"M501_STREAK",      criteriaValue:10,  engineType:"STAT_BASED" },

  // ── Perfect sets ─────────────────────────────────────────────────────────────
  { key:"M501_FLAWLESS_5",       name:"🛡️ Clean Sweep",          description:"Win a Best-of-5 without dropping a single leg",         icon:"🛡️", rarity:"Rare",      category:"Master-501", hidden:false, priority:40, criteriaType:"M501_FLAWLESS_5",  criteriaValue:1,   engineType:"STAT_BASED" },
  { key:"M501_GRAND_SLAM",       name:"🌟 Grand Slam",           description:"Win a Best-of-11 without dropping a leg",               icon:"🌟", rarity:"Legendary", category:"Master-501", hidden:true,  priority:88, criteriaType:"M501_GRAND_SLAM",  criteriaValue:1,   engineType:"STAT_BASED" },

  // ── Drama ─────────────────────────────────────────────────────────────────────
  { key:"M501_LAST_GASP",        name:"😤 Last Gasp",            description:"Win a match that goes to the very last deciding leg",   icon:"😤", rarity:"Rare",      category:"Master-501", hidden:false, priority:35, criteriaType:"M501_LAST_GASP",   criteriaValue:1,   engineType:"STAT_BASED" },
  { key:"M501_MARATHON_3",       name:"💪 Marathon Man",         description:"Win 3 matches that go to the final deciding leg",       icon:"💪", rarity:"Epic",      category:"Master-501", hidden:false, priority:55, criteriaType:"M501_LAST_GASP",   criteriaValue:3,   engineType:"STAT_BASED" },

  // ── Scoring — 180s ────────────────────────────────────────────────────────────
  { key:"M501_180_FIVE",         name:"🎯 Ton-80 Collector",     description:"Hit 5 total 180s across Master-501 matches",            icon:"🎯", rarity:"Rare",      category:"Master-501", hidden:false, priority:40, criteriaType:"M501_TOTAL_180S",  criteriaValue:5,   engineType:"STAT_BASED" },
  { key:"M501_180_TWENTY",       name:"🔥 Maximum Machine",      description:"Hit 20 total 180s across Master-501 matches",           icon:"🔥", rarity:"Epic",      category:"Master-501", hidden:false, priority:60, criteriaType:"M501_TOTAL_180S",  criteriaValue:20,  engineType:"STAT_BASED" },
  { key:"M501_180_FIFTY",        name:"👑 Maximum Legend",       description:"Hit 50 total 180s across Master-501 matches",           icon:"👑", rarity:"Legendary", category:"Master-501", hidden:true,  priority:87, criteriaType:"M501_TOTAL_180S",  criteriaValue:50,  engineType:"STAT_BASED" },

  // ── Scoring — averages ────────────────────────────────────────────────────────
  { key:"M501_AVG_80",           name:"📊 Solid Average",        description:"Post a 3-dart average of 80+ in a Master-501 match",    icon:"📊", rarity:"Rare",      category:"Master-501", hidden:false, priority:40, criteriaType:"M501_BEST_AVG",    criteriaValue:80,  engineType:"STAT_BASED" },
  { key:"M501_AVG_90",           name:"📈 Quality Player",       description:"Post a 3-dart average of 90+ in a Master-501 match",    icon:"📈", rarity:"Epic",      category:"Master-501", hidden:false, priority:60, criteriaType:"M501_BEST_AVG",    criteriaValue:90,  engineType:"STAT_BASED" },
  { key:"M501_AVG_100",          name:"💯 Century Average",      description:"Post a 3-dart average of 100+ in a Master-501 match",   icon:"💯", rarity:"Legendary", category:"Master-501", hidden:false, priority:85, criteriaType:"M501_BEST_AVG",    criteriaValue:100, engineType:"STAT_BASED" },

  // ── Checkout ─────────────────────────────────────────────────────────────────
  { key:"M501_CO_TEN",           name:"🎯 Sharp Finisher",       description:"Land 10 checkouts across Master-501 matches",           icon:"🎯", rarity:"Rare",      category:"Master-501", hidden:false, priority:40, criteriaType:"M501_TOTAL_CO",    criteriaValue:10,  engineType:"STAT_BASED" },
  { key:"M501_CO_RATE",          name:"🏹 Precision Finisher",   description:"Hit 50%+ checkout rate over 10+ attempts in Master-501",icon:"🏹", rarity:"Epic",      category:"Master-501", hidden:false, priority:60, criteriaType:"M501_CO_RATE_50",  criteriaValue:10,  engineType:"STAT_BASED" },

  // ── Volume ────────────────────────────────────────────────────────────────────
  { key:"M501_FIFTY_RUNS",       name:"🎲 Grinder",              description:"Complete 50 Master-501 runs",                           icon:"🎲", rarity:"Rare",      category:"Master-501", hidden:false, priority:40, criteriaType:"M501_TOTAL_RUNS",  criteriaValue:50,  engineType:"STAT_BASED" },
  { key:"M501_CENTURY_RUNS",     name:"💯 Centurion",            description:"Complete 100 Master-501 runs",                          icon:"💯", rarity:"Epic",      category:"Master-501", hidden:true,  priority:75, criteriaType:"M501_TOTAL_RUNS",  criteriaValue:100, engineType:"STAT_BASED" },
];

// ─── Grant helper (same pattern as practice-achievements.ts) ─────────────────

async function grantIfNotHas(playerId: number, key: string): Promise<boolean> {
  const [ach] = await db.select().from(achievementsTable).where(eq(achievementsTable.key, key));
  if (!ach) return false;
  const [existing] = await db.select({ id: playerAchievementsTable.id })
    .from(playerAchievementsTable)
    .where(and(
      eq(playerAchievementsTable.playerId, playerId),
      eq(playerAchievementsTable.achievementId, ach.id),
    ));
  if (existing) return false;
  await db.insert(playerAchievementsTable).values({ playerId, achievementId: ach.id });
  logger.info({ playerId, key }, "[M501] Achievement unlocked");
  return true;
}

// ─── Check context ────────────────────────────────────────────────────────────

export interface M501RunContext {
  tier: number;
  round: number;
  result: "win" | "loss";
  legsWon: number;
  legsLost: number;
  legsFormat: number;
}

// ─── Main check + award function ─────────────────────────────────────────────

export async function checkM501Achievements(
  playerId: number,
  ctx: M501RunContext,
): Promise<void> {
  try {
    const { tier, round, result, legsWon, legsLost, legsFormat } = ctx;

    // ── 1. Run-based counts ──────────────────────────────────────────────────
    const runsRow = await db.execute(sql`
      SELECT
        COUNT(*)                                           AS total_runs,
        COUNT(CASE WHEN result = 'win' THEN 1 END)        AS total_wins,
        COUNT(CASE WHEN result = 'loss' THEN 1 END)       AS total_losses
      FROM master501_runs
      WHERE player_id = ${playerId} AND result IS NOT NULL
    `);
    const runs      = (runsRow.rows[0] as any);
    const totalRuns = Number(runs?.total_runs ?? 0);
    const totalWins = Number(runs?.total_wins ?? 0);

    // ── 2. Recent streak ────────────────────────────────────────────────────
    const streakRows = await db.execute(sql`
      SELECT result FROM master501_runs
      WHERE player_id = ${playerId} AND result IS NOT NULL
      ORDER BY completed_at DESC LIMIT 10
    `);
    const recent = (streakRows.rows as any[]).map(r => r.result as string);
    let streak = 0;
    for (const r of recent) {
      if (r === "win") streak++;
      else break;
    }

    // ── 3. Flawless & last-gasp counts ──────────────────────────────────────
    const specialRows = await db.execute(sql`
      SELECT
        COUNT(CASE WHEN result = 'win' AND legs_lost = 0 AND legs_format = 5  THEN 1 END) AS flawless5,
        COUNT(CASE WHEN result = 'win' AND legs_lost = 0 AND legs_format = 11 THEN 1 END) AS grand_slam,
        COUNT(CASE WHEN result = 'win' AND (legs_won + legs_lost) = legs_format AND legs_lost > 0 THEN 1 END) AS last_gasp
      FROM master501_runs
      WHERE player_id = ${playerId} AND result IS NOT NULL
    `);
    const sp         = (specialRows.rows[0] as any);
    const flawless5  = Number(sp?.flawless5  ?? 0);
    const grandSlam  = Number(sp?.grand_slam ?? 0);
    const lastGasp   = Number(sp?.last_gasp  ?? 0);

    // ── 4. Tier-clear: was this the winning Round 3 for a tier? ─────────────
    // We check how many tier-3 wins exist per tier up to current tiers
    const tierClearRows = await db.execute(sql`
      SELECT tier, COUNT(*) AS wins
      FROM master501_runs
      WHERE player_id = ${playerId} AND result = 'win' AND round = 3
      GROUP BY tier
    `);
    const clearedTiers = new Set(
      (tierClearRows.rows as any[]).map(r => Number(r.tier)),
    );

    // ── 5. Practice session stats (M501 sessions) ────────────────────────────
    const sessRow = await db.execute(sql`
      SELECT
        COALESCE(SUM(p1_180s),             0) AS total_180s,
        COALESCE(MAX(CASE WHEN p1_darts > 0 THEN (p1_score::float / p1_darts) * 3.0 END), 0) AS best_avg,
        COALESCE(SUM(p1_checkout_hits),    0) AS co_hits,
        COALESCE(SUM(p1_checkout_attempts),0) AS co_attempts
      FROM practice_sessions
      WHERE player1_id = ${playerId}
        AND session_data->>'mode' = 'master501'
    `);
    const sess       = (sessRow.rows[0] as any);
    const total180s  = Number(sess?.total_180s  ?? 0);
    const bestAvg    = Number(sess?.best_avg    ?? 0);
    const coHits     = Number(sess?.co_hits     ?? 0);
    const coAttempts = Number(sess?.co_attempts ?? 0);
    const coRate     = coAttempts >= 10 ? (coHits / coAttempts) : 0;

    // ── Grant ────────────────────────────────────────────────────────────────

    // Volume
    if (totalRuns >=   10) await grantIfNotHas(playerId, "M501_TEN_RUNS");
    if (totalRuns >=   50) await grantIfNotHas(playerId, "M501_FIFTY_RUNS");
    if (totalRuns >=  100) await grantIfNotHas(playerId, "M501_CENTURY_RUNS");

    if (result === "win") {
      // First win
      if (totalWins >= 1) await grantIfNotHas(playerId, "M501_FIRST_WIN");

      // Tier clears
      if (clearedTiers.has(1)) await grantIfNotHas(playerId, "M501_CHALLENGER_CLEAR");
      if (clearedTiers.has(2)) await grantIfNotHas(playerId, "M501_PRO_CLEAR");
      if (clearedTiers.has(3)) await grantIfNotHas(playerId, "M501_PREMIER_CLEAR");
      if (clearedTiers.has(4)) await grantIfNotHas(playerId, "M501_GRAND_PRIX_CLEAR");
      if (clearedTiers.has(5)) await grantIfNotHas(playerId, "M501_WORLD_CHAMP");

      // Streaks
      if (streak >= 3)  await grantIfNotHas(playerId, "M501_HEAT");
      if (streak >= 5)  await grantIfNotHas(playerId, "M501_ON_FIRE");
      if (streak >= 10) await grantIfNotHas(playerId, "M501_UNSTOPPABLE");

      // Flawless
      if (legsLost === 0 && legsFormat === 5)  await grantIfNotHas(playerId, "M501_FLAWLESS_5");
      if (legsLost === 0 && legsFormat === 11) await grantIfNotHas(playerId, "M501_GRAND_SLAM");
      if (flawless5 >= 1) await grantIfNotHas(playerId, "M501_FLAWLESS_5");
      if (grandSlam >= 1) await grantIfNotHas(playerId, "M501_GRAND_SLAM");

      // Last gasp (all legs played AND player won)
      const allLegsPlayed = legsWon + legsLost === legsFormat && legsLost > 0;
      if (allLegsPlayed)      await grantIfNotHas(playerId, "M501_LAST_GASP");
      if (lastGasp >= 3)      await grantIfNotHas(playerId, "M501_MARATHON_3");
    }

    // Scoring (from session stats — awarded on any run completion)
    if (total180s >= 1)  await grantIfNotHas(playerId, "M501_FIRST_180");
    if (total180s >= 5)  await grantIfNotHas(playerId, "M501_180_FIVE");
    if (total180s >= 20) await grantIfNotHas(playerId, "M501_180_TWENTY");
    if (total180s >= 50) await grantIfNotHas(playerId, "M501_180_FIFTY");

    if (bestAvg >= 80)  await grantIfNotHas(playerId, "M501_AVG_80");
    if (bestAvg >= 90)  await grantIfNotHas(playerId, "M501_AVG_90");
    if (bestAvg >= 100) await grantIfNotHas(playerId, "M501_AVG_100");

    if (coHits >= 1)    await grantIfNotHas(playerId, "M501_FIRST_CO");
    if (coHits >= 10)   await grantIfNotHas(playerId, "M501_CO_TEN");
    if (coRate >= 0.50) await grantIfNotHas(playerId, "M501_CO_RATE");

  } catch (err) {
    logger.error({ err, playerId }, "[M501] Achievement check failed");
  }
}
