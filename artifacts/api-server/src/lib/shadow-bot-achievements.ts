import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

// ── Gamerscore by rarity ──────────────────────────────────────────────────────
export function gamerscoreForRarity(rarity: string): number {
  switch (rarity) {
    case "Common":    return 10;
    case "Rare":      return 25;
    case "Epic":      return 50;
    case "Legendary": return 100;
    case "Mythic":    return 200;
    default:          return 10;
  }
}

export type ShadowBotAchievementDef = {
  key: string;
  name: string;
  description: string;
  icon: string;
  rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";
  criteriaType: "TOTAL_DARTS" | "TOTAL_SESSIONS" | "GAME_MODES" | "BOT_LEVEL";
  criteriaValue: number;
};

// ── Bot level index (0 = not activated, 1-5 = amateur→elite) ──────────────────
export function botLevelIndex(computedAvg: number): number {
  if (computedAvg >= 108) return 5; // elite
  if (computedAvg >= 95)  return 4; // pro
  if (computedAvg >= 80)  return 3; // county
  if (computedAvg >= 62)  return 2; // club
  if (computedAvg >= 45)  return 1; // amateur
  return 0;                          // beginner / not activated
}

export const SHADOW_BOT_ACHIEVEMENT_DEFS: ShadowBotAchievementDef[] = [
  // ── Training volume (darts thrown) ────────────────────────────────────────
  { key: "BOT_ACTIVATED",    name: "🤖 Bot Activated",     description: "Log 250 practice darts to unlock your Shadow Bot",  icon: "🤖", rarity: "Epic",      criteriaType: "TOTAL_DARTS",    criteriaValue: 250   },
  { key: "BOT_SIGNAL",       name: "📡 Signal Acquired",    description: "Log 500 practice darts",                            icon: "📡", rarity: "Rare",      criteriaType: "TOTAL_DARTS",    criteriaValue: 500   },
  { key: "BOT_CALIBRATING",  name: "⚙️ Calibrating",        description: "Log 1,000 practice darts",                         icon: "⚙️", rarity: "Epic",      criteriaType: "TOTAL_DARTS",    criteriaValue: 1000  },
  { key: "BOT_DATA_RICH",    name: "🧬 Data Rich",          description: "Log 2,500 practice darts",                         icon: "🧬", rarity: "Legendary", criteriaType: "TOTAL_DARTS",    criteriaValue: 2500  },
  { key: "BOT_ORACLE",       name: "🔮 Oracle",             description: "Log 5,000 practice darts",                         icon: "🔮", rarity: "Mythic",    criteriaType: "TOTAL_DARTS",    criteriaValue: 5000  },
  // ── Accuracy levels ────────────────────────────────────────────────────────
  { key: "BOT_AMATEUR",      name: "🟢 Amateur Bot",        description: "Reach Amateur accuracy (avg 45+)",                  icon: "🟢", rarity: "Common",    criteriaType: "BOT_LEVEL",      criteriaValue: 1     },
  { key: "BOT_CLUB",         name: "🔵 Club Bot",           description: "Reach Club Player accuracy (avg 62+)",              icon: "🔵", rarity: "Rare",      criteriaType: "BOT_LEVEL",      criteriaValue: 2     },
  { key: "BOT_COUNTY",       name: "🟣 County Bot",         description: "Reach County accuracy (avg 80+)",                  icon: "🟣", rarity: "Epic",      criteriaType: "BOT_LEVEL",      criteriaValue: 3     },
  { key: "BOT_PRO",          name: "🟡 Pro Bot",            description: "Reach Pro Tour accuracy (avg 95+)",                 icon: "🟡", rarity: "Legendary", criteriaType: "BOT_LEVEL",      criteriaValue: 4     },
  { key: "BOT_ELITE",        name: "🔴 Elite Bot",          description: "Reach Elite accuracy (avg 108+)",                   icon: "🔴", rarity: "Mythic",    criteriaType: "BOT_LEVEL",      criteriaValue: 5     },
  // ── Game mode breadth ──────────────────────────────────────────────────────
  { key: "BOT_VERSATILE",    name: "🎮 Versatile",          description: "Train your bot in 3+ different game modes",         icon: "🎮", rarity: "Common",    criteriaType: "GAME_MODES",     criteriaValue: 3     },
  { key: "BOT_ALL_ROUNDER",  name: "🌐 All-Rounder",        description: "Train your bot in 5+ different game modes",         icon: "🌐", rarity: "Rare",      criteriaType: "GAME_MODES",     criteriaValue: 5     },
  { key: "BOT_POLYMATH",     name: "🎯 Polymath",           description: "Train your bot in 8+ different game modes",         icon: "🎯", rarity: "Legendary", criteriaType: "GAME_MODES",     criteriaValue: 8     },
  // ── Session volume ─────────────────────────────────────────────────────────
  { key: "BOT_DEDICATED",    name: "💪 Dedicated",          description: "Complete 10 practice sessions",                     icon: "💪", rarity: "Common",    criteriaType: "TOTAL_SESSIONS", criteriaValue: 10    },
  { key: "BOT_COMMITTED",    name: "🏋️ Committed",          description: "Complete 25 practice sessions",                     icon: "🏋️", rarity: "Rare",      criteriaType: "TOTAL_SESSIONS", criteriaValue: 25    },
  { key: "BOT_OBSESSED",     name: "🔥 Obsessed",           description: "Complete 50 practice sessions",                     icon: "🔥", rarity: "Epic",      criteriaType: "TOTAL_SESSIONS", criteriaValue: 50    },
  { key: "BOT_LEGEND",       name: "👑 Practice Legend",    description: "Complete 100 practice sessions",                    icon: "👑", rarity: "Legendary", criteriaType: "TOTAL_SESSIONS", criteriaValue: 100   },
];

// ── Award function ─────────────────────────────────────────────────────────────
async function awardShadowBotAchievement(playerId: number, key: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO shadow_bot_achievements (player_id, achievement_key)
    VALUES (${playerId}, ${key})
    ON CONFLICT (player_id, achievement_key) DO NOTHING
  `);
  logger.info({ playerId, key }, "Shadow bot achievement awarded");
}

// ── Check and award for a player after each practice session ──────────────────
export async function checkAndAwardShadowBotAchievements(playerId: number): Promise<void> {
  try {
    const [statsQ, modesQ, existingQ] = await Promise.all([
      db.execute(sql`
        SELECT
          COALESCE(SUM(p1_darts), 0)::int  AS total_darts,
          COUNT(*)::int                     AS total_sessions,
          COALESCE(SUM(p1_score), 0)::int  AS total_score
        FROM practice_sessions WHERE player1_id = ${playerId}
      `),
      db.execute(sql`
        SELECT COUNT(DISTINCT game_type_key)::int AS game_modes
        FROM practice_sessions WHERE player1_id = ${playerId}
      `),
      db.execute(sql`
        SELECT achievement_key FROM shadow_bot_achievements WHERE player_id = ${playerId}
      `),
    ]);

    const s = statsQ.rows[0] as { total_darts: number; total_sessions: number; total_score: number };
    const totalDarts    = Number(s?.total_darts    ?? 0);
    const totalSessions = Number(s?.total_sessions ?? 0);
    const totalScore    = Number(s?.total_score    ?? 0);
    const gameModes     = Number((modesQ.rows[0] as { game_modes: number })?.game_modes ?? 0);
    const computedAvg   = totalDarts > 0 ? (totalScore / totalDarts) * 3 : 0;
    const levelIdx      = botLevelIndex(computedAvg);

    const already = new Set((existingQ.rows as { achievement_key: string }[]).map(r => r.achievement_key));

    for (const def of SHADOW_BOT_ACHIEVEMENT_DEFS) {
      if (already.has(def.key)) continue;
      let met = false;
      switch (def.criteriaType) {
        case "TOTAL_DARTS":    met = totalDarts    >= def.criteriaValue; break;
        case "TOTAL_SESSIONS": met = totalSessions >= def.criteriaValue; break;
        case "GAME_MODES":     met = gameModes     >= def.criteriaValue; break;
        case "BOT_LEVEL":      met = levelIdx      >= def.criteriaValue; break;
      }
      if (met) await awardShadowBotAchievement(playerId, def.key);
    }
  } catch (err) {
    logger.error({ err, playerId }, "checkAndAwardShadowBotAchievements failed");
  }
}

// ── Progress snapshot for a player (used by endpoint) ─────────────────────────
export type ShadowAchievementProgress = ShadowBotAchievementDef & {
  gamerscore: number;
  unlocked: boolean;
  unlockedAt: string | null;
  currentValue: number;
  progressPct: number;
};

export async function getShadowAchievementProgress(playerId: number): Promise<ShadowAchievementProgress[]> {
  const [statsQ, modesQ, existingQ] = await Promise.all([
    db.execute(sql`
      SELECT
        COALESCE(SUM(p1_darts), 0)::int  AS total_darts,
        COUNT(*)::int                     AS total_sessions,
        COALESCE(SUM(p1_score), 0)::int  AS total_score
      FROM practice_sessions WHERE player1_id = ${playerId}
    `),
    db.execute(sql`
      SELECT COUNT(DISTINCT game_type_key)::int AS game_modes
      FROM practice_sessions WHERE player1_id = ${playerId}
    `),
    db.execute(sql`
      SELECT achievement_key, unlocked_at FROM shadow_bot_achievements WHERE player_id = ${playerId}
    `),
  ]);

  const s = statsQ.rows[0] as { total_darts: number; total_sessions: number; total_score: number };
  const totalDarts    = Number(s?.total_darts    ?? 0);
  const totalSessions = Number(s?.total_sessions ?? 0);
  const totalScore    = Number(s?.total_score    ?? 0);
  const gameModes     = Number((modesQ.rows[0] as { game_modes: number })?.game_modes ?? 0);
  const computedAvg   = totalDarts > 0 ? (totalScore / totalDarts) * 3 : 0;
  const levelIdx      = botLevelIndex(computedAvg);

  const unlockedMap = new Map(
    (existingQ.rows as { achievement_key: string; unlocked_at: string }[])
      .map(r => [r.achievement_key, r.unlocked_at])
  );

  return SHADOW_BOT_ACHIEVEMENT_DEFS.map(def => {
    let currentValue = 0;
    switch (def.criteriaType) {
      case "TOTAL_DARTS":    currentValue = totalDarts;    break;
      case "TOTAL_SESSIONS": currentValue = totalSessions; break;
      case "GAME_MODES":     currentValue = gameModes;     break;
      case "BOT_LEVEL":      currentValue = levelIdx;      break;
    }
    const unlocked = unlockedMap.has(def.key);
    return {
      ...def,
      gamerscore: gamerscoreForRarity(def.rarity),
      unlocked,
      unlockedAt: unlockedMap.get(def.key) ?? null,
      currentValue,
      progressPct: Math.min(100, Math.round((currentValue / def.criteriaValue) * 100)),
    };
  });
}
