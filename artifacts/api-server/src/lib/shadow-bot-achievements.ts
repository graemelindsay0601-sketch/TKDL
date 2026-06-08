import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

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
  criteriaType: "TOTAL_DARTS" | "TOTAL_SESSIONS" | "GAME_MODES" | "BOT_LEVEL" | "TOTAL_180S" | "CHECKOUT_HITS" | "TOTAL_SCORE";
  criteriaValue: number;
};

export function botLevelIndex(computedAvg: number): number {
  if (computedAvg >= 108) return 5;
  if (computedAvg >= 95)  return 4;
  if (computedAvg >= 80)  return 3;
  if (computedAvg >= 62)  return 2;
  if (computedAvg >= 45)  return 1;
  return 0;
}

export const SHADOW_BOT_ACHIEVEMENT_DEFS: ShadowBotAchievementDef[] = [
  // ── Volume — darts thrown ──────────────────────────────────────────────────
  { key: "BOT_BOOTS_UP",       name: "🤖 Boots Up",           description: "Throw your first dart in practice. The journey begins.",                        icon: "🤖", rarity: "Common",    criteriaType: "TOTAL_DARTS",    criteriaValue: 1       },
  { key: "BOT_100_DARTS",      name: "💯 100 Up",             description: "Throw 100 practice darts. Barely a warm-up.",                                   icon: "💯", rarity: "Common",    criteriaType: "TOTAL_DARTS",    criteriaValue: 100     },
  { key: "BOT_500_DARTS",      name: "🏋️ Training Hard",      description: "500 darts logged. Your bot is starting to learn.",                              icon: "🏋️", rarity: "Rare",      criteriaType: "TOTAL_DARTS",    criteriaValue: 500     },
  { key: "BOT_2K_DARTS",       name: "⚙️ Getting Serious",    description: "2,000 darts. The bot's patterns are forming.",                                  icon: "⚙️", rarity: "Rare",      criteriaType: "TOTAL_DARTS",    criteriaValue: 2000    },
  { key: "BOT_5K_DARTS",       name: "🧬 Data Rich",          description: "5,000 darts fed to the machine. Significant data.",                             icon: "🧬", rarity: "Epic",      criteriaType: "TOTAL_DARTS",    criteriaValue: 5000    },
  { key: "BOT_15K_DARTS",      name: "🔩 The Machine",        description: "15,000 darts. You practise like a professional.",                               icon: "🔩", rarity: "Legendary", criteriaType: "TOTAL_DARTS",    criteriaValue: 15000   },
  { key: "BOT_50K_DARTS",      name: "🔮 Oracle",             description: "50,000 darts. Your bot knows your game better than you do.",                    icon: "🔮", rarity: "Mythic",    criteriaType: "TOTAL_DARTS",    criteriaValue: 50000   },

  // ── Sessions ───────────────────────────────────────────────────────────────
  { key: "BOT_FIRST_SESSION",  name: "🟢 Online",             description: "Complete your first practice session.",                                         icon: "🟢", rarity: "Common",    criteriaType: "TOTAL_SESSIONS", criteriaValue: 1       },
  { key: "BOT_5_SESSIONS",     name: "☕ Warmed Up",           description: "5 sessions done. You're finding your rhythm.",                                  icon: "☕", rarity: "Common",    criteriaType: "TOTAL_SESSIONS", criteriaValue: 5       },
  { key: "BOT_20_SESSIONS",    name: "📅 Regular",             description: "20 sessions. You're a regular on the practice oche.",                          icon: "📅", rarity: "Rare",      criteriaType: "TOTAL_SESSIONS", criteriaValue: 20      },
  { key: "BOT_50_SESSIONS",    name: "💪 Dedicated",           description: "50 practice sessions. Seriously committed to your craft.",                     icon: "💪", rarity: "Epic",      criteriaType: "TOTAL_SESSIONS", criteriaValue: 50      },
  { key: "BOT_100_SESSIONS",   name: "👑 Practice Legend",     description: "100 sessions. A true student of the game.",                                    icon: "👑", rarity: "Legendary", criteriaType: "TOTAL_SESSIONS", criteriaValue: 100     },
  { key: "BOT_200_SESSIONS",   name: "🌀 No Life",             description: "200 practice sessions. The oche is your second home.",                         icon: "🌀", rarity: "Mythic",    criteriaType: "TOTAL_SESSIONS", criteriaValue: 200     },

  // ── Bot accuracy levels ────────────────────────────────────────────────────
  { key: "BOT_AMATEUR",        name: "🎯 Amateur Bot",         description: "Your bot now plays at Amateur level (avg 45+). It's learning.",                icon: "🎯", rarity: "Common",    criteriaType: "BOT_LEVEL",      criteriaValue: 1       },
  { key: "BOT_CLUB",           name: "🔵 Club Bot",            description: "Club Player accuracy unlocked (avg 62+). A proper challenge.",                 icon: "🔵", rarity: "Rare",      criteriaType: "BOT_LEVEL",      criteriaValue: 2       },
  { key: "BOT_COUNTY",         name: "🟣 County Bot",          description: "County standard reached (avg 80+). Most players can't beat this.",             icon: "🟣", rarity: "Epic",      criteriaType: "BOT_LEVEL",      criteriaValue: 3       },
  { key: "BOT_PRO",            name: "🟡 Pro Bot",             description: "Pro Tour accuracy (avg 95+). An elite training partner.",                      icon: "🟡", rarity: "Legendary", criteriaType: "BOT_LEVEL",      criteriaValue: 4       },
  { key: "BOT_ELITE",          name: "🔴 Elite Bot",           description: "Elite level reached (avg 108+). You've built a world-class shadow.",           icon: "🔴", rarity: "Mythic",    criteriaType: "BOT_LEVEL",      criteriaValue: 5       },

  // ── 180s ──────────────────────────────────────────────────────────────────
  { key: "BOT_FIRST_180",      name: "💥 MAXIMUM!",            description: "Hit your first 180 in practice. The crowd erupts.",                            icon: "💥", rarity: "Common",    criteriaType: "TOTAL_180S",     criteriaValue: 1       },
  { key: "BOT_TEN_180S",       name: "🔟 Ton Plus Club",       description: "10 maximums thrown. You're regularly scoring perfect visits.",                  icon: "🔟", rarity: "Rare",      criteriaType: "TOTAL_180S",     criteriaValue: 10      },
  { key: "BOT_50_180S",        name: "🏭 180 Machine",         description: "50 x 180s. Your treble-twenty scoring is elite.",                              icon: "🏭", rarity: "Epic",      criteriaType: "TOTAL_180S",     criteriaValue: 50      },
  { key: "BOT_100_180S",       name: "🌟 180 Legend",          description: "100 maximums. A century of perfection.",                                       icon: "🌟", rarity: "Legendary", criteriaType: "TOTAL_180S",     criteriaValue: 100     },
  { key: "BOT_500_180S",       name: "♾️ Maximum Maximum",     description: "500 x 180s in practice. Absolutely unprecedented.",                            icon: "♾️", rarity: "Mythic",    criteriaType: "TOTAL_180S",     criteriaValue: 500     },

  // ── Checkouts ─────────────────────────────────────────────────────────────
  { key: "BOT_FIRST_FINISH",   name: "✅ First Finish",         description: "Hit your first checkout in practice. Every champion starts here.",             icon: "✅", rarity: "Common",    criteriaType: "CHECKOUT_HITS",  criteriaValue: 1       },
  { key: "BOT_25_FINISHES",    name: "🎯 Clinical",             description: "25 checkouts hit. You know your way around the doubles.",                      icon: "🎯", rarity: "Rare",      criteriaType: "CHECKOUT_HITS",  criteriaValue: 25      },
  { key: "BOT_100_FINISHES",   name: "🖼️ Checkout Artist",      description: "100 checkouts. A genuine finishing threat.",                                   icon: "🖼️", rarity: "Epic",      criteriaType: "CHECKOUT_HITS",  criteriaValue: 100     },
  { key: "BOT_500_FINISHES",   name: "👑 Checkout King",        description: "500 checkouts landed. The double is your domain.",                             icon: "👑", rarity: "Legendary", criteriaType: "CHECKOUT_HITS",  criteriaValue: 500     },

  // ── Game variety ──────────────────────────────────────────────────────────
  { key: "BOT_VERSATILE",      name: "🎮 Versatile",            description: "Train your bot in 3 different game modes. Broaden your game.",                 icon: "🎮", rarity: "Common",    criteriaType: "GAME_MODES",     criteriaValue: 3       },
  { key: "BOT_ALL_ROUNDER",    name: "🌐 All-Rounder",          description: "7 game modes mastered. You don't have a weak format.",                        icon: "🌐", rarity: "Rare",      criteriaType: "GAME_MODES",     criteriaValue: 7       },
  { key: "BOT_POLYMATH",       name: "🧠 Polymath",             description: "12 different game modes. A genuine format expert.",                            icon: "🧠", rarity: "Epic",      criteriaType: "GAME_MODES",     criteriaValue: 12      },
  { key: "BOT_FORMAT_MASTER",  name: "⚡ Format Master",         description: "20 game modes in the training log. Unmatched versatility.",                   icon: "⚡", rarity: "Legendary", criteriaType: "GAME_MODES",     criteriaValue: 20      },

  // ── Total score ───────────────────────────────────────────────────────────
  { key: "BOT_10K_SCORE",      name: "💰 Point Scorer",         description: "10,000 total practice score. The numbers are adding up.",                     icon: "💰", rarity: "Common",    criteriaType: "TOTAL_SCORE",    criteriaValue: 10000   },
  { key: "BOT_100K_SCORE",     name: "💎 Six Figures",          description: "100,000 total practice score. An impressive milestone.",                      icon: "💎", rarity: "Rare",      criteriaType: "TOTAL_SCORE",    criteriaValue: 100000  },
  { key: "BOT_1M_SCORE",       name: "🏦 Millionaire",          description: "1,000,000 points scored in practice. Legendary dedication.",                  icon: "🏦", rarity: "Epic",      criteriaType: "TOTAL_SCORE",    criteriaValue: 1000000 },
  { key: "BOT_5M_SCORE",       name: "🚀 High Roller",          description: "5,000,000 practice score. Completely elite levels of work.",                  icon: "🚀", rarity: "Legendary", criteriaType: "TOTAL_SCORE",    criteriaValue: 5000000 },
  { key: "BOT_10M_SCORE",      name: "🌌 Billionaire Bot",      description: "10,000,000 total practice score. An incomprehensible amount of darts.",       icon: "🌌", rarity: "Mythic",    criteriaType: "TOTAL_SCORE",    criteriaValue: 10000000},
];

async function awardShadowBotAchievement(playerId: number, key: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO shadow_bot_achievements (player_id, achievement_key)
    VALUES (${playerId}, ${key})
    ON CONFLICT (player_id, achievement_key) DO NOTHING
  `);
  logger.info({ playerId, key }, "Shadow bot achievement awarded");
}

export async function checkAndAwardShadowBotAchievements(playerId: number): Promise<void> {
  try {
    const [statsQ, modesQ, existingQ] = await Promise.all([
      db.execute(sql`
        SELECT
          COALESCE(SUM(p1_darts), 0)::int            AS total_darts,
          COUNT(*)::int                               AS total_sessions,
          COALESCE(SUM(p1_score), 0)::bigint          AS total_score,
          COALESCE(SUM(p1_180s), 0)::int              AS total_180s,
          COALESCE(SUM(p1_checkout_hits), 0)::int     AS checkout_hits
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

    const s = statsQ.rows[0] as { total_darts: number; total_sessions: number; total_score: string | number; total_180s: number; checkout_hits: number };
    const totalDarts    = Number(s?.total_darts    ?? 0);
    const totalSessions = Number(s?.total_sessions ?? 0);
    const totalScore    = Number(s?.total_score    ?? 0);
    const total180s     = Number(s?.total_180s     ?? 0);
    const checkoutHits  = Number(s?.checkout_hits  ?? 0);
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
        case "TOTAL_180S":     met = total180s     >= def.criteriaValue; break;
        case "CHECKOUT_HITS":  met = checkoutHits  >= def.criteriaValue; break;
        case "TOTAL_SCORE":    met = totalScore    >= def.criteriaValue; break;
      }
      if (met) await awardShadowBotAchievement(playerId, def.key);
    }
  } catch (err) {
    logger.error({ err, playerId }, "checkAndAwardShadowBotAchievements failed");
  }
}

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
        COALESCE(SUM(p1_darts), 0)::int            AS total_darts,
        COUNT(*)::int                               AS total_sessions,
        COALESCE(SUM(p1_score), 0)::bigint          AS total_score,
        COALESCE(SUM(p1_180s), 0)::int              AS total_180s,
        COALESCE(SUM(p1_checkout_hits), 0)::int     AS checkout_hits
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

  const s = statsQ.rows[0] as { total_darts: number; total_sessions: number; total_score: string | number; total_180s: number; checkout_hits: number };
  const totalDarts    = Number(s?.total_darts    ?? 0);
  const totalSessions = Number(s?.total_sessions ?? 0);
  const totalScore    = Number(s?.total_score    ?? 0);
  const total180s     = Number(s?.total_180s     ?? 0);
  const checkoutHits  = Number(s?.checkout_hits  ?? 0);
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
      case "TOTAL_180S":     currentValue = total180s;     break;
      case "CHECKOUT_HITS":  currentValue = checkoutHits;  break;
      case "TOTAL_SCORE":    currentValue = totalScore;    break;
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
