import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import type { AchievementDef } from "./achievements";
import { grantIfNotHas } from "./achievement-grant";

// ─── Achievement definitions ──────────────────────────────────────────────────
//
// Grounded in what boss_battle_stats/boss_battle_progress actually track per
// boss: attempts, wins, best_seconds, and whether that boss is defeated. The
// ladder is 6 bosses long (BOSS_ORDER in routes/boss-battles.ts) and must be
// cleared in order, so "beat them all" is a real, reachable milestone here,
// not a 100+ grind like Master-501.
//
// coinReward only, no packReward — see board-curse-achievements.ts for why
// (packReward hands out real Card Clash pack_inventory rows, and Card Clash
// is benched). The 90-second "Speed Demon" threshold is an estimate, not
// measured from real fight durations yet — same caveat as Board Curse's
// visit thresholds, worth revisiting once there's real data.

export const BOSS_BATTLE_ACHIEVEMENT_DEFINITIONS: AchievementDef[] = [
  { key:"BOSS_FIRST_WIN",     name:"⚔️ First Blood",       description:"Defeat your first boss",                                   icon:"⚔️", rarity:"Common",    category:"Boss Battle", hidden:false, priority:20, criteriaType:"BOSS_DEFEATED_COUNT", criteriaValue:1,  engineType:"STAT_BASED", coinReward: 15 },
  { key:"BOSS_HALFWAY",       name:"🛡️ Halfway Up the Ladder", description:"Defeat 3 bosses on the ladder",                          icon:"🛡️", rarity:"Rare",      category:"Boss Battle", hidden:false, priority:35, criteriaType:"BOSS_DEFEATED_COUNT", criteriaValue:3,  engineType:"STAT_BASED", coinReward: 35 },
  { key:"BOSS_LADDER_CLEAR",  name:"👑 Ladder Conquered",   description:"Defeat every boss on the ladder",                          icon:"👑", rarity:"Epic",      category:"Boss Battle", hidden:false, priority:65, criteriaType:"BOSS_DEFEATED_COUNT", criteriaValue:6,  engineType:"STAT_BASED", coinReward: 75 },
  { key:"BOSS_FIRST_TRY",     name:"🎯 Flawless Victory",   description:"Defeat a boss on your very first attempt",                icon:"🎯", rarity:"Rare",      category:"Boss Battle", hidden:false, priority:38, criteriaType:"BOSS_FIRST_TRY",      criteriaValue:1,  engineType:"STAT_BASED", coinReward: 35 },
  { key:"BOSS_NEVER_GAVE_UP", name:"💪 Never Gave Up",      description:"Defeat a boss after 5 or more attempts against it",       icon:"💪", rarity:"Rare",      category:"Boss Battle", hidden:false, priority:36, criteriaType:"BOSS_PERSISTENCE",    criteriaValue:5,  engineType:"STAT_BASED", coinReward: 35 },
  { key:"BOSS_GRINDER_25",    name:"🎲 Getting Reps In",    description:"Rack up 25 total boss fight attempts",                    icon:"🎲", rarity:"Common",    category:"Boss Battle", hidden:false, priority:22, criteriaType:"BOSS_TOTAL_ATTEMPTS", criteriaValue:25, engineType:"STAT_BASED", coinReward: 15 },
  { key:"BOSS_GRINDER_75",    name:"🎲 Ladder Regular",     description:"Rack up 75 total boss fight attempts",                    icon:"🎲", rarity:"Rare",      category:"Boss Battle", hidden:true,  priority:40, criteriaType:"BOSS_TOTAL_ATTEMPTS", criteriaValue:75, engineType:"STAT_BASED", coinReward: 35 },
  { key:"BOSS_SPEED_DEMON",   name:"⚡ Speed Demon",        description:"Defeat any boss in under 90 seconds",                     icon:"⚡", rarity:"Epic",      category:"Boss Battle", hidden:true,  priority:62, criteriaType:"BOSS_BEST_SECONDS",   criteriaValue:90, engineType:"STAT_BASED", coinReward: 75 },
];

// ─── Main check + award function ─────────────────────────────────────────────
//
// Called after every fight is recorded (POST /boss-battles/attempt), win or
// loss — several of these (grind, persistence) can be earned off a loss.

export async function checkBossBattleAchievements(playerId: number): Promise<void> {
  try {
    const progressRows = await db.execute(sql`
      SELECT COUNT(*)::int AS defeated_count FROM boss_battle_progress WHERE player_id = ${playerId}
    `);
    const defeatedCount = Number((progressRows.rows[0] as any)?.defeated_count ?? 0);

    const statsRows = await db.execute(sql`
      SELECT attempts, wins, best_seconds FROM boss_battle_stats WHERE player_id = ${playerId}
    `);
    const stats = statsRows.rows as { attempts: number; wins: number; best_seconds: number | null }[];

    const totalAttempts = stats.reduce((sum, r) => sum + Number(r.attempts ?? 0), 0);
    const hasFirstTry   = stats.some(r => Number(r.attempts) === 1 && Number(r.wins) >= 1);
    const hasPersisted  = stats.some(r => Number(r.attempts) >= 5 && Number(r.wins) >= 1);
    const bestEver      = stats.reduce<number | null>((min, r) => {
      const s = r.best_seconds === null ? null : Number(r.best_seconds);
      if (s === null) return min;
      return min === null ? s : Math.min(min, s);
    }, null);

    if (defeatedCount >= 1) await grantIfNotHas(playerId, "BOSS_FIRST_WIN");
    if (defeatedCount >= 3) await grantIfNotHas(playerId, "BOSS_HALFWAY");
    if (defeatedCount >= 6) await grantIfNotHas(playerId, "BOSS_LADDER_CLEAR");
    if (hasFirstTry)        await grantIfNotHas(playerId, "BOSS_FIRST_TRY");
    if (hasPersisted)       await grantIfNotHas(playerId, "BOSS_NEVER_GAVE_UP");
    if (totalAttempts >= 25) await grantIfNotHas(playerId, "BOSS_GRINDER_25");
    if (totalAttempts >= 75) await grantIfNotHas(playerId, "BOSS_GRINDER_75");
    if (bestEver !== null && bestEver <= 90) await grantIfNotHas(playerId, "BOSS_SPEED_DEMON");
  } catch (err) {
    logger.error({ err, playerId }, "Failed to check Boss Battle achievements");
  }
}
