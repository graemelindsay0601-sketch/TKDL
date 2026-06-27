/**
 * Achievement Rewards System
 * Defines coin and pack rewards for each achievement
 */

export type AchievementReward = {
  coinReward?: number;
  packReward?: 'SINGLE' | 'FIVE' | 'TEN';
};

/**
 * Maps achievement keys to their rewards
 * Default rewards based on rarity:
 * - Common: 25-50 coins
 * - Rare: 75-150 coins + occasional packs
 * - Epic: 150-300 coins + packs
 * - Legendary: 500+ coins + TEN packs
 */
export const ACHIEVEMENT_REWARDS: Record<string, AchievementReward> = {
  // === CAREER ACHIEVEMENTS ===
  // Common
  FIRST_BLOOD: { coinReward: 25 },
  WARMED_UP: { coinReward: 50, packReward: 'SINGLE' },
  FIGHTER: { coinReward: 30 },
  DUELIST: { coinReward: 75, packReward: 'SINGLE' },
  HEAT_CHECK: { coinReward: 40 },
  
  // Rare
  VETERAN: { coinReward: 100, packReward: 'SINGLE' },
  HIGH_ROLLER: { coinReward: 75 },
  PAY_DAY: { coinReward: 50 },
  BULLSEYE: { coinReward: 100, packReward: 'SINGLE' },
  ROCK_SOLID: { coinReward: 150, packReward: 'FIVE' },
  RISK_TAKER: { coinReward: 75 },
  GAMBLER: { coinReward: 125, packReward: 'SINGLE' },
  TACTICAL: { coinReward: 60 },
  PRECISION: { coinReward: 150, packReward: 'FIVE' },
  TARGET_LOCKED: { coinReward: 100 },
  WIN_COLLECTOR: { coinReward: 200, packReward: 'FIVE' },
  HISTORIAN: { coinReward: 125 },
  PROFESSIONAL: { coinReward: 150, packReward: 'FIVE' },
  SHOWMAN: { coinReward: 125, packReward: 'SINGLE' },
  COLLECTOR: { coinReward: 100 },
  RED_HOT: { coinReward: 150, packReward: 'SINGLE' },
  DOUBLE_TROUBLE: { coinReward: 200, packReward: 'FIVE' },
  ELO_1050: { coinReward: 250, packReward: 'FIVE' },
  
  // Epic
  HOT_STREAK: { coinReward: 200, packReward: 'FIVE' },
  ELIMINATOR: { coinReward: 150 },
  GIANT_KILLER: { coinReward: 250, packReward: 'FIVE' },
  IRON_WALL: { coinReward: 300, packReward: 'TEN' },
  PREDATOR: { coinReward: 200 },
  SHARPSHOOTER_ACH: { coinReward: 350, packReward: 'TEN' },
  COMEBACK_KING: { coinReward: 200, packReward: 'FIVE' },
  KING_SLAYER: { coinReward: 300, packReward: 'TEN' },
  SHOCKWAVE: { coinReward: 250, packReward: 'FIVE' },
  HEAT_ISLAND: { coinReward: 350, packReward: 'TEN' },
  DOMINATOR: { coinReward: 400, packReward: 'TEN' },
  CROWN: { coinReward: 500 },
  
  // Hidden/Special
  LUNCH_LEGEND: { coinReward: 100 },
  KILBIRNIE_LION: { coinReward: 200, packReward: 'FIVE' },
  FIRST_BLOOD_SEASON: { coinReward: 75 },
  
  // === PRACTICE MODE ACHIEVEMENTS ===
  PRACTICE_ROOKIE: { coinReward: 25 },
  PRACTICE_WARRIOR: { coinReward: 50 },
  PRACTICE_MASTER: { coinReward: 100, packReward: 'SINGLE' },
  PRACTICE_LEGEND: { coinReward: 150, packReward: 'FIVE' },
  
  // === MASTER 501 ACHIEVEMENTS ===
  M501_FIRST: { coinReward: 30 },
  M501_5_WINS: { coinReward: 75, packReward: 'SINGLE' },
  M501_10_WINS: { coinReward: 150, packReward: 'FIVE' },
  M501_PERFECT: { coinReward: 200, packReward: 'FIVE' },
  
  // === SHADOW BOT ACHIEVEMENTS ===
  BOT_ROOKIE: { coinReward: 25 },
  BOT_EASY_MASTER: { coinReward: 50 },
  BOT_NORMAL_MASTER: { coinReward: 100, packReward: 'SINGLE' },
  BOT_HARD_MASTER: { coinReward: 200, packReward: 'FIVE' },
  BOT_LEGEND: { coinReward: 300, packReward: 'TEN' },
  
  // === FORMAT & MEME ACHIEVEMENTS ===
  FORMAT_AROUND_WORLD: { coinReward: 50 },
  FORMAT_SHANGHAI: { coinReward: 75, packReward: 'SINGLE' },
  FORMAT_CRICKET: { coinReward: 75, packReward: 'SINGLE' },
  FORMAT_KILLER: { coinReward: 100, packReward: 'SINGLE' },
  FORMAT_TREBLE: { coinReward: 50 },
  FORMAT_BULL_FINISH: { coinReward: 75 },
  FORMAT_1001: { coinReward: 100, packReward: 'SINGLE' },
  FORMAT_301: { coinReward: 75 },
  
  // Default fallback
  DEFAULT: { coinReward: 50 },
};

/**
 * Get rewards for an achievement
 */
export function getAchievementReward(achievementKey: string): AchievementReward {
  return ACHIEVEMENT_REWARDS[achievementKey] || ACHIEVEMENT_REWARDS.DEFAULT;
}

/**
 * Calculate total pack value in packs (for metrics)
 */
export function packRewardToCount(packType?: 'SINGLE' | 'FIVE' | 'TEN'): number {
  if (!packType) return 0;
  if (packType === 'SINGLE') return 1;
  if (packType === 'FIVE') return 5;
  if (packType === 'TEN') return 10;
  return 0;
}
