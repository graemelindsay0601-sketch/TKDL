/**
 * CHALLENGE POOL - Comprehensive set of daily and weekly challenges
 * Used to seed the database with variety
 */

export const DAILY_CHALLENGE_POOL = [
  // X01 Challenges (2-4 wins)
  { challenge_key: "x01_quick_2", title: "X01 Quick Win", description: "Win 2 X01 games", requirement_type: "x01_wins", requirement_value: 2, reward_coins: 15 },
  { challenge_key: "x01_dominator_3", title: "X01 Dominator", description: "Win 3 X01 games", requirement_type: "x01_wins", requirement_value: 3, reward_coins: 20 },
  { challenge_key: "x01_master_4", title: "X01 Master", description: "Win 4 X01 games", requirement_type: "x01_wins", requirement_value: 4, reward_coins: 25 },

  // Cricket Challenges
  { challenge_key: "cricket_starter_2", title: "Cricket Starter", description: "Win 2 Cricket games", requirement_type: "cricket_wins", requirement_value: 2, reward_coins: 15 },
  { challenge_key: "cricket_pro_3", title: "Cricket Pro", description: "Win 3 Cricket games", requirement_type: "cricket_wins", requirement_value: 3, reward_coins: 20 },
  { challenge_key: "cricket_legend_4", title: "Cricket Legend", description: "Win 4 Cricket games", requirement_type: "cricket_wins", requirement_value: 4, reward_coins: 25 },

  // Practice Mode Challenges
  { challenge_key: "practice_grind_2", title: "Practice Grind", description: "Win 2 Practice games", requirement_type: "practice_wins", requirement_value: 2, reward_coins: 10 },
  { challenge_key: "practice_warrior_3", title: "Practice Warrior", description: "Win 3 Practice games", requirement_type: "practice_wins", requirement_value: 3, reward_coins: 15 },
  { challenge_key: "practice_champion_4", title: "Practice Champion", description: "Win 4 Practice games", requirement_type: "practice_wins", requirement_value: 4, reward_coins: 20 },

  // M-501 Challenges
  { challenge_key: "m501_twice_2", title: "501 Double Down", description: "Win 2 M-501 games", requirement_type: "master501_wins", requirement_value: 2, reward_coins: 15 },
  { challenge_key: "m501_threepeat_3", title: "501 Three in a Row", description: "Win 3 M-501 games", requirement_type: "master501_wins", requirement_value: 3, reward_coins: 20 },

  // Tour Challenges
  { challenge_key: "tour_journey_2", title: "Tour Journey", description: "Complete 2 Tour rounds", requirement_type: "tour_wins", requirement_value: 2, reward_coins: 15 },
  { challenge_key: "tour_expedition_3", title: "Tour Expedition", description: "Complete 3 Tour rounds", requirement_type: "tour_wins", requirement_value: 3, reward_coins: 20 },
  { challenge_key: "tour_quest_4", title: "Tour Quest", description: "Complete 4 Tour rounds", requirement_type: "tour_wins", requirement_value: 4, reward_coins: 25 },

  // League Challenges
  { challenge_key: "league_climb_2", title: "League Climber", description: "Win 2 League matches", requirement_type: "league_wins", requirement_value: 2, reward_coins: 15 },
  { challenge_key: "league_surge_3", title: "League Surge", description: "Win 3 League matches", requirement_type: "league_wins", requirement_value: 3, reward_coins: 20 },
  { challenge_key: "league_dominate_4", title: "League Dominator", description: "Win 4 League matches", requirement_type: "league_wins", requirement_value: 4, reward_coins: 25 },

  // Card Clash Challenges
  { challenge_key: "cardclash_initiate_2", title: "Clash Initiate", description: "Win 2 Card Clash matches", requirement_type: "card_clash_wins", requirement_value: 2, reward_coins: 20, reward_pack_tokens: 1 },
  { challenge_key: "cardclash_warrior_3", title: "Clash Warrior", description: "Win 3 Card Clash matches", requirement_type: "card_clash_wins", requirement_value: 3, reward_coins: 25, reward_pack_tokens: 1 },

  // General Challenges
  { challenge_key: "general_grinder_5", title: "All-Mode Grinder", description: "Play 5 games (any mode)", requirement_type: "total_games_played", requirement_value: 5, reward_coins: 15 },
  { challenge_key: "general_marathon_10", title: "All-Mode Marathon", description: "Play 10 games (any mode)", requirement_type: "total_games_played", requirement_value: 10, reward_coins: 25 },
];

export const WEEKLY_CHALLENGE_POOL = [
  // X01 Challenges (5-7 wins)
  { challenge_key: "x01_weekly_grind_5", title: "X01 Weekly Grind", description: "Win 5 X01 games this week", requirement_type: "x01_wins", requirement_value: 5, reward_coins: 50, reward_pack_tokens: 2 },
  { challenge_key: "x01_weekly_master_7", title: "X01 Master Series", description: "Win 7 X01 games this week", requirement_type: "x01_wins", requirement_value: 7, reward_coins: 75, reward_pack_tokens: 3 },

  // Cricket Challenges
  { challenge_key: "cricket_weekly_5", title: "Cricket Champion", description: "Win 5 Cricket games this week", requirement_type: "cricket_wins", requirement_value: 5, reward_coins: 50, reward_pack_tokens: 2 },
  { challenge_key: "cricket_weekly_legend_7", title: "Cricket Legend Series", description: "Win 7 Cricket games this week", requirement_type: "cricket_wins", requirement_value: 7, reward_coins: 75, reward_pack_tokens: 3 },

  // Practice Mode Challenges
  { challenge_key: "practice_weekly_grind_6", title: "Practice Marathon", description: "Win 6 Practice games this week", requirement_type: "practice_wins", requirement_value: 6, reward_coins: 40, reward_pack_tokens: 1 },

  // M-501 Challenges
  { challenge_key: "m501_weekly_5", title: "501 Specialist", description: "Win 5 M-501 games this week", requirement_type: "master501_wins", requirement_value: 5, reward_coins: 50, reward_pack_tokens: 2 },

  // Tour Challenges
  { challenge_key: "tour_weekly_5", title: "Tour Explorer", description: "Complete 5 Tour rounds this week", requirement_type: "tour_wins", requirement_value: 5, reward_coins: 50, reward_pack_tokens: 2 },
  { challenge_key: "tour_weekly_epic_7", title: "Tour Epic Quest", description: "Complete 7 Tour rounds this week", requirement_type: "tour_wins", requirement_value: 7, reward_coins: 75, reward_pack_tokens: 3 },

  // League Challenges
  { challenge_key: "league_weekly_5", title: "League Powerhouse", description: "Win 5 League matches this week", requirement_type: "league_wins", requirement_value: 5, reward_coins: 50, reward_pack_tokens: 2 },
  { challenge_key: "league_weekly_elite_7", title: "League Elite", description: "Win 7 League matches this week", requirement_type: "league_wins", requirement_value: 7, reward_coins: 75, reward_pack_tokens: 3 },

  // Card Clash Challenges
  { challenge_key: "cardclash_weekly_5", title: "Clash Master", description: "Win 5 Card Clash matches this week", requirement_type: "card_clash_wins", requirement_value: 5, reward_coins: 60, reward_pack_tokens: 3 },
  { challenge_key: "cardclash_weekly_king_7", title: "Clash King", description: "Win 7 Card Clash matches this week", requirement_type: "card_clash_wins", requirement_value: 7, reward_coins: 100, reward_pack_tokens: 5 },

  // General Challenges
  { challenge_key: "weekly_grinder_30", title: "Weekly Grinder", description: "Play 30 games this week (any mode)", requirement_type: "total_games_played", requirement_value: 30, reward_coins: 60, reward_pack_tokens: 2 },
  { challenge_key: "weekly_marathoner_50", title: "Weekly Marathoner", description: "Play 50 games this week (any mode)", requirement_type: "total_games_played", requirement_value: 50, reward_coins: 100, reward_pack_tokens: 4 },
];

/**
 * Select random challenges from pool for player assignment
 */
export function selectDailyForPlayer(): typeof DAILY_CHALLENGE_POOL {
  // One challenge per game mode (7 total)
  // Group by game mode and pick one random from each
  
  const modes = {
    x01: DAILY_CHALLENGE_POOL.filter(c => c.requirement_type === "x01_wins"),
    cricket: DAILY_CHALLENGE_POOL.filter(c => c.requirement_type === "cricket_wins"),
    practice: DAILY_CHALLENGE_POOL.filter(c => c.requirement_type === "practice_wins"),
    m501: DAILY_CHALLENGE_POOL.filter(c => c.requirement_type === "master501_wins"),
    tour: DAILY_CHALLENGE_POOL.filter(c => c.requirement_type === "tour_wins"),
    league: DAILY_CHALLENGE_POOL.filter(c => c.requirement_type === "league_wins"),
    cardclash: DAILY_CHALLENGE_POOL.filter(c => c.requirement_type === "card_clash_wins"),
  };

  const selected = [];
  for (const mode of Object.values(modes)) {
    if (mode.length > 0) {
      selected.push(mode[Math.floor(Math.random() * mode.length)]);
    }
  }
  
  return selected;
}

export function selectWeeklyForPlayer(): typeof WEEKLY_CHALLENGE_POOL {
  // Same logic for weekly
  const modes = {
    x01: WEEKLY_CHALLENGE_POOL.filter(c => c.requirement_type === "x01_wins"),
    cricket: WEEKLY_CHALLENGE_POOL.filter(c => c.requirement_type === "cricket_wins"),
    practice: WEEKLY_CHALLENGE_POOL.filter(c => c.requirement_type === "practice_wins"),
    m501: WEEKLY_CHALLENGE_POOL.filter(c => c.requirement_type === "master501_wins"),
    tour: WEEKLY_CHALLENGE_POOL.filter(c => c.requirement_type === "tour_wins"),
    league: WEEKLY_CHALLENGE_POOL.filter(c => c.requirement_type === "league_wins"),
    cardclash: WEEKLY_CHALLENGE_POOL.filter(c => c.requirement_type === "card_clash_wins"),
  };

  const selected = [];
  for (const mode of Object.values(modes)) {
    if (mode.length > 0) {
      selected.push(mode[Math.floor(Math.random() * mode.length)]);
    }
  }
  
  return selected;
}
