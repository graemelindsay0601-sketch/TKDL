import { db } from "@workspace/db";
import { achievementsTable, playerAchievementsTable, playersTable, matchesTable, seasonStandingsTable } from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";
import { logger } from "./logger";

export type AchievementDef = {
  key: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  category: string;
  hidden: boolean;
  priority: number;
  criteriaType: string;
  criteriaValue: number;
  engineType: string;
  secondaryCriteria?: string;
  secondaryValue?: number;
};

export const ACHIEVEMENT_DEFINITIONS: AchievementDef[] = [
  // === CAREER ===
  { key: "FIRST_BLOOD",       name: "🩸 First Blood",       description: "Win your first TKDL match",                    icon: "🩸", rarity: "Common",    category: "Career",    hidden: false, priority: 20, criteriaType: "CAREER_WINS",      criteriaValue: 1,   engineType: "STAT_BASED" },
  { key: "WARMED_UP",         name: "🎯 Warm-Up",           description: "Play 10 TKDL matches",                         icon: "🎯", rarity: "Common",    category: "Career",    hidden: false, priority: 20, criteriaType: "CAREER_GAMES",     criteriaValue: 10,  engineType: "STAT_BASED" },
  { key: "FIGHTER",           name: "🥊 Fighter",           description: "Play 5 matches",                               icon: "🥊", rarity: "Common",    category: "Career",    hidden: false, priority: 20, criteriaType: "CAREER_GAMES",     criteriaValue: 5,   engineType: "STAT_BASED" },
  { key: "DUELIST",           name: "⚔ Duelist",            description: "Play 25 matches",                              icon: "⚔",  rarity: "Common",    category: "Career",    hidden: false, priority: 20, criteriaType: "CAREER_GAMES",     criteriaValue: 25,  engineType: "STAT_BASED" },
  { key: "HEAT_CHECK",        name: "🔥 Heat Check",        description: "Win 3 in a row",                               icon: "🔥", rarity: "Common",    category: "Career",    hidden: false, priority: 20, criteriaType: "WIN_STREAK",       criteriaValue: 3,   engineType: "MATCH_EVENT",  secondaryCriteria: "CAREER_GAMES", secondaryValue: 5 },
  { key: "VETERAN",           name: "🎖 Veteran",           description: "Play 50 TKDL matches",                         icon: "🎖", rarity: "Rare",      category: "Career",    hidden: false, priority: 40, criteriaType: "CAREER_GAMES",     criteriaValue: 50,  engineType: "STAT_BASED" },
  { key: "HIGH_ROLLER",       name: "💰 High Roller",       description: "Win a match wagering 25+ points",              icon: "💰", rarity: "Rare",      category: "Career",    hidden: false, priority: 40, criteriaType: "HIGH_STAKE_WIN",   criteriaValue: 25,  engineType: "MATCH_EVENT" },
  { key: "PAY_DAY",           name: "💵 Pay Day",           description: "Win a match wagering 10+ points",              icon: "💵", rarity: "Rare",      category: "Career",    hidden: false, priority: 40, criteriaType: "HIGH_STAKE_WIN",   criteriaValue: 10,  engineType: "MATCH_EVENT" },
  { key: "BULLSEYE",          name: "🏹 Bullseye",          description: "Reach 60% win rate over 10 games",             icon: "🏹", rarity: "Rare",      category: "Career",    hidden: false, priority: 40, criteriaType: "WIN_RATE",         criteriaValue: 60,  engineType: "STAT_BASED",   secondaryCriteria: "CAREER_GAMES", secondaryValue: 10 },
  { key: "ROCK_SOLID",        name: "🪨 Rock Solid",        description: "Survive a season (never eliminated)",          icon: "🪨", rarity: "Rare",      category: "Career",    hidden: false, priority: 40, criteriaType: "SEASON_UNELIMINATED", criteriaValue: 1, engineType: "SEASON_EVENT", secondaryCriteria: "SEASON_GAMES", secondaryValue: 10 },
  { key: "RISK_TAKER",        name: "🎲 Risk Taker",        description: "Play 5 matches with 10+ points wagered",       icon: "🎲", rarity: "Rare",      category: "Career",    hidden: false, priority: 40, criteriaType: "HIGH_STAKES_TOTAL",criteriaValue: 5,   engineType: "MATCH_EVENT" },
  { key: "GAMBLER",           name: "🎰 Gambler",           description: "Play 10 matches with 10+ points wagered",      icon: "🎰", rarity: "Rare",      category: "Career",    hidden: false, priority: 40, criteriaType: "HIGH_STAKES_MATCHES", criteriaValue: 10, engineType: "MATCH_EVENT" },
  { key: "TACTICAL",          name: "🧠 Tactical",          description: "Win despite being underdog in points",         icon: "🧠", rarity: "Rare",      category: "Career",    hidden: false, priority: 40, criteriaType: "UPSET_WIN",        criteriaValue: 1,   engineType: "MATCH_EVENT" },
  { key: "PRECISION",         name: "🎯 Precision",         description: "Reach 70% win rate over 20 games",             icon: "🎯", rarity: "Rare",      category: "Career",    hidden: false, priority: 40, criteriaType: "WIN_RATE",         criteriaValue: 70,  engineType: "STAT_BASED",   secondaryCriteria: "CAREER_GAMES", secondaryValue: 20 },
  { key: "TARGET_LOCKED",     name: "🎯 Target Locked",     description: "Beat same opponent 3 times",                   icon: "🎯", rarity: "Rare",      category: "Career",    hidden: false, priority: 40, criteriaType: "SAME_OPPONENT_WINS", criteriaValue: 3, engineType: "MATCH_EVENT" },
  { key: "WIN_COLLECTOR",     name: "⚡ Win Collector",     description: "Win matches in 4+ different seasons",          icon: "⚡", rarity: "Rare",      category: "Career",    hidden: false, priority: 40, criteriaType: "MULTI_SEASON_WINS",criteriaValue: 4,   engineType: "SEASON_EVENT" },
  { key: "HISTORIAN",         name: "📚 Historian",         description: "Play in 3+ seasons",                          icon: "📚", rarity: "Rare",      category: "Career",    hidden: false, priority: 40, criteriaType: "MULTI_SEASON_PLAYS",criteriaValue: 3,  engineType: "SEASON_EVENT" },
  { key: "PROFESSIONAL",      name: "💼 Professional",      description: "Play 75 career matches",                       icon: "💼", rarity: "Rare",      category: "Career",    hidden: false, priority: 40, criteriaType: "CAREER_GAMES",     criteriaValue: 75,  engineType: "STAT_BASED" },
  { key: "SHOWMAN",           name: "🎪 Showman",           description: "Win 5 featured matches",                       icon: "🎪", rarity: "Rare",      category: "Career",    hidden: false, priority: 40, criteriaType: "FEATURED_WINS",    criteriaValue: 5,   engineType: "MATCH_EVENT" },
  { key: "COLLECTOR",         name: "📦 Collector",         description: "Unlock 10 achievements",                       icon: "📦", rarity: "Rare",      category: "Career",    hidden: false, priority: 40, criteriaType: "TOTAL_ACHIEVEMENTS",criteriaValue: 10,  engineType: "STAT_BASED" },
  { key: "RED_HOT",           name: "🔥 Red Hot",           description: "Win 7 in a row",                               icon: "🔥", rarity: "Rare",      category: "Career",    hidden: false, priority: 40, criteriaType: "WIN_STREAK",       criteriaValue: 7,   engineType: "MATCH_EVENT",  secondaryCriteria: "CAREER_GAMES", secondaryValue: 20 },
  { key: "DOUBLE_TROUBLE",    name: "🧨 Double Eliminator", description: "Eliminate 2 players in one season",            icon: "🧨", rarity: "Rare",      category: "Career",    hidden: false, priority: 40, criteriaType: "SEASON_ELIMINATIONS", criteriaValue: 2, engineType: "SEASON_EVENT" },
  { key: "ELO_1050",          name: "🔷 Elite Threshold",   description: "Reach 1050 ELO rating",                        icon: "🔷", rarity: "Rare",      category: "Career",    hidden: false, priority: 40, criteriaType: "PEAK_ELO",         criteriaValue: 1050, engineType: "STAT_BASED" },
  { key: "HOT_STREAK",        name: "🔥 Hot Streak",        description: "Win 5 consecutive matches",                    icon: "🔥", rarity: "Epic",      category: "Career",    hidden: false, priority: 60, criteriaType: "WIN_STREAK",       criteriaValue: 5,   engineType: "MATCH_EVENT",  secondaryCriteria: "CAREER_GAMES", secondaryValue: 10 },
  { key: "ELIMINATOR",        name: "⚔ Eliminator",         description: "Eliminate a player (reduce to 0 points)",     icon: "⚔",  rarity: "Epic",      category: "Career",    hidden: false, priority: 60, criteriaType: "ELIMINATIONS",     criteriaValue: 1,   engineType: "MATCH_EVENT" },
  { key: "GIANT_KILLER",      name: "⚔ Giant Killer",       description: "Beat a top-ranked player 3 times",            icon: "⚔",  rarity: "Epic",      category: "Career",    hidden: false, priority: 60, criteriaType: "TOP_RANKED_WINS",  criteriaValue: 3,   engineType: "MATCH_EVENT" },
  { key: "IRON_WALL",         name: "🧱 Iron Wall",         description: "Finish season with no eliminations (stay active)", icon: "🧱", rarity: "Epic", category: "Career",    hidden: false, priority: 60, criteriaType: "SEASON_UNELIMINATED", criteriaValue: 1, engineType: "SEASON_EVENT", secondaryCriteria: "SEASON_GAMES", secondaryValue: 15 },
  { key: "PREDATOR",          name: "🪓 Predator",          description: "Eliminate the same player twice",              icon: "🪓", rarity: "Epic",      category: "Career",    hidden: false, priority: 60, criteriaType: "PLAYER_ELIMINATIONS",criteriaValue: 2, engineType: "MATCH_EVENT" },
  { key: "SHARPSHOOTER_ACH",  name: "🏹 Sharpshooter",     description: "Maintain 75% win rate over 30 games",          icon: "🏹", rarity: "Epic",      category: "Career",    hidden: false, priority: 60, criteriaType: "WIN_RATE",         criteriaValue: 75,  engineType: "STAT_BASED",   secondaryCriteria: "CAREER_GAMES", secondaryValue: 30 },
  { key: "COMEBACK_KING",     name: "🩹 Comeback King",     description: "Win 3 matches after losing 2+",               icon: "🩹", rarity: "Epic",      category: "Career",    hidden: false, priority: 60, criteriaType: "COMEBACK_STREAK",  criteriaValue: 3,   engineType: "MATCH_EVENT" },
  { key: "KING_SLAYER",       name: "👑 King Slayer",       description: "Beat the top-ranked player 3 times",          icon: "👑", rarity: "Epic",      category: "Career",    hidden: false, priority: 60, criteriaType: "TOP_RANKED_WINS",  criteriaValue: 3,   engineType: "MATCH_EVENT" },
  { key: "SHOCKWAVE",         name: "⚡ Shockwave",          description: "Win 100+ points in a season",                 icon: "⚡", rarity: "Epic",      category: "Career",    hidden: false, priority: 60, criteriaType: "SEASON_POINTS",    criteriaValue: 100, engineType: "SEASON_EVENT" },
  { key: "DETONATOR",         name: "🧨 Detonator",         description: "Win a 100-point+ ELO swing match",            icon: "🧨", rarity: "Epic",      category: "Career",    hidden: false, priority: 60, criteriaType: "MASSIVE_SWING",    criteriaValue: 100, engineType: "MATCH_EVENT" },
  { key: "GRAVE_DIGGER",      name: "🪦 Grave Digger",      description: "Eliminate 3 different players in a season",   icon: "🪦", rarity: "Epic",      category: "Career",    hidden: false, priority: 60, criteriaType: "SEASON_UNIQUE_ELIMS", criteriaValue: 3, engineType: "SEASON_EVENT" },
  { key: "MARATHON",          name: "⏳ Marathon",           description: "Play 100 matches",                            icon: "⏳", rarity: "Epic",      category: "Career",    hidden: false, priority: 60, criteriaType: "CAREER_GAMES",     criteriaValue: 100, engineType: "STAT_BASED" },
  { key: "SNIPER",            name: "🎯 Sniper",            description: "Maintain 80% win rate over 50 games",         icon: "🎯", rarity: "Epic",      category: "Career",    hidden: false, priority: 60, criteriaType: "WIN_RATE",         criteriaValue: 80,  engineType: "STAT_BASED",   secondaryCriteria: "CAREER_GAMES", secondaryValue: 50 },
  { key: "FORTRESS",          name: "🛑 Fortress",          description: "Never be eliminated all season (20+ games)",  icon: "🛑", rarity: "Epic",      category: "Career",    hidden: false, priority: 60, criteriaType: "SEASON_UNELIMINATED", criteriaValue: 1, engineType: "SEASON_EVENT", secondaryCriteria: "SEASON_GAMES", secondaryValue: 20 },
  { key: "STORM_BRINGER",     name: "🌪 Storm Bringer",     description: "Win 20+ matches in a season",                 icon: "🌪", rarity: "Epic",      category: "Career",    hidden: false, priority: 60, criteriaType: "SEASON_WINS",      criteriaValue: 20,  engineType: "SEASON_EVENT" },
  { key: "POINT_MASTER",      name: "💯 Point Master",      description: "Win 500+ total points in career",             icon: "💯", rarity: "Epic",      category: "Career",    hidden: false, priority: 60, criteriaType: "CAREER_POINTS",    criteriaValue: 500, engineType: "STAT_BASED" },
  { key: "CONQUEROR",         name: "👑 Conqueror",         description: "Beat all top 5 ranked players",               icon: "👑", rarity: "Epic",      category: "Rank",      hidden: false, priority: 60, criteriaType: "TOP_RANKED_WINS",  criteriaValue: 5,   engineType: "MATCH_EVENT" },
  { key: "FORTRESS_KING",     name: "🧱 Fortress King",     description: "Stay top 3 in points all season",             icon: "🧱", rarity: "Epic",      category: "Career",    hidden: false, priority: 60, criteriaType: "TOP3_FULL_SEASON", criteriaValue: 1,   engineType: "SEASON_EVENT" },
  { key: "ASSASSIN",          name: "🗡 Assassin",          description: "Eliminate 5 top-ranked opponents",            icon: "🗡", rarity: "Epic",      category: "Career",    hidden: false, priority: 60, criteriaType: "TOP_RANKED_ELIMS", criteriaValue: 5,   engineType: "MATCH_EVENT" },
  { key: "RIVAL_BREAKER",     name: "⚔ Rival Breaker",      description: "Defeat a rival 10 times",                     icon: "⚔",  rarity: "Epic",      category: "Career",    hidden: false, priority: 60, criteriaType: "RIVAL_WINS",       criteriaValue: 10,  engineType: "MATCH_EVENT" },
  { key: "SURVIVOR_ACH",      name: "🛡 Survivor",          description: "Play 20+ matches in a single season",         icon: "🛡", rarity: "Epic",      category: "Career",    hidden: false, priority: 60, criteriaType: "SEASON_GAMES",     criteriaValue: 20,  engineType: "SEASON_EVENT" },
  { key: "ELO_1200",          name: "🔶 Master Level",      description: "Reach 1200 ELO rating",                       icon: "🔶", rarity: "Epic",      category: "Career",    hidden: false, priority: 60, criteriaType: "PEAK_ELO",         criteriaValue: 1200, engineType: "STAT_BASED",  secondaryCriteria: "CAREER_GAMES", secondaryValue: 30 },
  // === TIER ===
  { key: "BRONZE_BLOODED",    name: "🥉 Bronze Blooded",    description: "Reach 10 career wins",                        icon: "🥉", rarity: "Common",    category: "Tier",      hidden: false, priority: 20, criteriaType: "CAREER_WINS",      criteriaValue: 10,  engineType: "STAT_BASED" },
  { key: "SILVER_STANDARD",   name: "🥈 Silver Standard",   description: "Reach 30 career wins",                        icon: "🥈", rarity: "Rare",      category: "Tier",      hidden: false, priority: 40, criteriaType: "CAREER_WINS",      criteriaValue: 30,  engineType: "STAT_BASED" },
  { key: "GOLDEN_ERA",        name: "🥇 Golden Era",        description: "Reach 75 career wins",                        icon: "🥇", rarity: "Epic",      category: "Tier",      hidden: false, priority: 60, criteriaType: "CAREER_WINS",      criteriaValue: 75,  engineType: "STAT_BASED" },
  // === LEGENDARY ===
  { key: "CROWNED",           name: "👑 Crowned",           description: "Finish a season with most points",            icon: "👑", rarity: "Legendary", category: "Career",    hidden: false, priority: 80, criteriaType: "SEASON_POINTS_LEADER", criteriaValue: 1, engineType: "SEASON_EVENT" },
  { key: "MVP",               name: "🎖 Season MVP",        description: "Finish season with most points overall",      icon: "🎖", rarity: "Legendary", category: "Seasonal",  hidden: false, priority: 80, criteriaType: "SEASON_POINTS_LEADER", criteriaValue: 1, engineType: "SEASON_EVENT" },
  { key: "INFERNO",           name: "🔥 Inferno",           description: "Win 10 in a row",                             icon: "🔥", rarity: "Legendary", category: "Career",    hidden: false, priority: 80, criteriaType: "WIN_STREAK",       criteriaValue: 10,  engineType: "MATCH_EVENT",  secondaryCriteria: "CAREER_GAMES", secondaryValue: 30 },
  { key: "IMMORTAL",          name: "🐐 Immortal",          description: "Reach 100 career wins",                       icon: "🐐", rarity: "Legendary", category: "Career",    hidden: false, priority: 80, criteriaType: "CAREER_WINS",      criteriaValue: 100, engineType: "STAT_BASED" },
  { key: "DECORATED",         name: "🎖 Decorated",         description: "Unlock 25 achievements",                      icon: "🎖", rarity: "Legendary", category: "Career",    hidden: false, priority: 80, criteriaType: "TOTAL_ACHIEVEMENTS",criteriaValue: 25,  engineType: "STAT_BASED" },
  { key: "SURVIVOR_ELITE",    name: "🪖 Survivor Elite",    description: "Survive 5+ seasons (never eliminated)",       icon: "🪖", rarity: "Legendary", category: "Career",    hidden: false, priority: 80, criteriaType: "MULTI_SEASON_SURVIVOR", criteriaValue: 5, engineType: "SEASON_EVENT" },
  { key: "ELO_1300",          name: "🔸 Legendary Rank",    description: "Reach 1300 ELO rating",                       icon: "🔸", rarity: "Legendary", category: "Career",    hidden: false, priority: 80, criteriaType: "PEAK_ELO",         criteriaValue: 1300, engineType: "STAT_BASED",  secondaryCriteria: "CAREER_GAMES", secondaryValue: 50 },
  { key: "BREAKTHROUGH",      name: "💥 Breakthrough",      description: "Reach 50 career wins",                        icon: "💥", rarity: "Legendary", category: "Career",    hidden: false, priority: 80, criteriaType: "CAREER_WINS",      criteriaValue: 50,  engineType: "STAT_BASED",   secondaryCriteria: "CAREER_GAMES", secondaryValue: 10 },
  { key: "SUPERSTAR",         name: "🌟 Superstar",         description: "Reach 100 career wins",                       icon: "🌟", rarity: "Legendary", category: "Career",    hidden: false, priority: 80, criteriaType: "CAREER_WINS",      criteriaValue: 100, engineType: "STAT_BASED",   secondaryCriteria: "CAREER_GAMES", secondaryValue: 30 },
  // === MYTHIC ===
  { key: "DYNASTY",           name: "🏆 Dynasty",           description: "Be season champion 3 times",                  icon: "🏆", rarity: "Mythic",    category: "Career",    hidden: false, priority: 90, criteriaType: "SEASON_CHAMPION_COUNT", criteriaValue: 3, engineType: "SEASON_EVENT" },
  { key: "UNTOUCHABLE",       name: "💎 Untouchable",       description: "Maintain 85% win rate over 50 games",         icon: "💎", rarity: "Mythic",    category: "Career",    hidden: false, priority: 90, criteriaType: "WIN_RATE",         criteriaValue: 85,  engineType: "STAT_BASED",   secondaryCriteria: "CAREER_GAMES", secondaryValue: 50 },
  { key: "ASCENDED",          name: "🌌 ELO Legend",        description: "Reach 1200 ELO rating",                       icon: "🌌", rarity: "Mythic",    category: "Career",    hidden: false, priority: 90, criteriaType: "PEAK_ELO",         criteriaValue: 1200, engineType: "STAT_BASED",  secondaryCriteria: "CAREER_GAMES", secondaryValue: 50 },
  { key: "NIGHTMARE",         name: "👹 Nightmare",         description: "Eliminate 10 players total",                  icon: "👹", rarity: "Mythic",    category: "Career",    hidden: false, priority: 90, criteriaType: "ELIMINATIONS",     criteriaValue: 10,  engineType: "MATCH_EVENT" },
  { key: "WARPATH",           name: "⚔ Warpath",            description: "Win 15 in a row",                             icon: "⚔",  rarity: "Mythic",    category: "Career",    hidden: false, priority: 90, criteriaType: "WIN_STREAK",       criteriaValue: 15,  engineType: "MATCH_EVENT",  secondaryCriteria: "CAREER_GAMES", secondaryValue: 50 },
  { key: "APOCALYPSE",        name: "💀 Apocalypse",        description: "Eliminate 5 top-ranked players",              icon: "💀", rarity: "Mythic",    category: "Career",    hidden: false, priority: 90, criteriaType: "TOP_RANKED_ELIMS", criteriaValue: 5,   engineType: "MATCH_EVENT" },
  { key: "HALL_OF_FAME",      name: "🧬 Hall of Fame",      description: "Reach 200 career wins",                       icon: "🧬", rarity: "Mythic",    category: "Career",    hidden: false, priority: 90, criteriaType: "CAREER_WINS",      criteriaValue: 200, engineType: "STAT_BASED" },
  { key: "LEGEND",            name: "🏛 Legend",            description: "Unlock 50 achievements",                      icon: "🏛", rarity: "Mythic",    category: "Career",    hidden: false, priority: 90, criteriaType: "TOTAL_ACHIEVEMENTS",criteriaValue: 50,  engineType: "STAT_BASED" },
  { key: "UNTOUCHABLE_PLUS",  name: "🧿 Untouchable+",      description: "Maintain 85% win rate with 50+ games",        icon: "🧿", rarity: "Mythic",    category: "Career",    hidden: false, priority: 90, criteriaType: "WIN_RATE",         criteriaValue: 85,  engineType: "STAT_BASED",   secondaryCriteria: "CAREER_GAMES", secondaryValue: 50 },
  // === SEASONAL ===
  { key: "RISING_STAR",       name: "📈 Rising Star",       description: "Gain 100+ points in first season",            icon: "📈", rarity: "Rare",      category: "Seasonal",  hidden: false, priority: 40, criteriaType: "FIRST_SEASON_POINTS", criteriaValue: 100, engineType: "SEASON_EVENT" },
  { key: "COLLAPSING",        name: "📉 Collapse",          description: "Lose 50+ points in a season",                 icon: "📉", rarity: "Rare",      category: "Seasonal",  hidden: false, priority: 40, criteriaType: "SEASON_POINTS_LOSS",criteriaValue: 50,  engineType: "SEASON_EVENT" },
  { key: "REAPER_SEASONAL",   name: "💀 Reaper",            description: "Most eliminations in a season",               icon: "💀", rarity: "Epic",      category: "Seasonal",  hidden: false, priority: 60, criteriaType: "SEASON_ELIMINATIONS",criteriaValue: 1,  engineType: "SEASON_EVENT" },
  { key: "MOST_ACTIVE",       name: "🎯 Most Active",       description: "Play 50+ matches in a season",                icon: "🎯", rarity: "Rare",      category: "Seasonal",  hidden: false, priority: 40, criteriaType: "SEASON_GAMES",     criteriaValue: 50,  engineType: "SEASON_EVENT" },
  { key: "ROCKET_START",      name: "🚀 Rocket Start",      description: "Win first 3 matches of a season",             icon: "🚀", rarity: "Rare",      category: "Seasonal",  hidden: false, priority: 40, criteriaType: "SEASON_START_WINS",criteriaValue: 3,   engineType: "SEASON_EVENT" },
  { key: "CLIMBER",           name: "🪜 Climber",           description: "Gain 75+ points in a season",                 icon: "🪜", rarity: "Common",    category: "Seasonal",  hidden: false, priority: 20, criteriaType: "SEASON_POINTS",    criteriaValue: 75,  engineType: "SEASON_EVENT" },
  { key: "FREEFALL",          name: "🕳 Freefall",          description: "Lose 75+ points in a season",                 icon: "🕳", rarity: "Rare",      category: "Seasonal",  hidden: false, priority: 40, criteriaType: "SEASON_POINTS_LOSS",criteriaValue: 75,  engineType: "SEASON_EVENT" },
  { key: "METEOR",            name: "☄ Meteor",             description: "Finish top 3 in your first season",           icon: "☄",  rarity: "Epic",      category: "Seasonal",  hidden: false, priority: 60, criteriaType: "FIRST_SEASON_TOP3",criteriaValue: 1,   engineType: "SEASON_EVENT" },
  { key: "MOMENTUM",          name: "📈 Momentum",          description: "Win streaks in 3 consecutive weeks",          icon: "📈", rarity: "Common",    category: "Seasonal",  hidden: false, priority: 20, criteriaType: "WEEKLY_WINS",      criteriaValue: 3,   engineType: "SEASON_EVENT" },
  // === HIDDEN ===
  { key: "LAST_MAN_STANDING", name: "☠ Last Man Standing",  description: "Never be eliminated across entire career",    icon: "☠",  rarity: "Mythic",    category: "Hidden",    hidden: true,  priority: 90, criteriaType: "NEVER_ELIMINATED",  criteriaValue: 1,  engineType: "STAT_BASED" },
  { key: "ICE_COLD",          name: "🧊 Ice Cold",          description: "Win 3 consecutive matches in a difficult season", icon: "🧊", rarity: "Legendary", category: "Hidden",   hidden: true,  priority: 80, criteriaType: "WIN_STREAK",       criteriaValue: 3,   engineType: "SEASON_EVENT" },
  { key: "PERFECT_RUN",       name: "🎯 Perfect Run",       description: "Win 10 consecutive matches",                  icon: "🎯", rarity: "Mythic",    category: "Hidden",    hidden: true,  priority: 90, criteriaType: "WIN_STREAK",       criteriaValue: 10,  engineType: "MATCH_EVENT",  secondaryCriteria: "CAREER_GAMES", secondaryValue: 20 },
  { key: "PHOENIX",           name: "🪙 Phoenix Rising",    description: "Win a match starting with only 1 point left", icon: "🪙", rarity: "Legendary", category: "Hidden",    hidden: true,  priority: 80, criteriaType: "LOW_POINT_WIN",    criteriaValue: 1,   engineType: "MATCH_EVENT" },
  { key: "CHAOS_AGENT",       name: "🧨 Chaos Agent",       description: "Eliminate 5 different players",               icon: "🧨", rarity: "Legendary", category: "Hidden",    hidden: true,  priority: 80, criteriaType: "UNIQUE_ELIMINATIONS", criteriaValue: 5, engineType: "MATCH_EVENT" },
  { key: "SNAKE",             name: "🐍 Snake",             description: "Beat the same player 5 times",               icon: "🐍", rarity: "Epic",      category: "Hidden",    hidden: true,  priority: 60, criteriaType: "SAME_OPPONENT_WINS", criteriaValue: 5, engineType: "MATCH_EVENT" },
  { key: "POINT_THIEF",       name: "💣 Point Thief",       description: "Win 200+ points in a single season",          icon: "💣", rarity: "Mythic",    category: "Hidden",    hidden: true,  priority: 90, criteriaType: "SEASON_POINTS",    criteriaValue: 200, engineType: "SEASON_EVENT" },
  { key: "UNBREAKABLE",       name: "🔒 Unbreakable",       description: "Finish season in top 3 points",               icon: "🔒", rarity: "Legendary", category: "Hidden",    hidden: true,  priority: 80, criteriaType: "SEASON_TOP3",      criteriaValue: 1,   engineType: "SEASON_EVENT" },
  { key: "LONE_WOLF",         name: "🐺 Lone Wolf",         description: "Win 15+ matches in a season with low participation", icon: "🐺", rarity: "Epic", category: "Hidden",  hidden: true,  priority: 60, criteriaType: "SEASON_WINS",      criteriaValue: 15,  engineType: "SEASON_EVENT",  secondaryCriteria: "SEASON_GAMES", secondaryValue: 12 },
  { key: "GHOST",             name: "👻 Ghost",             description: "Play only once then never return",            icon: "👻", rarity: "Rare",      category: "Hidden",    hidden: true,  priority: 40, criteriaType: "SINGLE_SEASON_INACTIVE", criteriaValue: 1, engineType: "SEASON_EVENT" },
  { key: "TOXIC",             name: "☣ Toxic",              description: "Eliminate 2 different players",               icon: "☣",  rarity: "Epic",      category: "Hidden",    hidden: true,  priority: 60, criteriaType: "UNIQUE_ELIMINATIONS", criteriaValue: 2, engineType: "MATCH_EVENT" },
  { key: "BLOOD_HUNTER",      name: "🩸 Blood Hunter",      description: "Eliminate 10 different players",              icon: "🩸", rarity: "Legendary", category: "Hidden",    hidden: true,  priority: 80, criteriaType: "UNIQUE_ELIMINATIONS", criteriaValue: 10,engineType: "MATCH_EVENT" },
  { key: "FROZEN_OUT",        name: "🥶 Frozen Out",        description: "Be eliminated in a season",                   icon: "🥶", rarity: "Epic",      category: "Hidden",    hidden: true,  priority: 60, criteriaType: "ELIMINATED_SEASON",criteriaValue: 1,   engineType: "SEASON_EVENT" },
  { key: "GENIUS",            name: "💡 Genius",            description: "Win 3 times as underdog (lower points)",      icon: "💡", rarity: "Epic",      category: "Hidden",    hidden: true,  priority: 60, criteriaType: "UPSET_WIN",        criteriaValue: 3,   engineType: "MATCH_EVENT" },
  { key: "COLD_SNAP",         name: "❄ Cold Snap",          description: "Lose 7 in a row",                             icon: "❄",  rarity: "Rare",      category: "Hidden",    hidden: true,  priority: 40, criteriaType: "LOSS_STREAK",      criteriaValue: 7,   engineType: "MATCH_EVENT",  secondaryCriteria: "CAREER_GAMES", secondaryValue: 20 },
  { key: "MYSTIC",            name: "🪬 Mystic",            description: "Unlock every hidden achievement",             icon: "🪬", rarity: "Mythic",    category: "Hidden",    hidden: true,  priority: 90, criteriaType: "ALL_HIDDEN_UNLOCKED", criteriaValue: 1, engineType: "STAT_BASED" },
];

export async function seedAchievements(): Promise<void> {
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    const [existing] = await db.select({ id: achievementsTable.id })
      .from(achievementsTable)
      .where(eq(achievementsTable.key, def.key));
    if (!existing) {
      await db.insert(achievementsTable).values({
        key:               def.key,
        name:              def.name,
        description:       def.description,
        icon:              def.icon,
        rarity:            def.rarity,
        category:          def.category,
        hidden:            def.hidden,
        priority:          def.priority,
        criteriaType:      def.criteriaType,
        criteriaValue:     def.criteriaValue,
        engineType:        def.engineType,
        secondaryCriteria: def.secondaryCriteria ?? null,
        secondaryValue:    def.secondaryValue ?? null,
      });
    }
  }
}

async function grantIfNotHas(playerId: number, key: string): Promise<boolean> {
  const [ach] = await db.select().from(achievementsTable).where(eq(achievementsTable.key, key));
  if (!ach) return false;
  const [existing] = await db.select({ id: playerAchievementsTable.id })
    .from(playerAchievementsTable)
    .where(and(
      eq(playerAchievementsTable.playerId, playerId),
      eq(playerAchievementsTable.achievementId, ach.id)
    ));
  if (existing) return false;
  await db.insert(playerAchievementsTable).values({ playerId, achievementId: ach.id });
  logger.info({ playerId, key }, "Achievement unlocked");
  return true;
}

export async function checkStatAchievements(playerId: number): Promise<void> {
  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
  if (!player) return;

  const wr = player.careerGamesPlayed > 0 ? (player.careerWins / player.careerGamesPlayed) * 100 : 0;

  if (player.careerGamesPlayed >= 1)   await grantIfNotHas(playerId, "FIGHTER");
  if (player.careerWins >= 1)          await grantIfNotHas(playerId, "FIRST_BLOOD");
  if (player.careerGamesPlayed >= 5)   await grantIfNotHas(playerId, "FIGHTER");
  if (player.careerGamesPlayed >= 10)  await grantIfNotHas(playerId, "WARMED_UP");
  if (player.careerGamesPlayed >= 25)  await grantIfNotHas(playerId, "DUELIST");
  if (player.careerGamesPlayed >= 50)  await grantIfNotHas(playerId, "VETERAN");
  if (player.careerGamesPlayed >= 75)  await grantIfNotHas(playerId, "PROFESSIONAL");
  if (player.careerGamesPlayed >= 100) await grantIfNotHas(playerId, "MARATHON");
  if (player.careerWins >= 10)         await grantIfNotHas(playerId, "BRONZE_BLOODED");
  if (player.careerWins >= 30)         await grantIfNotHas(playerId, "SILVER_STANDARD");
  if (player.careerWins >= 50)         await grantIfNotHas(playerId, "BREAKTHROUGH");
  if (player.careerWins >= 75)         await grantIfNotHas(playerId, "GOLDEN_ERA");
  if (player.careerWins >= 100)        { await grantIfNotHas(playerId, "IMMORTAL"); await grantIfNotHas(playerId, "SUPERSTAR"); }
  if (player.careerWins >= 200)        await grantIfNotHas(playerId, "HALL_OF_FAME");
  if (player.careerPoints >= 500)      await grantIfNotHas(playerId, "POINT_MASTER");
  if (player.careerPeakElo >= 1050)    await grantIfNotHas(playerId, "ELO_1050");
  if (player.careerPeakElo >= 1200)    { await grantIfNotHas(playerId, "ELO_1200"); await grantIfNotHas(playerId, "ASCENDED"); }
  if (player.careerPeakElo >= 1300)    await grantIfNotHas(playerId, "ELO_1300");

  if (player.careerGamesPlayed >= 10 && wr >= 60)  await grantIfNotHas(playerId, "BULLSEYE");
  if (player.careerGamesPlayed >= 20 && wr >= 70)  await grantIfNotHas(playerId, "PRECISION");
  if (player.careerGamesPlayed >= 30 && wr >= 75)  await grantIfNotHas(playerId, "SHARPSHOOTER_ACH");
  if (player.careerGamesPlayed >= 50 && wr >= 80)  await grantIfNotHas(playerId, "SNIPER");
  if (player.careerGamesPlayed >= 50 && wr >= 85)  { await grantIfNotHas(playerId, "UNTOUCHABLE"); await grantIfNotHas(playerId, "UNTOUCHABLE_PLUS"); }

  // Check total achievements
  const [{ total }] = await db.select({ total: count() }).from(playerAchievementsTable)
    .where(eq(playerAchievementsTable.playerId, playerId));
  if (total >= 10) await grantIfNotHas(playerId, "COLLECTOR");
  if (total >= 25) await grantIfNotHas(playerId, "DECORATED");
  if (total >= 50) await grantIfNotHas(playerId, "LEGEND");

  // Check LAST_MAN_STANDING — never eliminated career
  if (player.status !== "ELIMINATED" && player.careerGamesPlayed >= 5) {
    const standings = await db.select().from(seasonStandingsTable)
      .where(eq(seasonStandingsTable.playerId, playerId));
    const wasEliminated = standings.some(s => s.points === 0);
    if (!wasEliminated && standings.length > 0) {
      await grantIfNotHas(playerId, "LAST_MAN_STANDING");
    }
  }
}

export async function checkMatchAchievements(
  playerId: number,
  isWinner: boolean,
  stake: number,
  loserPointsBefore: number,
  winnerPointsBefore: number,
  loserEliminated: boolean
): Promise<void> {
  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
  if (!player) return;

  if (isWinner) {
    // Win streak based
    if (player.currentWinStreak >= 3)  await grantIfNotHas(playerId, "HEAT_CHECK");
    if (player.currentWinStreak >= 5)  await grantIfNotHas(playerId, "HOT_STREAK");
    if (player.currentWinStreak >= 7)  await grantIfNotHas(playerId, "RED_HOT");
    if (player.currentWinStreak >= 10) { await grantIfNotHas(playerId, "INFERNO"); await grantIfNotHas(playerId, "PERFECT_RUN"); }
    if (player.currentWinStreak >= 15) await grantIfNotHas(playerId, "WARPATH");

    // Stake based
    if (stake >= 10) await grantIfNotHas(playerId, "PAY_DAY");
    if (stake >= 25) await grantIfNotHas(playerId, "HIGH_ROLLER");

    // High stakes tracking — count from match history
    const highStakeWins = await db.select({ id: matchesTable.id }).from(matchesTable)
      .where(and(eq(matchesTable.winnerId, playerId), sql`${matchesTable.stake} >= 10`));
    if (highStakeWins.length >= 5)  await grantIfNotHas(playerId, "RISK_TAKER");
    if (highStakeWins.length >= 10) await grantIfNotHas(playerId, "GAMBLER");

    // Eliminator
    if (loserEliminated) {
      await grantIfNotHas(playerId, "ELIMINATOR");
      if (player.eliminationsCount >= 10) await grantIfNotHas(playerId, "NIGHTMARE");
    }

    // Upset win — winner had fewer points than loser before match
    if (winnerPointsBefore < loserPointsBefore) {
      await grantIfNotHas(playerId, "TACTICAL");
      const upsetWins = await db.select({ id: matchesTable.id }).from(matchesTable)
        .where(eq(matchesTable.winnerId, playerId));
      if (upsetWins.length >= 3) await grantIfNotHas(playerId, "GENIUS");
    }

    // Phoenix — win with only 1 point left (loser had 1 point before)
    if (loserPointsBefore <= 1) await grantIfNotHas(playerId, "PHOENIX");

    // Same opponent wins
    const allMatches = await db.select().from(matchesTable);
    const opponentCounts = new Map<number, number>();
    for (const m of allMatches) {
      if (m.winnerId === playerId) {
        opponentCounts.set(m.loserId, (opponentCounts.get(m.loserId) ?? 0) + 1);
      }
    }
    for (const [, cnt] of opponentCounts) {
      if (cnt >= 3) await grantIfNotHas(playerId, "TARGET_LOCKED");
      if (cnt >= 5) await grantIfNotHas(playerId, "SNAKE");
    }
  } else {
    // Loss streak
    if (player.currentLossStreak >= 7) await grantIfNotHas(playerId, "COLD_SNAP");
    // Frozen out — eliminated this season
    if (player.status === "ELIMINATED") await grantIfNotHas(playerId, "FROZEN_OUT");
  }

  await checkStatAchievements(playerId);
}

export async function checkSeasonAchievements(
  seasonId: number,
  sorted: { id: number; seasonWins: number; seasonLosses: number; seasonGamesPlayed: number; points: number; status: string; name: string }[],
  championId: number | null
): Promise<void> {
  if (sorted.length === 0) return;

  const champion = sorted[0];

  // Grant season champion achievements
  if (championId !== null) {
    await grantIfNotHas(championId, "CROWNED");
    await grantIfNotHas(championId, "MVP");

    // Dynasty — check if this player has 3 titles
    const prevTitles = await db.select().from(seasonStandingsTable)
      .where(and(eq(seasonStandingsTable.playerId, championId), eq(seasonStandingsTable.isChampion, true)));
    if (prevTitles.length >= 3) await grantIfNotHas(championId, "DYNASTY");
  }

  // Per-player seasonal checks
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];

    // Season points achievements
    if (p.points >= 75)  await grantIfNotHas(p.id, "CLIMBER");
    if (p.points >= 100) await grantIfNotHas(p.id, "SHOCKWAVE");
    if (p.points >= 200) await grantIfNotHas(p.id, "POINT_THIEF");

    // Top 3 finish
    if (i < 3) await grantIfNotHas(p.id, "UNBREAKABLE");

    // Season games
    if (p.seasonGamesPlayed >= 20) await grantIfNotHas(p.id, "SURVIVOR_ACH");
    if (p.seasonGamesPlayed >= 50) await grantIfNotHas(p.id, "MOST_ACTIVE");

    // Season wins
    if (p.seasonWins >= 15) await grantIfNotHas(p.id, "LONE_WOLF");
    if (p.seasonWins >= 20) await grantIfNotHas(p.id, "STORM_BRINGER");

    // Survived the season (not eliminated)
    if (p.status === "ACTIVE" && p.seasonGamesPlayed >= 10) {
      await grantIfNotHas(p.id, "ROCK_SOLID");
    }
    if (p.status === "ACTIVE" && p.seasonGamesPlayed >= 15) {
      await grantIfNotHas(p.id, "IRON_WALL");
    }
    if (p.status === "ACTIVE" && p.seasonGamesPlayed >= 20) {
      await grantIfNotHas(p.id, "FORTRESS");
    }

    // Eliminated this season
    if (p.status === "ELIMINATED") {
      await grantIfNotHas(p.id, "FROZEN_OUT");
    }
  }
}
