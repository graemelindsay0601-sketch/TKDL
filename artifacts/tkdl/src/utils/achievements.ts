/**
 * Card Clash Achievements System
 * 
 * Track player progress and award coins/packs
 * Multiple achievement categories
 * Progressive tiers and milestones
 */

export type AchievementCategory = 
  | 'collection' 
  | 'matches' 
  | 'earnings' 
  | 'streaks' 
  | 'discovery' 
  | 'mastery';

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'legendary';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon: string;
  tier: AchievementTier;
  coinReward: number;
  packReward?: 'SINGLE' | 'FIVE' | 'TEN';
  requirement: (playerStats: PlayerStats) => boolean;
  progress?: (playerStats: PlayerStats) => { current: number; target: number };
}

export interface PlayerStats {
  cardsOwned: number;
  totalCardsInGame: number;
  matchesWon: number;
  matchesLost: number;
  totalMatches: number;
  totalCoinsEarned: number;
  currentCoinBalance: number;
  dayLoginStreak: number;
  cardsLegendary: number;
  cardsRare: number;
  cardsCommon: number;
  perfectMatches: number;
  practiceMatches: number;
  highestWinStreak: number;
  allCardsCollected: boolean;
  allLegendariesCollected: boolean;
  allRaresCollected: boolean;
}

/**
 * All achievements in the game
 */
export const ACHIEVEMENTS: Achievement[] = [
  // ========== COLLECTION ACHIEVEMENTS ==========
  {
    id: 'first-card',
    name: 'First Step',
    description: 'Collect your first card',
    category: 'collection',
    icon: '🃏',
    tier: 'bronze',
    coinReward: 25,
    requirement: (stats) => stats.cardsOwned >= 1,
  },
  {
    id: 'collector-10',
    name: 'Card Collector',
    description: 'Own 10 different cards',
    category: 'collection',
    icon: '📚',
    tier: 'bronze',
    coinReward: 50,
    packReward: 'SINGLE',
    requirement: (stats) => stats.cardsOwned >= 10,
    progress: (stats) => ({ current: stats.cardsOwned, target: 10 }),
  },
  {
    id: 'collector-25',
    name: 'Curator',
    description: 'Own 25 different cards',
    category: 'collection',
    icon: '🗂️',
    tier: 'silver',
    coinReward: 100,
    packReward: 'SINGLE',
    requirement: (stats) => stats.cardsOwned >= 25,
    progress: (stats) => ({ current: stats.cardsOwned, target: 25 }),
  },
  {
    id: 'collector-50',
    name: 'Arsenal Master',
    description: 'Own 50 different cards',
    category: 'collection',
    icon: '⚔️',
    tier: 'gold',
    coinReward: 250,
    packReward: 'FIVE',
    requirement: (stats) => stats.cardsOwned >= 50,
    progress: (stats) => ({ current: stats.cardsOwned, target: 50 }),
  },
  {
    id: 'full-collection',
    name: 'Complete Collection',
    description: 'Collect all 100 cards',
    category: 'collection',
    icon: '👑',
    tier: 'legendary',
    coinReward: 1000,
    packReward: 'TEN',
    requirement: (stats) => stats.allCardsCollected,
  },
  {
    id: 'legendary-collector',
    name: 'Legendary Hunter',
    description: 'Collect all legendary cards',
    category: 'collection',
    icon: '✨',
    tier: 'platinum',
    coinReward: 500,
    requirement: (stats) => stats.allLegendariesCollected,
  },
  {
    id: 'rare-master',
    name: 'Rare Master',
    description: 'Collect all rare cards',
    category: 'collection',
    icon: '💎',
    tier: 'gold',
    coinReward: 300,
    requirement: (stats) => stats.allRaresCollected,
  },

  // ========== MATCH ACHIEVEMENTS ==========
  {
    id: 'first-match',
    name: 'Newcomer',
    description: 'Win your first match',
    category: 'matches',
    icon: '🎮',
    tier: 'bronze',
    coinReward: 25,
    requirement: (stats) => stats.matchesWon >= 1,
  },
  {
    id: 'five-wins',
    name: 'Rising Star',
    description: 'Win 5 matches',
    category: 'matches',
    icon: '⭐',
    tier: 'bronze',
    coinReward: 75,
    packReward: 'SINGLE',
    requirement: (stats) => stats.matchesWon >= 5,
    progress: (stats) => ({ current: stats.matchesWon, target: 5 }),
  },
  {
    id: 'ten-wins',
    name: 'Seasoned Veteran',
    description: 'Win 10 matches',
    category: 'matches',
    icon: '🏆',
    tier: 'silver',
    coinReward: 150,
    packReward: 'SINGLE',
    requirement: (stats) => stats.matchesWon >= 10,
    progress: (stats) => ({ current: stats.matchesWon, target: 10 }),
  },
  {
    id: 'twenty-five-wins',
    name: 'Dominator',
    description: 'Win 25 matches',
    category: 'matches',
    icon: '👑',
    tier: 'gold',
    coinReward: 300,
    packReward: 'FIVE',
    requirement: (stats) => stats.matchesWon >= 25,
    progress: (stats) => ({ current: stats.matchesWon, target: 25 }),
  },
  {
    id: 'fifty-wins',
    name: 'Legend',
    description: 'Win 50 matches',
    category: 'matches',
    icon: '🌟',
    tier: 'platinum',
    coinReward: 500,
    packReward: 'TEN',
    requirement: (stats) => stats.matchesWon >= 50,
    progress: (stats) => ({ current: stats.matchesWon, target: 50 }),
  },
  {
    id: 'perfect-match',
    name: 'Flawless',
    description: 'Win a match without taking damage',
    category: 'mastery',
    icon: '💯',
    tier: 'gold',
    coinReward: 200,
    requirement: (stats) => stats.perfectMatches >= 1,
  },

  // ========== EARNINGS ACHIEVEMENTS ==========
  {
    id: 'first-coins',
    name: 'First Earnings',
    description: 'Earn your first 100 coins',
    category: 'earnings',
    icon: '💰',
    tier: 'bronze',
    coinReward: 50,
    requirement: (stats) => stats.totalCoinsEarned >= 100,
  },
  {
    id: 'coin-hoarder-500',
    name: 'Coin Hoarder',
    description: 'Accumulate 500 coins',
    category: 'earnings',
    icon: '🪙',
    tier: 'silver',
    coinReward: 100,
    requirement: (stats) => stats.currentCoinBalance >= 500,
    progress: (stats) => ({ current: stats.currentCoinBalance, target: 500 }),
  },
  {
    id: 'coin-hoarder-1000',
    name: 'Wealthy',
    description: 'Accumulate 1000 coins',
    category: 'earnings',
    icon: '💎',
    tier: 'gold',
    coinReward: 250,
    packReward: 'FIVE',
    requirement: (stats) => stats.currentCoinBalance >= 1000,
    progress: (stats) => ({ current: stats.currentCoinBalance, target: 1000 }),
  },
  {
    id: 'earned-1000-total',
    name: 'High Earner',
    description: 'Earn 1000+ coins across all time',
    category: 'earnings',
    icon: '💸',
    tier: 'gold',
    coinReward: 200,
    requirement: (stats) => stats.totalCoinsEarned >= 1000,
    progress: (stats) => ({ current: stats.totalCoinsEarned, target: 1000 }),
  },

  // ========== STREAK ACHIEVEMENTS ==========
  {
    id: 'seven-day-streak',
    name: 'Dedicated',
    description: 'Maintain a 7-day login streak',
    category: 'streaks',
    icon: '🔥',
    tier: 'bronze',
    coinReward: 100,
    requirement: (stats) => stats.dayLoginStreak >= 7,
    progress: (stats) => ({ current: stats.dayLoginStreak, target: 7 }),
  },
  {
    id: 'thirty-day-streak',
    name: 'Obsessed',
    description: 'Maintain a 30-day login streak',
    category: 'streaks',
    icon: '🌟',
    tier: 'gold',
    coinReward: 300,
    packReward: 'TEN',
    requirement: (stats) => stats.dayLoginStreak >= 30,
    progress: (stats) => ({ current: stats.dayLoginStreak, target: 30 }),
  },
  {
    id: 'win-streak-5',
    name: 'On Fire',
    description: 'Win 5 matches in a row',
    category: 'streaks',
    icon: '🔥',
    tier: 'silver',
    coinReward: 150,
    requirement: (stats) => stats.highestWinStreak >= 5,
    progress: (stats) => ({ current: stats.highestWinStreak, target: 5 }),
  },

  // ========== DISCOVERY ACHIEVEMENTS ==========
  {
    id: 'practice-pioneer',
    name: 'Practice Pioneer',
    description: 'Complete 5 practice matches',
    category: 'discovery',
    icon: '🎯',
    tier: 'bronze',
    coinReward: 50,
    requirement: (stats) => stats.practiceMatches >= 5,
    progress: (stats) => ({ current: stats.practiceMatches, target: 5 }),
  },
  {
    id: 'mode-master',
    name: 'Mode Master',
    description: 'Play 10 practice matches',
    category: 'discovery',
    icon: '🎮',
    tier: 'silver',
    coinReward: 100,
    packReward: 'SINGLE',
    requirement: (stats) => stats.practiceMatches >= 10,
    progress: (stats) => ({ current: stats.practiceMatches, target: 10 }),
  },

  // ========== MASTERY ACHIEVEMENTS ==========
  {
    id: 'fifty-percent-winrate',
    name: 'Skilled',
    description: 'Achieve 50%+ win rate',
    category: 'mastery',
    icon: '⚡',
    tier: 'gold',
    coinReward: 200,
    requirement: (stats) => {
      if (stats.totalMatches < 10) return false;
      return (stats.matchesWon / stats.totalMatches) >= 0.5;
    },
  },
  {
    id: 'seventy-percent-winrate',
    name: 'Master',
    description: 'Achieve 70%+ win rate',
    category: 'mastery',
    icon: '👑',
    tier: 'platinum',
    coinReward: 400,
    packReward: 'FIVE',
    requirement: (stats) => {
      if (stats.totalMatches < 20) return false;
      return (stats.matchesWon / stats.totalMatches) >= 0.7;
    },
  },
];

/**
 * Get achievement categories with their colors
 */
export const ACHIEVEMENT_COLORS: Record<AchievementCategory, string> = {
  collection: '#00b4ff',
  matches: '#22c55e',
  earnings: '#ffd24a',
  streaks: '#ff6b6b',
  discovery: '#9d4edd',
  mastery: '#ff9500',
};

/**
 * Get tier colors
 */
export const TIER_COLORS: Record<AchievementTier, string> = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd24a',
  platinum: '#e5e4e2',
  legendary: '#ff9500',
};

/**
 * Determine which achievements are earned by player
 */
export function getEarnedAchievements(stats: PlayerStats): Achievement[] {
  return ACHIEVEMENTS.filter((ach) => ach.requirement(stats));
}

/**
 * Get total coin rewards from achievements
 */
export function getTotalAchievementCoins(stats: PlayerStats): number {
  return getEarnedAchievements(stats).reduce((sum, ach) => sum + ach.coinReward, 0);
}

/**
 * Get total pack rewards from achievements
 */
export function getTotalAchievementPacks(stats: PlayerStats): number {
  return getEarnedAchievements(stats)
    .filter((ach) => ach.packReward)
    .reduce((sum, ach) => {
      const multiplier = ach.packReward === 'TEN' ? 10 : ach.packReward === 'FIVE' ? 5 : 1;
      return sum + multiplier;
    }, 0);
}
