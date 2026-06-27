/**
 * Complete achievement rewards mapping
 * Includes all achievements from all game modes
 */
export const ACHIEVEMENT_REWARDS: Record<
  string,
  { coinReward?: number; packReward?: "SINGLE" | "FIVE" | "TEN" }
> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // CARD CLASH ACHIEVEMENTS (25 total)
  // ═══════════════════════════════════════════════════════════════════════════
  CC_FIRST_MATCH: { coinReward: 50 },
  CC_FIRST_WIN: { coinReward: 100, packReward: "SINGLE" },
  CC_PACK_OPENER: { coinReward: 30 },
  CC_COLLECTOR_10: { coinReward: 75 },
  CC_COLLECTOR_25: { coinReward: 200, packReward: "SINGLE" },
  CC_COLLECTOR_50: { coinReward: 500, packReward: "FIVE" },
  CC_COLLECTOR_ALL: { coinReward: 2000, packReward: "TEN" },
  CC_LEGENDARY_CARD: { coinReward: 250, packReward: "SINGLE" },
  CC_WIN_5: { coinReward: 150 },
  CC_WIN_10: { coinReward: 300, packReward: "SINGLE" },
  CC_WIN_25: { coinReward: 750, packReward: "FIVE" },
  CC_WIN_50: { coinReward: 2000, packReward: "TEN" },
  CC_PACKS_5: { coinReward: 100 },
  CC_PACKS_10: { coinReward: 200, packReward: "SINGLE" },
  CC_PACKS_25: { coinReward: 500, packReward: "FIVE" },
  CC_STREAK_3: { coinReward: 75 },
  CC_STREAK_7: { coinReward: 200, packReward: "SINGLE" },
  CC_STREAK_30: { coinReward: 1000, packReward: "FIVE" },
  CC_COMEBACK_1: { coinReward: 100 },
  CC_COMEBACK_3: { coinReward: 250, packReward: "SINGLE" },
  CC_SPEED_PLAYER: { coinReward: 150 },
  CC_CARD_SYNERGY: { coinReward: 200, packReward: "SINGLE" },
  CC_PERFECT_HAND: { coinReward: 300, packReward: "FIVE" },
  CC_COIN_FLIP: { coinReward: 50 },
  CC_STREAK_CRUSHER: { coinReward: 400, packReward: "FIVE" },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRACTICE ACHIEVEMENTS (58 total) - Common/Rare/Epic tiers
  // ═══════════════════════════════════════════════════════════════════════════
  PRACTICE_TOTAL_180S_5: { coinReward: 15 },
  PRACTICE_TOTAL_180S_15: { coinReward: 35, packReward: "SINGLE" },
  PRACTICE_TOTAL_180S_30: { coinReward: 75, packReward: "SINGLE" },
  PRACTICE_TOTAL_180S_60: { coinReward: 150, packReward: "FIVE" },
  PRACTICE_TOTAL_180S_100: { coinReward: 300, packReward: "TEN" },
  PRACTICE_TRIPLE_180_GAME: { coinReward: 35, packReward: "SINGLE" },
  PRACTICE_100_PLUS_CHECKOUT_1: { coinReward: 15 },
  PRACTICE_100_PLUS_CHECKOUT_5: { coinReward: 35, packReward: "SINGLE" },
  PRACTICE_100_PLUS_CHECKOUT_10: { coinReward: 75, packReward: "SINGLE" },
  PRACTICE_ALL_CHECKOUTS_5: { coinReward: 15 },
  PRACTICE_ALL_CHECKOUTS_15: { coinReward: 35, packReward: "SINGLE" },
  PRACTICE_ALL_CHECKOUTS_30: { coinReward: 75, packReward: "SINGLE" },
  PRACTICE_ALL_CHECKOUTS_60: { coinReward: 150, packReward: "FIVE" },
  PRACTICE_ALL_CHECKOUTS_100: { coinReward: 300, packReward: "TEN" },
  PRACTICE_PERFECT_SESSION: { coinReward: 35, packReward: "SINGLE" },
  PRACTICE_ZERO_MISS_GAME: { coinReward: 75, packReward: "SINGLE" },
  PRACTICE_HIGH_FINISH_50: { coinReward: 15 },
  PRACTICE_HIGH_FINISH_100: { coinReward: 35, packReward: "SINGLE" },
  PRACTICE_HIGH_FINISH_150: { coinReward: 75, packReward: "SINGLE" },
  PRACTICE_BULL_FINISHES_5: { coinReward: 15 },
  PRACTICE_BULL_FINISHES_25: { coinReward: 35, packReward: "SINGLE" },
  PRACTICE_BULL_FINISHES_100: { coinReward: 150, packReward: "FIVE" },
  PRACTICE_ROUND_THE_CLOCK_1: { coinReward: 15 },
  PRACTICE_ROUND_THE_CLOCK_10: { coinReward: 35, packReward: "SINGLE" },
  PRACTICE_CRICKET_1: { coinReward: 15 },
  PRACTICE_CRICKET_10: { coinReward: 35, packReward: "SINGLE" },
  PRACTICE_SCRAM_1: { coinReward: 15 },
  PRACTICE_SCRAM_10: { coinReward: 35, packReward: "SINGLE" },
  PRACTICE_ATC_1: { coinReward: 15 },
  PRACTICE_ATC_10: { coinReward: 35, packReward: "SINGLE" },

  // ═══════════════════════════════════════════════════════════════════════════
  // MASTER 501 ACHIEVEMENTS (127 total)
  // ═══════════════════════════════════════════════════════════════════════════
  M501_FIRST_GAME: { coinReward: 15 },
  M501_TIER_2: { coinReward: 35, packReward: "SINGLE" },
  M501_TIER_3: { coinReward: 75, packReward: "SINGLE" },
  M501_TIER_4: { coinReward: 150, packReward: "FIVE" },
  M501_TIER_5: { coinReward: 300, packReward: "TEN" },
  M501_FIRST_180: { coinReward: 15 },
  M501_DOUBLE_180: { coinReward: 35, packReward: "SINGLE" },
  M501_TRIPLE_180: { coinReward: 75, packReward: "SINGLE" },
  M501_FIRST_FINISH: { coinReward: 15 },
  M501_EARLY_FINISH: { coinReward: 35, packReward: "SINGLE" },
  M501_QUICK_FINISH: { coinReward: 75, packReward: "SINGLE" },
  M501_FIRST_CHECKOUT_100: { coinReward: 15 },
  M501_CHECKOUTS_100_PLUS_5: { coinReward: 35, packReward: "SINGLE" },
  M501_CHECKOUTS_100_PLUS_25: { coinReward: 150, packReward: "FIVE" },

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMAT & MEME ACHIEVEMENTS (11+ total)
  // ═══════════════════════════════════════════════════════════════════════════
  SHANGHAI_20_WINS_3: { coinReward: 15 },
  SHANGHAI_20_WINS_5: { coinReward: 35, packReward: "SINGLE" },
  SHANGHAI_20_WINS_10: { coinReward: 75, packReward: "SINGLE" },
  ROUND_CLOCK_DOUBLES_WINS_3: { coinReward: 15 },
  ROUND_CLOCK_DOUBLES_WINS_5: { coinReward: 35, packReward: "SINGLE" },
  ROUND_CLOCK_DOUBLES_WINS_10: { coinReward: 75, packReward: "SINGLE" },
  AROUND_CLOCK_QUICK_WINS_3: { coinReward: 15 },
  AROUND_CLOCK_QUICK_WINS_5: { coinReward: 35, packReward: "SINGLE" },
  AROUND_CLOCK_QUICK_WINS_10: { coinReward: 75, packReward: "SINGLE" },
  HALVE_IT_WINS_3: { coinReward: 15 },
  HALVE_IT_WINS_5: { coinReward: 35, packReward: "SINGLE" },
  HALVE_IT_WINS_10: { coinReward: 75, packReward: "SINGLE" },

  // ═══════════════════════════════════════════════════════════════════════════
  // SHADOW BOT ACHIEVEMENTS (58 total)
  // ═══════════════════════════════════════════════════════════════════════════
  BOT_BOOTS_UP: { coinReward: 15 },
  BOT_180_2: { coinReward: 35, packReward: "SINGLE" },
  BOT_180_5: { coinReward: 75, packReward: "SINGLE" },
  BOT_180_7: { coinReward: 150, packReward: "FIVE" },
  BOT_100_DARTS: { coinReward: 15 },
  BOT_D_25: { coinReward: 15 },
  BOT_D_50: { coinReward: 35, packReward: "SINGLE" },
  BOT_D_100: { coinReward: 75, packReward: "SINGLE" },
  BOT_D_200: { coinReward: 150, packReward: "FIVE" },
  BOT_D_300: { coinReward: 300, packReward: "TEN" },
  BOT_ACC_5: { coinReward: 15 },
  BOT_ACC_10: { coinReward: 35, packReward: "SINGLE" },
  BOT_ACC_15: { coinReward: 75, packReward: "SINGLE" },
  BOT_ACC_20: { coinReward: 150, packReward: "FIVE" },
  BOT_FIRST_SESSION: { coinReward: 35, packReward: "SINGLE" },
  BOT_5_SESSIONS: { coinReward: 75, packReward: "SINGLE" },

  // ═══════════════════════════════════════════════════════════════════════════
  // CAREER/GENERAL ACHIEVEMENTS (50+)
  // ═══════════════════════════════════════════════════════════════════════════
  FIRST_BLOOD: { coinReward: 25 },
  WARMED_UP: { coinReward: 50, packReward: "SINGLE" },
  FIGHTER: { coinReward: 30 },
  DUELIST: { coinReward: 75, packReward: "SINGLE" },
  HEAT_CHECK: { coinReward: 40 },
  VETERAN: { coinReward: 100, packReward: "SINGLE" },
  HIGH_ROLLER: { coinReward: 75 },
  PAY_DAY: { coinReward: 50 },
  BULLSEYE: { coinReward: 100, packReward: "SINGLE" },
  ROCK_SOLID: { coinReward: 150, packReward: "FIVE" },
  RISK_TAKER: { coinReward: 75 },
  GAMBLER: { coinReward: 125, packReward: "SINGLE" },
  TACTICAL: { coinReward: 60 },
  PRECISION: { coinReward: 150, packReward: "FIVE" },
  TARGET_LOCKED: { coinReward: 100 },
  WIN_COLLECTOR: { coinReward: 200, packReward: "FIVE" },
  HISTORIAN: { coinReward: 125 },
  PROFESSIONAL: { coinReward: 150, packReward: "FIVE" },
  SHOWMAN: { coinReward: 125, packReward: "SINGLE" },
  COLLECTOR: { coinReward: 100 },
  RED_HOT: { coinReward: 150, packReward: "SINGLE" },
  DOUBLE_TROUBLE: { coinReward: 200, packReward: "FIVE" },
  ELO_1050: { coinReward: 250, packReward: "FIVE" },
  HOT_STREAK: { coinReward: 200, packReward: "FIVE" },
  ELIMINATOR: { coinReward: 150 },
  GIANT_KILLER: { coinReward: 250, packReward: "FIVE" },
  IRON_WALL: { coinReward: 300, packReward: "TEN" },
  PREDATOR: { coinReward: 200 },
  SHARPSHOOTER_ACH: { coinReward: 350, packReward: "TEN" },
  COMEBACK_KING: { coinReward: 200, packReward: "FIVE" },
  KING_SLAYER: { coinReward: 300, packReward: "TEN" },
  SHOCKWAVE: { coinReward: 250, packReward: "FIVE" },
  MARATHON: { coinReward: 0 },
  SNIPER: { coinReward: 0 },
  CONQUEROR: { coinReward: 0 },
  FORTRESS_KING: { coinReward: 0 },
  ASSASSIN: { coinReward: 0 },
  RIVAL_BREAKER: { coinReward: 0 },
  SURVIVOR_ACH: { coinReward: 0 },
  ELO_1200: { coinReward: 0 },
  BRONZE_BLOODED: { coinReward: 0 },
  SILVER_STANDARD: { coinReward: 0 },
  GOLDEN_ERA: { coinReward: 0 },
  CROWNED: { coinReward: 0 },
  MVP: { coinReward: 0 },
  INFERNO: { coinReward: 0 },
  IMMORTAL: { coinReward: 0 },
  DECORATED: { coinReward: 0 },
  SURVIVOR_ELITE: { coinReward: 0 },
  ELO_1300: { coinReward: 0 },
  BREAKTHROUGH: { coinReward: 0 },
  SUPERSTAR: { coinReward: 0 },
  DYNASTY: { coinReward: 0 },
  UNTOUCHABLE: { coinReward: 0 },
  ASCENDED: { coinReward: 0 },
  NIGHTMARE: { coinReward: 0 },
  WARPATH: { coinReward: 0 },
  APOCALYPSE: { coinReward: 0 },
  HALL_OF_FAME: { coinReward: 0 },
  LEGEND: { coinReward: 0 },
  UNTOUCHABLE_PLUS: { coinReward: 0 },
};

/**
 * Get reward data for an achievement
 */
export function getAchievementReward(
  achievementKey: string
): { coinReward?: number; packReward?: "SINGLE" | "FIVE" | "TEN" } {
  return ACHIEVEMENT_REWARDS[achievementKey] || {};
}

/**
 * Format pack reward to readable string
 */
export function formatPackReward(packReward?: "SINGLE" | "FIVE" | "TEN"): string {
  if (!packReward) return "None";
  if (packReward === "SINGLE") return "1 Pack";
  if (packReward === "FIVE") return "5-Pack";
  if (packReward === "TEN") return "10-Pack";
  return "Unknown";
}
