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
  criteriaType:
    | "TOTAL_DARTS"
    | "TOTAL_SESSIONS"
    | "GAME_MODES"
    | "BOT_LEVEL"
    | "TOTAL_180S"
    | "CHECKOUT_HITS"
    | "TOTAL_SCORE"
    | "CHECKOUT_ATTEMPTS"
    | "CHECKOUT_ACCURACY"
    | "GAME_FAMILY";
  criteriaValue: number;
  gameFilter?: string; // for GAME_FAMILY: exact game_type_key OR "FAM_<code>" for family aggregate
};

export function botLevelIndex(computedAvg: number): number {
  if (computedAvg >= 108) return 5;
  if (computedAvg >= 95)  return 4;
  if (computedAvg >= 80)  return 3;
  if (computedAvg >= 62)  return 2;
  if (computedAvg >= 45)  return 1;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper generators
// ─────────────────────────────────────────────────────────────────────────────

function famAch(
  family: string,
  n: number,
  name: string,
  desc: string,
  icon: string,
  rarity: ShadowBotAchievementDef["rarity"],
): ShadowBotAchievementDef {
  return {
    key: `BOT_FAM_${family}_${n}`,
    name: `${icon} ${name}`,
    description: desc,
    icon,
    rarity,
    criteriaType: "GAME_FAMILY",
    criteriaValue: n,
    gameFilter: `FAM_${family}`,
  };
}

function keyMatchesFamily(family: string, key: string): boolean {
  switch (family) {
    case "501":      return key.startsWith("501");
    case "301":      return key.startsWith("301");
    case "701PLUS":  return key.startsWith("701") || key.startsWith("1001") || key.startsWith("2001");
    case "X01":      return /^(501|301|701|1001|2001)/.test(key);
    case "CRICKET":  return key === "cricket" || key === "cricket_no_bull" || key === "cutthroat_cricket";
    case "KILLER":   return key.startsWith("killer");
    case "COUNTUP":  return key === "count_up" || key === "high_score" || key === "high_score_9";
    case "HALVEIT":  return key === "halve_it";
    case "GOLF":     return key.startsWith("golf");
    case "AROUND":   return ["around_the_world","around_world_trebles","around_clock_quick","chase_the_dragon","round_the_clock","round_clock_doubles","round_the_board"].includes(key);
    case "SHANGHAI": return key.startsWith("shanghai");
    case "TEAM":     return key.startsWith("team");
    case "FUN":      return ["football_darts","gotcha","tactics","scram","baseball","fives","bobs_27","bermuda_triangle","snooker_darts","noughts_crosses","accumulator","oche_roulette","shooting_gallery","sudden_death","bull_rush","dead_centre"].includes(key);
    case "CHALLENGE":return ["checkout_challenge","doubles_challenge","bull_finish","one_eighty_challenge","pick_a_double","jdc_challenge_41","three_in_a_bed","no_black","nearest_bull","double_or_nothing","legs","exponential_bundle"].includes(key);
    default:         return false;
  }
}

export function resolveGameFamilyCount(gameFilter: string, gameTypeMap: Map<string, number>): number {
  if (!gameFilter.startsWith("FAM_")) {
    return gameTypeMap.get(gameFilter) ?? 0;
  }
  const fam = gameFilter.slice(4);
  let total = 0;
  for (const [key, count] of gameTypeMap) {
    if (keyMatchesFamily(fam, key)) total += count;
  }
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-game-type "played at least once" achievements (75)
// ─────────────────────────────────────────────────────────────────────────────

const GAME_TYPE_PLAY_DEFS: ShadowBotAchievementDef[] = (
  [
    ["1001_double_out",    "1001 Double Out",          "🎯"],
    ["2001_double_out",    "2001 Double Out",          "🎯"],
    ["301_bo3",            "301 Best of 3",            "🎯"],
    ["301_double_in",      "301 Double In",            "🎯"],
    ["301_double_out",     "301 Double Out",           "🎯"],
    ["501_bo3",            "501 Best of 3",            "🎯"],
    ["501_bo5",            "501 Best of 5",            "🎯"],
    ["501_bo7",            "501 Best of 7",            "🎯"],
    ["501_double_in",      "501 Double In",            "🎯"],
    ["501_double_out",     "501 Double Out",           "🎯"],
    ["501_master_out",     "501 Master Out",           "🎯"],
    ["501_no_trebles",     "501 No Trebles",           "🎯"],
    ["501_straight_out",   "501 Straight Out",         "🎯"],
    ["501_treble_out",     "501 Treble Out",           "🎯"],
    ["701_bo3",            "701 Best of 3",            "🎯"],
    ["701_double_out",     "701 Double Out",           "🎯"],
    ["accumulator",        "Accumulator",              "🎰"],
    ["around_clock_quick", "Around the Clock (Quick)", "🌍"],
    ["around_the_world",   "Around the World",         "🌍"],
    ["around_world_trebles","Around the World Trebles","🌍"],
    ["baseball",           "Baseball Darts",           "⚾"],
    ["bermuda_triangle",   "Bermuda Triangle",         "🔺"],
    ["bobs_27",            "Bob's 27",                 "🎲"],
    ["bull_finish",        "Bull Finish",              "🎯"],
    ["bull_rush",          "Bull Rush",                "🐂"],
    ["chase_the_dragon",   "Chase the Dragon",         "🐉"],
    ["checkout_challenge", "Checkout Challenge",       "✅"],
    ["count_up",           "Count Up",                 "📈"],
    ["cricket",            "Cricket",                  "🏏"],
    ["cricket_no_bull",    "Cricket (No Bull)",        "🏏"],
    ["cutthroat_cricket",  "Cutthroat Cricket",        "🏏"],
    ["dead_centre",        "Dead Centre",              "🎯"],
    ["double_or_nothing",  "Double or Nothing",        "🎲"],
    ["doubles_challenge",  "Doubles Challenge",        "✌️"],
    ["exponential_bundle", "Exponential Bundle",       "📊"],
    ["fives",              "Fives",                    "5️⃣"],
    ["football_darts",     "Football Darts",           "⚽"],
    ["golf_darts",         "Golf Darts (9 Holes)",     "⛳"],
    ["golf_darts_18",      "Golf Darts (18 Holes)",    "⛳"],
    ["gotcha",             "Gotcha",                   "💥"],
    ["halve_it",           "Halve It",                 "✂️"],
    ["high_score",         "High Score",               "📈"],
    ["high_score_9",       "High Score 9",             "📈"],
    ["jdc_challenge_41",   "JDC Challenge 41",         "🏆"],
    ["killer",             "Killer",                   "💀"],
    ["killer_1_life",      "Killer (1 Life)",          "💀"],
    ["killer_3player",     "Killer (3 Player)",        "💀"],
    ["killer_4player",     "Killer (4 Player)",        "💀"],
    ["killer_5player",     "Killer (5 Player)",        "💀"],
    ["killer_6player",     "Killer (6 Player)",        "💀"],
    ["legs",               "Legs",                     "🦵"],
    ["nearest_bull",       "Nearest Bull",             "🎯"],
    ["no_black",           "No Black",                 "⬛"],
    ["noughts_crosses",    "Noughts & Crosses",        "❌"],
    ["oche_roulette",      "Oche Roulette",            "🎡"],
    ["one_eighty_challenge","180 Challenge",           "💯"],
    ["pairs_501",          "Pairs 501",                "👥"],
    ["pick_a_double",      "Pick a Double",            "🎯"],
    ["round_clock_doubles","Round the Clock (Doubles)","🕐"],
    ["round_the_board",    "Round the Board",          "🕐"],
    ["round_the_clock",    "Round the Clock",          "🕐"],
    ["scram",              "Scram",                    "🏃"],
    ["shanghai",           "Shanghai",                 "🀄"],
    ["shanghai_20",        "Shanghai 20",              "🀄"],
    ["shooting_gallery",   "Shooting Gallery",         "🔫"],
    ["snooker_darts",      "Snooker Darts",            "🎱"],
    ["sudden_death",       "Sudden Death",             "☠️"],
    ["tactics",            "Tactics",                  "🧠"],
    ["team_301_doubles",   "Team 301 Doubles",         "👥"],
    ["team_501_doubles",   "Team 501 Doubles",         "👥"],
    ["team_501_straight",  "Team 501 Straight",        "👥"],
    ["team_501_triples",   "Team 501 Triples",         "👥"],
    ["team_cricket_doubles","Team Cricket Doubles",    "👥"],
    ["team_cricket_triples","Team Cricket Triples",    "👥"],
    ["three_in_a_bed",     "Three in a Bed",           "🎯"],
  ] as [string, string, string][]
).map(([gameKey, gameName, icon]) => ({
  key: `BOT_PLAY_${gameKey.toUpperCase()}`,
  name: `${icon} First ${gameName}`,
  description: `Completed a practice session of ${gameName} for the first time. Variety is the spice of darts.`,
  icon,
  rarity: "Common" as const,
  criteriaType: "GAME_FAMILY" as const,
  criteriaValue: 1,
  gameFilter: gameKey,
}));

// ─────────────────────────────────────────────────────────────────────────────
// Main achievement definitions
// ─────────────────────────────────────────────────────────────────────────────

export const SHADOW_BOT_ACHIEVEMENT_DEFS: ShadowBotAchievementDef[] = [

  // ── TOTAL DARTS (35) ───────────────────────────────────────────────────────
  { key: "BOT_BOOTS_UP",       name: "🤖 Boots Up",            description: "Throw your first dart in practice. The journey begins.",                     icon: "🤖", rarity: "Common",    criteriaType: "TOTAL_DARTS",   criteriaValue: 1        },
  { key: "BOT_D_25",           name: "🎯 First Steps",          description: "25 darts thrown. You're warming up nicely.",                                 icon: "🎯", rarity: "Common",    criteriaType: "TOTAL_DARTS",   criteriaValue: 25       },
  { key: "BOT_D_50",           name: "🎯 Getting Going",        description: "50 darts. The oche is starting to feel familiar.",                           icon: "🎯", rarity: "Common",    criteriaType: "TOTAL_DARTS",   criteriaValue: 50       },
  { key: "BOT_100_DARTS",      name: "💯 100 Up",               description: "100 practice darts. Barely a warm-up.",                                      icon: "💯", rarity: "Common",    criteriaType: "TOTAL_DARTS",   criteriaValue: 100      },
  { key: "BOT_D_150",          name: "🎯 Finding a Rhythm",     description: "150 darts. Your release is developing.",                                     icon: "🎯", rarity: "Common",    criteriaType: "TOTAL_DARTS",   criteriaValue: 150      },
  { key: "BOT_D_200",          name: "🎯 Two Hundred",          description: "200 darts. Muscle memory is taking hold.",                                   icon: "🎯", rarity: "Common",    criteriaType: "TOTAL_DARTS",   criteriaValue: 200      },
  { key: "BOT_D_250",          name: "🎯 Quarter Grand",        description: "250 darts logged. Making it a habit.",                                       icon: "🎯", rarity: "Common",    criteriaType: "TOTAL_DARTS",   criteriaValue: 250      },
  { key: "BOT_D_300",          name: "🎯 Three Hundred",        description: "300 darts. Consistent practice is paying off.",                              icon: "🎯", rarity: "Common",    criteriaType: "TOTAL_DARTS",   criteriaValue: 300      },
  { key: "BOT_D_400",          name: "🎯 Four Hundred",         description: "400 darts. The bot is taking notes.",                                        icon: "🎯", rarity: "Common",    criteriaType: "TOTAL_DARTS",   criteriaValue: 400      },
  { key: "BOT_500_DARTS",      name: "🏋️ Training Hard",        description: "500 darts logged. Your bot is starting to learn.",                           icon: "🏋️", rarity: "Common",    criteriaType: "TOTAL_DARTS",   criteriaValue: 500      },
  { key: "BOT_D_600",          name: "🎯 Six Hundred",          description: "600 darts. Dedication rewarded.",                                            icon: "🎯", rarity: "Common",    criteriaType: "TOTAL_DARTS",   criteriaValue: 600      },
  { key: "BOT_D_750",          name: "🎯 Three Quarters",       description: "750 darts. Three quarters of a thousand strong.",                            icon: "🎯", rarity: "Common",    criteriaType: "TOTAL_DARTS",   criteriaValue: 750      },
  { key: "BOT_D_1K",           name: "💪 One Thousand",         description: "1,000 darts. A true milestone for any practitioner.",                        icon: "💪", rarity: "Rare",      criteriaType: "TOTAL_DARTS",   criteriaValue: 1000     },
  { key: "BOT_D_1250",         name: "🎯 Twelve Fifty",         description: "1,250 darts. You're building something solid.",                              icon: "🎯", rarity: "Rare",      criteriaType: "TOTAL_DARTS",   criteriaValue: 1250     },
  { key: "BOT_D_1500",         name: "🎯 Fifteen Hundred",      description: "1,500 darts. Halfway to your second thousand.",                              icon: "🎯", rarity: "Rare",      criteriaType: "TOTAL_DARTS",   criteriaValue: 1500     },
  { key: "BOT_2K_DARTS",       name: "⚙️ Getting Serious",      description: "2,000 darts. The bot's patterns are forming.",                               icon: "⚙️", rarity: "Rare",      criteriaType: "TOTAL_DARTS",   criteriaValue: 2000     },
  { key: "BOT_D_2500",         name: "🎯 Two and a Half K",     description: "2,500 darts. Serious commitment.",                                           icon: "🎯", rarity: "Rare",      criteriaType: "TOTAL_DARTS",   criteriaValue: 2500     },
  { key: "BOT_D_3K",           name: "🎯 Three Thousand",       description: "3,000 darts thrown in practice. Well into your stride.",                    icon: "🎯", rarity: "Rare",      criteriaType: "TOTAL_DARTS",   criteriaValue: 3000     },
  { key: "BOT_D_4K",           name: "🎯 Four Thousand",        description: "4,000 darts. Your bot shadow is well-trained.",                              icon: "🎯", rarity: "Rare",      criteriaType: "TOTAL_DARTS",   criteriaValue: 4000     },
  { key: "BOT_5K_DARTS",       name: "🧬 Data Rich",            description: "5,000 darts fed to the machine. Significant data.",                          icon: "🧬", rarity: "Rare",      criteriaType: "TOTAL_DARTS",   criteriaValue: 5000     },
  { key: "BOT_D_6K",           name: "🎯 Six Thousand",         description: "6,000 darts. Professional dedication.",                                      icon: "🎯", rarity: "Epic",      criteriaType: "TOTAL_DARTS",   criteriaValue: 6000     },
  { key: "BOT_D_7500",         name: "🎯 Seven Fifty",          description: "7,500 darts. Your average is climbing fast.",                                icon: "🎯", rarity: "Epic",      criteriaType: "TOTAL_DARTS",   criteriaValue: 7500     },
  { key: "BOT_D_10K",          name: "🔥 Ten Thousand",         description: "10,000 darts. You practise like a pro.",                                     icon: "🔥", rarity: "Epic",      criteriaType: "TOTAL_DARTS",   criteriaValue: 10000    },
  { key: "BOT_D_12500",        name: "🎯 Twelve and a Half K",  description: "12,500 darts. The oche is your second home.",                                icon: "🎯", rarity: "Epic",      criteriaType: "TOTAL_DARTS",   criteriaValue: 12500    },
  { key: "BOT_15K_DARTS",      name: "🔩 The Machine",          description: "15,000 darts. You practise like a professional.",                            icon: "🔩", rarity: "Epic",      criteriaType: "TOTAL_DARTS",   criteriaValue: 15000    },
  { key: "BOT_D_20K",          name: "🎯 Twenty Thousand",      description: "20,000 darts. Elite dedication.",                                            icon: "🎯", rarity: "Epic",      criteriaType: "TOTAL_DARTS",   criteriaValue: 20000    },
  { key: "BOT_D_25K",          name: "🎯 Quarter Century K",    description: "25,000 darts. You've earned every point of that average.",                   icon: "🎯", rarity: "Legendary", criteriaType: "TOTAL_DARTS",   criteriaValue: 25000    },
  { key: "BOT_D_35K",          name: "🎯 Thirty-Five K",        description: "35,000 darts. Most players won't get here in a lifetime.",                   icon: "🎯", rarity: "Legendary", criteriaType: "TOTAL_DARTS",   criteriaValue: 35000    },
  { key: "BOT_50K_DARTS",      name: "🔮 Oracle",               description: "50,000 darts. Your bot knows your game better than you do.",                 icon: "🔮", rarity: "Legendary", criteriaType: "TOTAL_DARTS",   criteriaValue: 50000    },
  { key: "BOT_D_75K",          name: "🎯 Seventy-Five K",       description: "75,000 darts. Verging on the incomprehensible.",                             icon: "🎯", rarity: "Legendary", criteriaType: "TOTAL_DARTS",   criteriaValue: 75000    },
  { key: "BOT_D_100K",         name: "🌟 Six Figures",          description: "100,000 practice darts. An extraordinary achievement.",                      icon: "🌟", rarity: "Legendary", criteriaType: "TOTAL_DARTS",   criteriaValue: 100000   },
  { key: "BOT_D_250K",         name: "🎯 Quarter Million",      description: "250,000 darts. You may need help.",                                          icon: "🎯", rarity: "Mythic",    criteriaType: "TOTAL_DARTS",   criteriaValue: 250000   },
  { key: "BOT_D_500K",         name: "🎯 Half a Million",       description: "500,000 darts. This is unprecedented.",                                      icon: "🎯", rarity: "Mythic",    criteriaType: "TOTAL_DARTS",   criteriaValue: 500000   },
  { key: "BOT_D_1M",           name: "🌌 One Million Darts",    description: "1,000,000 darts. A feat never witnessed before.",                            icon: "🌌", rarity: "Mythic",    criteriaType: "TOTAL_DARTS",   criteriaValue: 1000000  },
  { key: "BOT_D_5M",           name: "🪐 Five Million",         description: "5,000,000 darts. A number beyond comprehension.",                            icon: "🪐", rarity: "Mythic",    criteriaType: "TOTAL_DARTS",   criteriaValue: 5000000  },

  // ── TOTAL SESSIONS (28) ────────────────────────────────────────────────────
  { key: "BOT_FIRST_SESSION",  name: "🟢 Online",               description: "Complete your first practice session.",                                       icon: "🟢", rarity: "Common",    criteriaType: "TOTAL_SESSIONS", criteriaValue: 1        },
  { key: "BOT_S_2",            name: "🟢 Back Again",           description: "2 sessions. You came back. That's what matters.",                            icon: "🟢", rarity: "Common",    criteriaType: "TOTAL_SESSIONS", criteriaValue: 2        },
  { key: "BOT_S_3",            name: "🟢 Three's a Habit",      description: "3 sessions. A habit is forming.",                                            icon: "🟢", rarity: "Common",    criteriaType: "TOTAL_SESSIONS", criteriaValue: 3        },
  { key: "BOT_5_SESSIONS",     name: "☕ Warmed Up",             description: "5 sessions done. You're finding your rhythm.",                               icon: "☕", rarity: "Common",    criteriaType: "TOTAL_SESSIONS", criteriaValue: 5        },
  { key: "BOT_S_7",            name: "📅 Seven Sessions",        description: "7 sessions. A full week's worth of practice.",                               icon: "📅", rarity: "Common",    criteriaType: "TOTAL_SESSIONS", criteriaValue: 7        },
  { key: "BOT_S_10",           name: "🔟 Double Digits",        description: "10 sessions. Into the double figures.",                                      icon: "🔟", rarity: "Common",    criteriaType: "TOTAL_SESSIONS", criteriaValue: 10       },
  { key: "BOT_S_12",           name: "📅 Dozen Sessions",        description: "12 sessions. A month of practice if you go three times a week.",            icon: "📅", rarity: "Common",    criteriaType: "TOTAL_SESSIONS", criteriaValue: 12       },
  { key: "BOT_S_15",           name: "📅 Fifteen Up",            description: "15 sessions. Consistently showing up.",                                     icon: "📅", rarity: "Common",    criteriaType: "TOTAL_SESSIONS", criteriaValue: 15       },
  { key: "BOT_20_SESSIONS",    name: "📅 Regular",               description: "20 sessions. You're a regular on the practice oche.",                       icon: "📅", rarity: "Rare",      criteriaType: "TOTAL_SESSIONS", criteriaValue: 20       },
  { key: "BOT_S_25",           name: "📅 Twenty-Five",           description: "25 sessions. Quarter of a century in the books.",                           icon: "📅", rarity: "Rare",      criteriaType: "TOTAL_SESSIONS", criteriaValue: 25       },
  { key: "BOT_S_30",           name: "📅 Thirty Sessions",       description: "30 sessions. The practice is becoming second nature.",                      icon: "📅", rarity: "Rare",      criteriaType: "TOTAL_SESSIONS", criteriaValue: 30       },
  { key: "BOT_S_40",           name: "📅 Forty Sessions",        description: "40 sessions. Closing in on fifty.",                                         icon: "📅", rarity: "Rare",      criteriaType: "TOTAL_SESSIONS", criteriaValue: 40       },
  { key: "BOT_50_SESSIONS",    name: "💪 Dedicated",             description: "50 practice sessions. Seriously committed to your craft.",                  icon: "💪", rarity: "Rare",      criteriaType: "TOTAL_SESSIONS", criteriaValue: 50       },
  { key: "BOT_S_60",           name: "📅 Sixty Sessions",        description: "60 sessions. No fluke — this is genuine dedication.",                       icon: "📅", rarity: "Rare",      criteriaType: "TOTAL_SESSIONS", criteriaValue: 60       },
  { key: "BOT_S_75",           name: "📅 Seventy-Five",          description: "75 sessions. Three quarters of a hundred.",                                 icon: "📅", rarity: "Rare",      criteriaType: "TOTAL_SESSIONS", criteriaValue: 75       },
  { key: "BOT_100_SESSIONS",   name: "👑 Practice Legend",       description: "100 sessions. A true student of the game.",                                 icon: "👑", rarity: "Epic",      criteriaType: "TOTAL_SESSIONS", criteriaValue: 100      },
  { key: "BOT_S_125",          name: "📅 One-Twenty-Five",       description: "125 sessions. Pacing into elite territory.",                                icon: "📅", rarity: "Epic",      criteriaType: "TOTAL_SESSIONS", criteriaValue: 125      },
  { key: "BOT_S_150",          name: "📅 One-Fifty",             description: "150 sessions. The equivalent of a year of serious weekly practice.",        icon: "📅", rarity: "Epic",      criteriaType: "TOTAL_SESSIONS", criteriaValue: 150      },
  { key: "BOT_S_175",          name: "📅 One-Seventy-Five",      description: "175 sessions. So close to two hundred.",                                    icon: "📅", rarity: "Epic",      criteriaType: "TOTAL_SESSIONS", criteriaValue: 175      },
  { key: "BOT_200_SESSIONS",   name: "🌀 No Life",               description: "200 practice sessions. The oche is your second home.",                      icon: "🌀", rarity: "Epic",      criteriaType: "TOTAL_SESSIONS", criteriaValue: 200      },
  { key: "BOT_S_250",          name: "🌀 Two-Fifty",             description: "250 sessions. This level of commitment is extraordinary.",                  icon: "🌀", rarity: "Legendary", criteriaType: "TOTAL_SESSIONS", criteriaValue: 250      },
  { key: "BOT_S_300",          name: "🌀 Three Hundred",         description: "300 sessions. You practise more than some pros.",                           icon: "🌀", rarity: "Legendary", criteriaType: "TOTAL_SESSIONS", criteriaValue: 300      },
  { key: "BOT_S_400",          name: "🌀 Four Hundred",          description: "400 sessions. Legendary dedication.",                                       icon: "🌀", rarity: "Legendary", criteriaType: "TOTAL_SESSIONS", criteriaValue: 400      },
  { key: "BOT_S_500",          name: "🌀 Five Hundred",          description: "500 sessions. Half a thousand. Unreal.",                                    icon: "🌀", rarity: "Legendary", criteriaType: "TOTAL_SESSIONS", criteriaValue: 500      },
  { key: "BOT_S_750",          name: "🌀 Seven-Fifty",           description: "750 sessions. Three quarters of a thousand.",                               icon: "🌀", rarity: "Mythic",    criteriaType: "TOTAL_SESSIONS", criteriaValue: 750      },
  { key: "BOT_S_1000",         name: "🌀 Grand of Sessions",     description: "1,000 practice sessions. A number that defies belief.",                     icon: "🌀", rarity: "Mythic",    criteriaType: "TOTAL_SESSIONS", criteriaValue: 1000     },
  { key: "BOT_S_1500",         name: "🌀 Fifteen Hundred",       description: "1,500 sessions. There are no words.",                                       icon: "🌀", rarity: "Mythic",    criteriaType: "TOTAL_SESSIONS", criteriaValue: 1500     },
  { key: "BOT_S_2000",         name: "🌀 Two Thousand",          description: "2,000 sessions. A feat for the ages.",                                      icon: "🌀", rarity: "Mythic",    criteriaType: "TOTAL_SESSIONS", criteriaValue: 2000     },

  // ── BOT LEVEL (5) ─────────────────────────────────────────────────────────
  { key: "BOT_AMATEUR",        name: "🎯 Amateur Bot",           description: "Your bot now plays at Amateur level (avg 45+). It's learning.",             icon: "🎯", rarity: "Common",    criteriaType: "BOT_LEVEL",      criteriaValue: 1        },
  { key: "BOT_CLUB",           name: "🔵 Club Bot",              description: "Club Player accuracy unlocked (avg 62+). A proper challenge.",              icon: "🔵", rarity: "Rare",      criteriaType: "BOT_LEVEL",      criteriaValue: 2        },
  { key: "BOT_COUNTY",         name: "🟣 County Bot",            description: "County standard reached (avg 80+). Most players can't beat this.",          icon: "🟣", rarity: "Epic",      criteriaType: "BOT_LEVEL",      criteriaValue: 3        },
  { key: "BOT_PRO",            name: "🟡 Pro Bot",               description: "Pro Tour accuracy (avg 95+). An elite training partner.",                   icon: "🟡", rarity: "Legendary", criteriaType: "BOT_LEVEL",      criteriaValue: 4        },
  { key: "BOT_ELITE",          name: "🔴 Elite Bot",             description: "Elite level reached (avg 108+). You've built a world-class shadow.",        icon: "🔴", rarity: "Mythic",    criteriaType: "BOT_LEVEL",      criteriaValue: 5        },

  // ── TOTAL 180s (22) ───────────────────────────────────────────────────────
  { key: "BOT_FIRST_180",      name: "💥 MAXIMUM!",              description: "Hit your first 180 in practice. The crowd erupts.",                         icon: "💥", rarity: "Common",    criteriaType: "TOTAL_180S",     criteriaValue: 1        },
  { key: "BOT_180_2",          name: "💥 Two Maximums",          description: "2 x 180s. Beginning to find that triple twenty.",                           icon: "💥", rarity: "Common",    criteriaType: "TOTAL_180S",     criteriaValue: 2        },
  { key: "BOT_180_3",          name: "💥 Hat Trick Max",         description: "3 x 180s. A hat trick of maximums.",                                        icon: "💥", rarity: "Common",    criteriaType: "TOTAL_180S",     criteriaValue: 3        },
  { key: "BOT_180_5",          name: "💥 Five Maximums",         description: "5 x 180s. This is becoming a trend.",                                       icon: "💥", rarity: "Common",    criteriaType: "TOTAL_180S",     criteriaValue: 5        },
  { key: "BOT_180_7",          name: "💥 Lucky Seven",           description: "7 x 180s thrown in practice. Red hot.",                                     icon: "💥", rarity: "Common",    criteriaType: "TOTAL_180S",     criteriaValue: 7        },
  { key: "BOT_TEN_180S",       name: "🔟 Ton Plus Club",         description: "10 maximums thrown. You're regularly scoring perfect visits.",              icon: "🔟", rarity: "Rare",      criteriaType: "TOTAL_180S",     criteriaValue: 10       },
  { key: "BOT_180_15",         name: "💥 Fifteen Maximums",      description: "15 x 180s. Treble twenty is your friend.",                                  icon: "💥", rarity: "Rare",      criteriaType: "TOTAL_180S",     criteriaValue: 15       },
  { key: "BOT_180_20",         name: "💥 Twenty Maximums",       description: "20 x 180s. Elite scoring is becoming routine.",                             icon: "💥", rarity: "Rare",      criteriaType: "TOTAL_180S",     criteriaValue: 20       },
  { key: "BOT_180_25",         name: "💥 Twenty-Five Maximums",  description: "25 x 180s. One in four practice visits is perfect.",                        icon: "💥", rarity: "Rare",      criteriaType: "TOTAL_180S",     criteriaValue: 25       },
  { key: "BOT_180_30",         name: "💥 Thirty Maximums",       description: "30 x 180s. Consistent maximum scoring.",                                    icon: "💥", rarity: "Rare",      criteriaType: "TOTAL_180S",     criteriaValue: 30       },
  { key: "BOT_50_180S",        name: "🏭 180 Machine",           description: "50 x 180s. Your treble-twenty scoring is elite.",                           icon: "🏭", rarity: "Epic",      criteriaType: "TOTAL_180S",     criteriaValue: 50       },
  { key: "BOT_180_75",         name: "💥 Seventy-Five Maxes",    description: "75 x 180s. Three figures in sight.",                                        icon: "💥", rarity: "Epic",      criteriaType: "TOTAL_180S",     criteriaValue: 75       },
  { key: "BOT_100_180S",       name: "🌟 180 Legend",            description: "100 maximums. A century of perfection.",                                    icon: "🌟", rarity: "Epic",      criteriaType: "TOTAL_180S",     criteriaValue: 100      },
  { key: "BOT_180_150",        name: "💥 One-Fifty Maxes",       description: "150 x 180s. You could throw a 180 in your sleep.",                          icon: "💥", rarity: "Epic",      criteriaType: "TOTAL_180S",     criteriaValue: 150      },
  { key: "BOT_180_200",        name: "💥 Two Hundred Maxes",     description: "200 x 180s. Absolutely remarkable.",                                        icon: "💥", rarity: "Legendary", criteriaType: "TOTAL_180S",     criteriaValue: 200      },
  { key: "BOT_180_300",        name: "💥 Three Hundred Maxes",   description: "300 x 180s. Elite-level maximum scoring.",                                  icon: "💥", rarity: "Legendary", criteriaType: "TOTAL_180S",     criteriaValue: 300      },
  { key: "BOT_500_180S",       name: "♾️ Maximum Maximum",        description: "500 x 180s in practice. Absolutely unprecedented.",                         icon: "♾️", rarity: "Legendary", criteriaType: "TOTAL_180S",     criteriaValue: 500      },
  { key: "BOT_180_750",        name: "💥 Seven-Fifty Maxes",     description: "750 x 180s. Treble twenty is nothing but a formality.",                     icon: "💥", rarity: "Mythic",    criteriaType: "TOTAL_180S",     criteriaValue: 750      },
  { key: "BOT_180_1K",         name: "💥 Thousand Maximums",     description: "1,000 x 180s. A thousand perfect three-dart visits.",                       icon: "💥", rarity: "Mythic",    criteriaType: "TOTAL_180S",     criteriaValue: 1000     },
  { key: "BOT_180_2K",         name: "💥 Two Thousand Maxes",    description: "2,000 x 180s. Superhuman scoring.",                                         icon: "💥", rarity: "Mythic",    criteriaType: "TOTAL_180S",     criteriaValue: 2000     },
  { key: "BOT_180_5K",         name: "💥 Five Thousand Maxes",   description: "5,000 x 180s. A figure nobody will ever beat.",                             icon: "💥", rarity: "Mythic",    criteriaType: "TOTAL_180S",     criteriaValue: 5000     },
  { key: "BOT_180_10K",        name: "💥 Ten Thousand Maxes",    description: "10,000 x 180s. The record is safe from the rest of humanity.",              icon: "💥", rarity: "Mythic",    criteriaType: "TOTAL_180S",     criteriaValue: 10000    },

  // ── CHECKOUT HITS (22) ────────────────────────────────────────────────────
  { key: "BOT_FIRST_FINISH",   name: "✅ First Finish",           description: "Hit your first checkout in practice. Every champion starts here.",          icon: "✅", rarity: "Common",    criteriaType: "CHECKOUT_HITS",  criteriaValue: 1        },
  { key: "BOT_CH_2",           name: "✅ Double Take",            description: "2 checkouts. Fool me once, shame on me. Fool me twice — nice finish.",      icon: "✅", rarity: "Common",    criteriaType: "CHECKOUT_HITS",  criteriaValue: 2        },
  { key: "BOT_CH_3",           name: "✅ Hat Trick of Finishes",  description: "3 checkouts landed. A hat trick of doubles.",                               icon: "✅", rarity: "Common",    criteriaType: "CHECKOUT_HITS",  criteriaValue: 3        },
  { key: "BOT_CH_5",           name: "✅ Five Finishes",          description: "5 checkouts. The double board is no longer your enemy.",                    icon: "✅", rarity: "Common",    criteriaType: "CHECKOUT_HITS",  criteriaValue: 5        },
  { key: "BOT_CH_7",           name: "✅ Lucky Seven",            description: "7 checkouts. Lucky seven on the doubles.",                                  icon: "✅", rarity: "Common",    criteriaType: "CHECKOUT_HITS",  criteriaValue: 7        },
  { key: "BOT_CH_10",          name: "✅ Ten Checkouts",          description: "10 checkouts hit in practice. Getting clinical.",                           icon: "✅", rarity: "Common",    criteriaType: "CHECKOUT_HITS",  criteriaValue: 10       },
  { key: "BOT_CH_15",          name: "✅ Fifteen Finishes",       description: "15 checkouts. The double feels like a single-target now.",                  icon: "✅", rarity: "Rare",      criteriaType: "CHECKOUT_HITS",  criteriaValue: 15       },
  { key: "BOT_CH_20",          name: "✅ Twenty Finishes",        description: "20 checkouts landed. A serious finisher in the making.",                    icon: "✅", rarity: "Rare",      criteriaType: "CHECKOUT_HITS",  criteriaValue: 20       },
  { key: "BOT_25_FINISHES",    name: "🎯 Clinical",               description: "25 checkouts hit. You know your way around the doubles.",                   icon: "🎯", rarity: "Rare",      criteriaType: "CHECKOUT_HITS",  criteriaValue: 25       },
  { key: "BOT_CH_30",          name: "✅ Thirty Finishes",        description: "30 checkouts. Three dozen doubles dusted.",                                 icon: "✅", rarity: "Rare",      criteriaType: "CHECKOUT_HITS",  criteriaValue: 30       },
  { key: "BOT_CH_50",          name: "✅ Fifty Finishes",         description: "50 checkouts. Half a century of doubles landed.",                           icon: "✅", rarity: "Rare",      criteriaType: "CHECKOUT_HITS",  criteriaValue: 50       },
  { key: "BOT_CH_75",          name: "✅ Seventy-Five Finishes",  description: "75 checkouts. Three quarters of a century.",                                icon: "✅", rarity: "Epic",      criteriaType: "CHECKOUT_HITS",  criteriaValue: 75       },
  { key: "BOT_100_FINISHES",   name: "🖼️ Checkout Artist",        description: "100 checkouts. A genuine finishing threat.",                                icon: "🖼️", rarity: "Epic",      criteriaType: "CHECKOUT_HITS",  criteriaValue: 100      },
  { key: "BOT_CH_150",         name: "✅ One-Fifty Finishes",     description: "150 checkouts. The double is your canvas.",                                 icon: "✅", rarity: "Epic",      criteriaType: "CHECKOUT_HITS",  criteriaValue: 150      },
  { key: "BOT_CH_200",         name: "✅ Two Hundred Finishes",   description: "200 checkouts. World-class finishing accuracy.",                            icon: "✅", rarity: "Epic",      criteriaType: "CHECKOUT_HITS",  criteriaValue: 200      },
  { key: "BOT_CH_300",         name: "✅ Three Hundred Finishes", description: "300 checkouts. This is an art form.",                                       icon: "✅", rarity: "Legendary", criteriaType: "CHECKOUT_HITS",  criteriaValue: 300      },
  { key: "BOT_500_FINISHES",   name: "👑 Checkout King",          description: "500 checkouts landed. The double is your domain.",                          icon: "👑", rarity: "Legendary", criteriaType: "CHECKOUT_HITS",  criteriaValue: 500      },
  { key: "BOT_CH_750",         name: "✅ Seven-Fifty Finishes",   description: "750 checkouts. An absolute finishing machine.",                             icon: "✅", rarity: "Legendary", criteriaType: "CHECKOUT_HITS",  criteriaValue: 750      },
  { key: "BOT_CH_1K",          name: "✅ Thousand Finishes",      description: "1,000 checkouts. One thousand times you've won a leg with a double.",       icon: "✅", rarity: "Legendary", criteriaType: "CHECKOUT_HITS",  criteriaValue: 1000     },
  { key: "BOT_CH_2K",          name: "✅ Two Thousand Finishes",  description: "2,000 checkouts. Doubles are second nature.",                               icon: "✅", rarity: "Mythic",    criteriaType: "CHECKOUT_HITS",  criteriaValue: 2000     },
  { key: "BOT_CH_5K",          name: "✅ Five Thousand Finishes", description: "5,000 checkouts. An all-time great of the doubles board.",                  icon: "✅", rarity: "Mythic",    criteriaType: "CHECKOUT_HITS",  criteriaValue: 5000     },
  { key: "BOT_CH_10K",         name: "✅ Ten Thousand Finishes",  description: "10,000 checkouts. The most prolific finisher in recorded history.",         icon: "✅", rarity: "Mythic",    criteriaType: "CHECKOUT_HITS",  criteriaValue: 10000    },

  // ── CHECKOUT ATTEMPTS (15) ────────────────────────────────────────────────
  { key: "BOT_CA_1",           name: "🎯 First Attempt",         description: "Stepped up to check out for the first time. The nerves are real.",          icon: "🎯", rarity: "Common",    criteriaType: "CHECKOUT_ATTEMPTS", criteriaValue: 1     },
  { key: "BOT_CA_5",           name: "🎯 Five Attempts",         description: "5 checkout attempts. Getting comfortable under pressure.",                   icon: "🎯", rarity: "Common",    criteriaType: "CHECKOUT_ATTEMPTS", criteriaValue: 5     },
  { key: "BOT_CA_10",          name: "🎯 Ten Attempts",          description: "10 checkout attempts. Plenty of chances, plenty of lessons.",               icon: "🎯", rarity: "Common",    criteriaType: "CHECKOUT_ATTEMPTS", criteriaValue: 10    },
  { key: "BOT_CA_20",          name: "🎯 Twenty Attempts",       description: "20 checkout attempts. You're in the checkout zone regularly.",              icon: "🎯", rarity: "Common",    criteriaType: "CHECKOUT_ATTEMPTS", criteriaValue: 20    },
  { key: "BOT_CA_30",          name: "🎯 Thirty Attempts",       description: "30 checkout attempts. Getting many chances at the finish.",                 icon: "🎯", rarity: "Rare",      criteriaType: "CHECKOUT_ATTEMPTS", criteriaValue: 30    },
  { key: "BOT_CA_50",          name: "🎯 Fifty Attempts",        description: "50 checkout attempts. Half a century of checkout opportunities.",           icon: "🎯", rarity: "Rare",      criteriaType: "CHECKOUT_ATTEMPTS", criteriaValue: 50    },
  { key: "BOT_CA_75",          name: "🎯 Seventy-Five",          description: "75 checkout attempts. Every attempt is a learning experience.",             icon: "🎯", rarity: "Rare",      criteriaType: "CHECKOUT_ATTEMPTS", criteriaValue: 75    },
  { key: "BOT_CA_100",         name: "🎯 Century of Attempts",   description: "100 checkout attempts. A hundred shots at glory.",                          icon: "🎯", rarity: "Rare",      criteriaType: "CHECKOUT_ATTEMPTS", criteriaValue: 100   },
  { key: "BOT_CA_150",         name: "🎯 One-Fifty Attempts",    description: "150 checkout attempts. Consistently getting to the finish.",                icon: "🎯", rarity: "Epic",      criteriaType: "CHECKOUT_ATTEMPTS", criteriaValue: 150   },
  { key: "BOT_CA_200",         name: "🎯 Two Hundred Attempts",  description: "200 checkout attempts. A prolific scorer reaching the finish.",             icon: "🎯", rarity: "Epic",      criteriaType: "CHECKOUT_ATTEMPTS", criteriaValue: 200   },
  { key: "BOT_CA_300",         name: "🎯 Three Hundred Attempts", description: "300 checkout attempts. Three hundred chances at the double.",            icon: "🎯", rarity: "Epic",      criteriaType: "CHECKOUT_ATTEMPTS", criteriaValue: 300   },
  { key: "BOT_CA_500",         name: "🎯 Five Hundred Attempts", description: "500 checkout attempts. Elite scoring output.",                              icon: "🎯", rarity: "Legendary", criteriaType: "CHECKOUT_ATTEMPTS", criteriaValue: 500   },
  { key: "BOT_CA_1K",          name: "🎯 Thousand Attempts",     description: "1,000 checkout attempts. Reaching the finish line is routine.",             icon: "🎯", rarity: "Legendary", criteriaType: "CHECKOUT_ATTEMPTS", criteriaValue: 1000  },
  { key: "BOT_CA_2500",        name: "🎯 Two-Fifty Attempts",    description: "2,500 checkout attempts. You're constantly in the hunt.",                   icon: "🎯", rarity: "Mythic",    criteriaType: "CHECKOUT_ATTEMPTS", criteriaValue: 2500  },
  { key: "BOT_CA_5K",          name: "🎯 Five Thousand Attempts", description: "5,000 checkout attempts. A lifetime of finishing practice.",             icon: "🎯", rarity: "Mythic",    criteriaType: "CHECKOUT_ATTEMPTS", criteriaValue: 5000  },

  // ── GAME MODES (15) ───────────────────────────────────────────────────────
  { key: "BOT_GM_1",           name: "🎮 First Format",          description: "Practised your first game format. Get exploring.",                          icon: "🎮", rarity: "Common",    criteriaType: "GAME_MODES",     criteriaValue: 1        },
  { key: "BOT_GM_2",           name: "🎮 Two Formats",           description: "2 different game formats played.",                                          icon: "🎮", rarity: "Common",    criteriaType: "GAME_MODES",     criteriaValue: 2        },
  { key: "BOT_VERSATILE",      name: "🎮 Versatile",             description: "Train your bot in 3 different game modes. Broaden your game.",              icon: "🎮", rarity: "Common",    criteriaType: "GAME_MODES",     criteriaValue: 3        },
  { key: "BOT_GM_5",           name: "🎮 Five Formats",          description: "5 game formats explored. A well-rounded practitioner.",                     icon: "🎮", rarity: "Common",    criteriaType: "GAME_MODES",     criteriaValue: 5        },
  { key: "BOT_ALL_ROUNDER",    name: "🌐 All-Rounder",           description: "7 game modes mastered. You don't have a weak format.",                     icon: "🌐", rarity: "Rare",      criteriaType: "GAME_MODES",     criteriaValue: 7        },
  { key: "BOT_GM_10",          name: "🎮 Ten Formats",           description: "10 game formats practised. A genuine format explorer.",                     icon: "🎮", rarity: "Rare",      criteriaType: "GAME_MODES",     criteriaValue: 10       },
  { key: "BOT_POLYMATH",       name: "🧠 Polymath",              description: "12 different game modes. A genuine format expert.",                         icon: "🧠", rarity: "Rare",      criteriaType: "GAME_MODES",     criteriaValue: 12       },
  { key: "BOT_GM_15",          name: "🎮 Fifteen Formats",       description: "15 game formats explored. No format left untouched.",                      icon: "🎮", rarity: "Epic",      criteriaType: "GAME_MODES",     criteriaValue: 15       },
  { key: "BOT_FORMAT_MASTER",  name: "⚡ Format Master",          description: "20 game modes in the training log. Unmatched versatility.",                icon: "⚡", rarity: "Epic",      criteriaType: "GAME_MODES",     criteriaValue: 20       },
  { key: "BOT_GM_25",          name: "🎮 Twenty-Five Formats",   description: "25 game formats. A quarter of the full catalogue.",                         icon: "🎮", rarity: "Epic",      criteriaType: "GAME_MODES",     criteriaValue: 25       },
  { key: "BOT_GM_30",          name: "🎮 Thirty Formats",        description: "30 game formats. Nearly half of everything available.",                     icon: "🎮", rarity: "Epic",      criteriaType: "GAME_MODES",     criteriaValue: 30       },
  { key: "BOT_GM_40",          name: "🎮 Forty Formats",         description: "40 game formats. You've been everywhere on the dartboard.",                 icon: "🎮", rarity: "Legendary", criteriaType: "GAME_MODES",     criteriaValue: 40       },
  { key: "BOT_GM_50",          name: "🎮 Fifty Formats",         description: "50 game formats. Over halfway through the complete catalogue.",             icon: "🎮", rarity: "Legendary", criteriaType: "GAME_MODES",     criteriaValue: 50       },
  { key: "BOT_GM_62",          name: "🎮 Almost Everything",     description: "62 game formats. The vast majority of the format catalogue explored.",      icon: "🎮", rarity: "Legendary", criteriaType: "GAME_MODES",     criteriaValue: 62       },
  { key: "BOT_GM_ALL",         name: "🌌 Format Completionist",  description: "Every single game format practised. The complete collection.",              icon: "🌌", rarity: "Mythic",    criteriaType: "GAME_MODES",     criteriaValue: 75       },

  // ── TOTAL SCORE (28) ──────────────────────────────────────────────────────
  { key: "BOT_SC_100",         name: "💰 First Hundred",         description: "100 total practice score. It begins.",                                      icon: "💰", rarity: "Common",    criteriaType: "TOTAL_SCORE",    criteriaValue: 100      },
  { key: "BOT_SC_250",         name: "💰 Two-Fifty",             description: "250 total score. Scoring nicely.",                                          icon: "💰", rarity: "Common",    criteriaType: "TOTAL_SCORE",    criteriaValue: 250      },
  { key: "BOT_SC_500",         name: "💰 Five Hundred",          description: "500 total score. Half a thousand on the board.",                            icon: "💰", rarity: "Common",    criteriaType: "TOTAL_SCORE",    criteriaValue: 500      },
  { key: "BOT_SC_1K",          name: "💰 One Thousand",          description: "1,000 total practice score. Four figures.",                                 icon: "💰", rarity: "Common",    criteriaType: "TOTAL_SCORE",    criteriaValue: 1000     },
  { key: "BOT_SC_1500",        name: "💰 Fifteen Hundred",       description: "1,500 total score. Scores are mounting up.",                                icon: "💰", rarity: "Common",    criteriaType: "TOTAL_SCORE",    criteriaValue: 1500     },
  { key: "BOT_SC_2K",          name: "💰 Two Thousand",          description: "2,000 total score. Consistent scoring.",                                    icon: "💰", rarity: "Common",    criteriaType: "TOTAL_SCORE",    criteriaValue: 2000     },
  { key: "BOT_SC_2500",        name: "💰 Two and a Half K",      description: "2,500 total score. Solid practice output.",                                 icon: "💰", rarity: "Common",    criteriaType: "TOTAL_SCORE",    criteriaValue: 2500     },
  { key: "BOT_SC_3K",          name: "💰 Three Thousand",        description: "3,000 total score. Your scoring is taking shape.",                          icon: "💰", rarity: "Rare",      criteriaType: "TOTAL_SCORE",    criteriaValue: 3000     },
  { key: "BOT_SC_5K",          name: "💰 Five Grand",            description: "5,000 total practice score. Five figures on the horizon.",                  icon: "💰", rarity: "Rare",      criteriaType: "TOTAL_SCORE",    criteriaValue: 5000     },
  { key: "BOT_SC_7500",        name: "💰 Seven-Fifty",           description: "7,500 total score. Three quarters of ten grand.",                          icon: "💰", rarity: "Rare",      criteriaType: "TOTAL_SCORE",    criteriaValue: 7500     },
  { key: "BOT_10K_SCORE",      name: "💰 Point Scorer",          description: "10,000 total practice score. The numbers are adding up.",                   icon: "💰", rarity: "Rare",      criteriaType: "TOTAL_SCORE",    criteriaValue: 10000    },
  { key: "BOT_SC_15K",         name: "💰 Fifteen Grand",         description: "15,000 total score. Serious scoring.",                                      icon: "💰", rarity: "Rare",      criteriaType: "TOTAL_SCORE",    criteriaValue: 15000    },
  { key: "BOT_SC_25K",         name: "💰 Twenty-Five K",         description: "25,000 total score. A quarter century of thousands.",                       icon: "💰", rarity: "Epic",      criteriaType: "TOTAL_SCORE",    criteriaValue: 25000    },
  { key: "BOT_SC_50K",         name: "💰 Fifty Thousand",        description: "50,000 total score. Elite scoring output.",                                 icon: "💰", rarity: "Epic",      criteriaType: "TOTAL_SCORE",    criteriaValue: 50000    },
  { key: "BOT_SC_75K",         name: "💰 Seventy-Five K",        description: "75,000 total score. Three quarters of a hundred thousand.",                 icon: "💰", rarity: "Epic",      criteriaType: "TOTAL_SCORE",    criteriaValue: 75000    },
  { key: "BOT_100K_SCORE",     name: "💎 Six Figures",           description: "100,000 total practice score. An impressive milestone.",                    icon: "💎", rarity: "Epic",      criteriaType: "TOTAL_SCORE",    criteriaValue: 100000   },
  { key: "BOT_SC_150K",        name: "💎 One-Fifty K",           description: "150,000 total score. Extraordinary practice output.",                       icon: "💎", rarity: "Epic",      criteriaType: "TOTAL_SCORE",    criteriaValue: 150000   },
  { key: "BOT_SC_250K",        name: "💎 Quarter Million",       description: "250,000 total score. A quarter of a million.",                              icon: "💎", rarity: "Legendary", criteriaType: "TOTAL_SCORE",    criteriaValue: 250000   },
  { key: "BOT_SC_500K",        name: "💎 Half a Million",        description: "500,000 total score. Half way to a million.",                               icon: "💎", rarity: "Legendary", criteriaType: "TOTAL_SCORE",    criteriaValue: 500000   },
  { key: "BOT_1M_SCORE",       name: "🏦 Millionaire",           description: "1,000,000 points scored in practice. Legendary dedication.",                icon: "🏦", rarity: "Legendary", criteriaType: "TOTAL_SCORE",    criteriaValue: 1000000  },
  { key: "BOT_SC_2500K",       name: "🏦 Two and a Half M",      description: "2,500,000 total score. Wealth beyond measure.",                             icon: "🏦", rarity: "Legendary", criteriaType: "TOTAL_SCORE",    criteriaValue: 2500000  },
  { key: "BOT_5M_SCORE",       name: "🚀 High Roller",           description: "5,000,000 practice score. Completely elite levels of work.",                icon: "🚀", rarity: "Mythic",    criteriaType: "TOTAL_SCORE",    criteriaValue: 5000000  },
  { key: "BOT_10M_SCORE",      name: "🌌 Billionaire Bot",       description: "10,000,000 total practice score. An incomprehensible amount of darts.",     icon: "🌌", rarity: "Mythic",    criteriaType: "TOTAL_SCORE",    criteriaValue: 10000000 },
  { key: "BOT_SC_25M",         name: "🌌 Twenty-Five Million",   description: "25,000,000 total score. A figure beyond all reasonable imagination.",       icon: "🌌", rarity: "Mythic",    criteriaType: "TOTAL_SCORE",    criteriaValue: 25000000 },
  { key: "BOT_SC_50M",         name: "🌌 Fifty Million",         description: "50,000,000 total score. Numbers that defy comprehension.",                  icon: "🌌", rarity: "Mythic",    criteriaType: "TOTAL_SCORE",    criteriaValue: 50000000 },
  { key: "BOT_SC_100M",        name: "🌌 One Hundred Million",   description: "100,000,000 total score. A hundred million points of practice.",            icon: "🌌", rarity: "Mythic",    criteriaType: "TOTAL_SCORE",    criteriaValue: 100000000},
  { key: "BOT_SC_500M",        name: "🪐 Five Hundred Million",  description: "500,000,000 total score. A feat no human will ever repeat.",                icon: "🪐", rarity: "Mythic",    criteriaType: "TOTAL_SCORE",    criteriaValue: 500000000},
  { key: "BOT_SC_1B",          name: "🪐 One Billion",           description: "1,000,000,000 total score. The pinnacle of everything.",                    icon: "🪐", rarity: "Mythic",    criteriaType: "TOTAL_SCORE",    criteriaValue: 1000000000},

  // ── CHECKOUT ACCURACY (15, requires ≥10 attempts) ─────────────────────────
  { key: "BOT_ACC_5",          name: "🎯 5% Accuracy",           description: "Hit 5% of your checkout attempts (min. 10 attempts). A start.",             icon: "🎯", rarity: "Common",    criteriaType: "CHECKOUT_ACCURACY", criteriaValue: 5     },
  { key: "BOT_ACC_10",         name: "🎯 10% Accuracy",          description: "One in ten checkouts landed. The doubles are coming.",                      icon: "🎯", rarity: "Common",    criteriaType: "CHECKOUT_ACCURACY", criteriaValue: 10    },
  { key: "BOT_ACC_15",         name: "🎯 15% Accuracy",          description: "15% checkout accuracy. Better than most first attempts.",                   icon: "🎯", rarity: "Common",    criteriaType: "CHECKOUT_ACCURACY", criteriaValue: 15    },
  { key: "BOT_ACC_20",         name: "🎯 20% Accuracy",          description: "20% checkout accuracy. One in five. Not bad at all.",                       icon: "🎯", rarity: "Common",    criteriaType: "CHECKOUT_ACCURACY", criteriaValue: 20    },
  { key: "BOT_ACC_25",         name: "🎯 25% Accuracy",          description: "25% accuracy. One in four. That's a decent average.",                       icon: "🎯", rarity: "Rare",      criteriaType: "CHECKOUT_ACCURACY", criteriaValue: 25    },
  { key: "BOT_ACC_30",         name: "🎯 30% Accuracy",          description: "30% checkout accuracy. Consistently competitive.",                          icon: "🎯", rarity: "Rare",      criteriaType: "CHECKOUT_ACCURACY", criteriaValue: 30    },
  { key: "BOT_ACC_40",         name: "🎯 40% Accuracy",          description: "40% checkout accuracy. Two in five doubles hit.",                           icon: "🎯", rarity: "Rare",      criteriaType: "CHECKOUT_ACCURACY", criteriaValue: 40    },
  { key: "BOT_ACC_50",         name: "🎯 50% Accuracy",          description: "50% checkout accuracy. Hitting one in two. Very clinical.",                 icon: "🎯", rarity: "Epic",      criteriaType: "CHECKOUT_ACCURACY", criteriaValue: 50    },
  { key: "BOT_ACC_60",         name: "🎯 60% Accuracy",          description: "60% accuracy. Three in five. Elite finishing.",                             icon: "🎯", rarity: "Epic",      criteriaType: "CHECKOUT_ACCURACY", criteriaValue: 60    },
  { key: "BOT_ACC_70",         name: "🎯 70% Accuracy",          description: "70% checkout accuracy. Seven in ten. World-class.",                         icon: "🎯", rarity: "Epic",      criteriaType: "CHECKOUT_ACCURACY", criteriaValue: 70    },
  { key: "BOT_ACC_75",         name: "🎯 75% Accuracy",          description: "75% accuracy. Three in four. An extraordinary finisher.",                   icon: "🎯", rarity: "Epic",      criteriaType: "CHECKOUT_ACCURACY", criteriaValue: 75    },
  { key: "BOT_ACC_80",         name: "🎯 80% Accuracy",          description: "80% checkout accuracy. Four in five. Phenomenal.",                          icon: "🎯", rarity: "Legendary", criteriaType: "CHECKOUT_ACCURACY", criteriaValue: 80    },
  { key: "BOT_ACC_85",         name: "🎯 85% Accuracy",          description: "85% checkout accuracy. Almost impossible to miss a double.",                icon: "🎯", rarity: "Legendary", criteriaType: "CHECKOUT_ACCURACY", criteriaValue: 85    },
  { key: "BOT_ACC_90",         name: "🎯 90% Accuracy",          description: "90% accuracy. Nine in ten. The greatest finisher alive.",                   icon: "🎯", rarity: "Mythic",    criteriaType: "CHECKOUT_ACCURACY", criteriaValue: 90    },
  { key: "BOT_ACC_95",         name: "🎯 95% Accuracy",          description: "95% checkout accuracy. Practically perfection on the doubles.",             icon: "🎯", rarity: "Mythic",    criteriaType: "CHECKOUT_ACCURACY", criteriaValue: 95    },

  // ── GAME FAMILY — 501 VARIANTS (10) ───────────────────────────────────────
  famAch("501", 1,   "501 Opener",             "Completed your first 501 practice session.",                              "🎯", "Common"),
  famAch("501", 3,   "501 Regulars",           "3 sessions of 501 variants. The classic format is your home.",            "🎯", "Common"),
  famAch("501", 5,   "501 Regular",            "5 sessions of 501. The standard format, fully embraced.",                 "🎯", "Common"),
  famAch("501", 10,  "501 Veteran",            "10 sessions of 501 variants. This is where champions are made.",          "🎯", "Rare"),
  famAch("501", 20,  "501 Specialist",         "20 sessions of 501. The format is in your blood.",                        "🎯", "Rare"),
  famAch("501", 30,  "501 Expert",             "30 sessions of 501 variants. Elite 501 knowledge.",                       "🎯", "Epic"),
  famAch("501", 50,  "501 Master",             "50 sessions of 501. Mastery of darts' flagship format.",                  "🎯", "Epic"),
  famAch("501", 100, "501 Champion",           "100 sessions of 501. A century of the greatest format in darts.",         "🎯", "Legendary"),
  famAch("501", 200, "501 Legend",             "200 sessions of 501. Legendary dedication to the format.",                "🎯", "Mythic"),
  famAch("501", 500, "501 Immortal",           "500 sessions of 501 variants. Beyond comprehension.",                     "🎯", "Mythic"),

  // ── GAME FAMILY — 301 VARIANTS (9) ────────────────────────────────────────
  famAch("301", 1,   "301 Opener",             "Completed your first 301 practice session.",                              "🎯", "Common"),
  famAch("301", 3,   "301 Regulars",           "3 sessions of 301. Quick-fire format fully embraced.",                    "🎯", "Common"),
  famAch("301", 5,   "301 Regular",            "5 sessions of 301 variants. Speed and precision combined.",               "🎯", "Common"),
  famAch("301", 10,  "301 Veteran",            "10 sessions of 301. The short format holds no fear.",                     "🎯", "Rare"),
  famAch("301", 20,  "301 Specialist",         "20 sessions of 301. Mastering the quick format.",                         "🎯", "Rare"),
  famAch("301", 30,  "301 Expert",             "30 sessions of 301. You finish legs in minimum darts.",                   "🎯", "Epic"),
  famAch("301", 50,  "301 Master",             "50 sessions of 301 variants. Efficiency personified.",                    "🎯", "Epic"),
  famAch("301", 100, "301 Champion",           "100 sessions of 301. A century in the quickest format.",                  "🎯", "Legendary"),
  famAch("301", 200, "301 Legend",             "200 sessions of 301. A legend of the lightning format.",                  "🎯", "Mythic"),

  // ── GAME FAMILY — 701+ VARIANTS (8) ───────────────────────────────────────
  famAch("701PLUS", 1,   "Long Distance",      "Played a 701, 1001 or 2001 session. The stamina game.",                  "🏃", "Common"),
  famAch("701PLUS", 3,   "Endurance Tested",   "3 sessions of long-format darts. Scoreboard stamina.",                   "🏃", "Common"),
  famAch("701PLUS", 5,   "Marathon Starter",   "5 sessions of 701+. You embrace the long game.",                         "🏃", "Rare"),
  famAch("701PLUS", 10,  "Marathon Runner",    "10 sessions of long-format darts. Endurance tested.",                    "🏃", "Rare"),
  famAch("701PLUS", 20,  "Iron Legs",          "20 sessions of 701+. Nothing scares you on the oche.",                   "🏃", "Epic"),
  famAch("701PLUS", 30,  "Long Haul",          "30 sessions of long formats. You relish the big scores.",                "🏃", "Epic"),
  famAch("701PLUS", 50,  "Distance Champion",  "50 long-format sessions. A titan of the endurance game.",                "🏃", "Legendary"),
  famAch("701PLUS", 100, "Distance Legend",    "100 sessions of 701+. Long-format darts mastered.",                      "🏃", "Mythic"),

  // ── GAME FAMILY — ALL X01 (9) ─────────────────────────────────────────────
  famAch("X01", 1,    "X01 Beginner",          "First X01 session of any variety.",                                       "🎯", "Common"),
  famAch("X01", 5,    "X01 Regular",           "5 X01 sessions across all variants.",                                     "🎯", "Common"),
  famAch("X01", 10,   "X01 Enthusiast",        "10 X01 sessions. The core format of darts.",                              "🎯", "Rare"),
  famAch("X01", 25,   "X01 Devotee",           "25 X01 sessions. Committed to the original format.",                      "🎯", "Rare"),
  famAch("X01", 50,   "X01 Veteran",           "50 X01 sessions. A seasoned veteran of the core format.",                 "🎯", "Epic"),
  famAch("X01", 100,  "X01 Expert",            "100 X01 sessions. You breathe X01.",                                      "🎯", "Epic"),
  famAch("X01", 200,  "X01 Master",            "200 X01 sessions. Mastery of the game's fundamental format.",             "🎯", "Legendary"),
  famAch("X01", 500,  "X01 Champion",          "500 X01 sessions. Five hundred times you've taken on the dartboard.",     "🎯", "Mythic"),
  famAch("X01", 1000, "X01 Immortal",          "1,000 X01 sessions. A legendary practitioner of the core format.",        "🎯", "Mythic"),

  // ── GAME FAMILY — CRICKET VARIANTS (10) ───────────────────────────────────
  famAch("CRICKET", 1,   "Cricket Debutant",   "Completed your first Cricket practice session.",                          "🏏", "Common"),
  famAch("CRICKET", 3,   "Cricket Regulars",   "3 Cricket sessions. Comfortable with the numbers game.",                  "🏏", "Common"),
  famAch("CRICKET", 5,   "Cricket Regular",    "5 Cricket sessions. Accuracy on the big numbers is improving.",           "🏏", "Common"),
  famAch("CRICKET", 10,  "Cricket Veteran",    "10 Cricket sessions. You know your way around trebles.",                  "🏏", "Rare"),
  famAch("CRICKET", 20,  "Cricket Specialist", "20 Cricket sessions. Closing numbers is second nature.",                  "🏏", "Rare"),
  famAch("CRICKET", 30,  "Cricket Expert",     "30 Cricket sessions. A formidable opponent in the numbers game.",         "🏏", "Epic"),
  famAch("CRICKET", 50,  "Cricket Master",     "50 Cricket sessions. The bull, the 20s, the lot — mastered.",             "🏏", "Epic"),
  famAch("CRICKET", 100, "Cricket Champion",   "100 Cricket sessions. A century in the tactical format.",                 "🏏", "Legendary"),
  famAch("CRICKET", 200, "Cricket Legend",     "200 Cricket sessions. A true legend of the sport's tactical game.",       "🏏", "Mythic"),
  famAch("CRICKET", 500, "Cricket Immortal",   "500 Cricket sessions. Cricket knowledge beyond all measure.",             "🏏", "Mythic"),

  // ── GAME FAMILY — KILLER (8) ──────────────────────────────────────────────
  famAch("KILLER", 1,   "First Blood",         "Completed your first Killer session. Survive or be eliminated.",          "💀", "Common"),
  famAch("KILLER", 3,   "Three Kills",         "3 Killer sessions. The survival instinct is sharpening.",                 "💀", "Common"),
  famAch("KILLER", 5,   "Serial Killer",       "5 Killer sessions. You live for the pressure.",                           "💀", "Rare"),
  famAch("KILLER", 10,  "Killing Machine",     "10 Killer sessions. Accuracy under pressure is elite.",                   "💀", "Rare"),
  famAch("KILLER", 20,  "Apex Killer",         "20 Killer sessions. Nobody survives against you.",                        "💀", "Epic"),
  famAch("KILLER", 30,  "Killer Expert",       "30 Killer sessions. A true master of the survival game.",                 "💀", "Epic"),
  famAch("KILLER", 50,  "Killer Champion",     "50 Killer sessions. Fifty sessions of pure darts pressure.",              "💀", "Legendary"),
  famAch("KILLER", 100, "Killer Legend",       "100 Killer sessions. A century in darts' most brutal format.",            "💀", "Mythic"),

  // ── GAME FAMILY — COUNT UP (8) ────────────────────────────────────────────
  famAch("COUNTUP", 1,   "Count Me In",        "First Count Up session. Every point counts.",                             "📈", "Common"),
  famAch("COUNTUP", 3,   "Counting Up",        "3 Count Up sessions. Score, score, score.",                               "📈", "Common"),
  famAch("COUNTUP", 5,   "Five Count-Ups",     "5 Count Up sessions. Big scores starting to flow.",                       "📈", "Rare"),
  famAch("COUNTUP", 10,  "Score Chaser",       "10 Count Up sessions. Your high score keeps climbing.",                   "📈", "Rare"),
  famAch("COUNTUP", 20,  "Points Fiend",       "20 Count Up sessions. You're obsessed with the big numbers.",             "📈", "Epic"),
  famAch("COUNTUP", 30,  "Count Up Expert",    "30 Count Up sessions. Maximum scoring is your calling.",                  "📈", "Epic"),
  famAch("COUNTUP", 50,  "Count Up Master",    "50 Count Up sessions. A relentless points-scoring machine.",              "📈", "Legendary"),
  famAch("COUNTUP", 100, "Count Up Legend",    "100 Count Up sessions. One hundred sessions of pure scoring.",            "📈", "Mythic"),

  // ── GAME FAMILY — HALVE IT (8) ────────────────────────────────────────────
  famAch("HALVEIT", 1,   "Don't Halve It",     "First Halve It session. Miss and your score gets cut in half.",           "✂️", "Common"),
  famAch("HALVEIT", 3,   "Three Halvings",     "3 Halve It sessions. Precision is everything.",                           "✂️", "Common"),
  famAch("HALVEIT", 5,   "Five Halvings",      "5 Halve It sessions. Accuracy under pressure.",                           "✂️", "Rare"),
  famAch("HALVEIT", 10,  "Halve It Veteran",   "10 Halve It sessions. Every number hit with confidence.",                 "✂️", "Rare"),
  famAch("HALVEIT", 20,  "Precision Pro",      "20 Halve It sessions. Nerve of steel under halving pressure.",            "✂️", "Epic"),
  famAch("HALVEIT", 30,  "Halve It Expert",    "30 Halve It sessions. Rarely missing a target.",                          "✂️", "Epic"),
  famAch("HALVEIT", 50,  "Halve It Master",    "50 Halve It sessions. Mastery of darts' most unforgiving format.",        "✂️", "Legendary"),
  famAch("HALVEIT", 100, "Halve It Legend",    "100 Halve It sessions. A legend of precision darts.",                     "✂️", "Mythic"),

  // ── GAME FAMILY — GOLF DARTS (8) ──────────────────────────────────────────
  famAch("GOLF", 1,   "Tee Off",               "First Golf Darts session. Lowest score wins.",                            "⛳", "Common"),
  famAch("GOLF", 3,   "Three Rounds",          "3 Golf Darts sessions. Getting a feel for the course.",                   "⛳", "Common"),
  famAch("GOLF", 5,   "Five Rounds",           "5 Golf Darts sessions. Under par thinking on the board.",                 "⛳", "Rare"),
  famAch("GOLF", 10,  "Ten Rounds",            "10 Golf Darts sessions. The course holds no surprises.",                  "⛳", "Rare"),
  famAch("GOLF", 20,  "Golf Specialist",       "20 Golf Darts sessions. Thinking like a darts golfer.",                   "⛳", "Epic"),
  famAch("GOLF", 30,  "Golf Expert",           "30 Golf Darts sessions. Consistent under-par scoring.",                   "⛳", "Epic"),
  famAch("GOLF", 50,  "Golf Champion",         "50 Golf Darts sessions. A champion of the course.",                       "⛳", "Legendary"),
  famAch("GOLF", 100, "Golf Legend",           "100 Golf Darts sessions. One hundred rounds on the darts course.",        "⛳", "Mythic"),

  // ── GAME FAMILY — AROUND THE WORLD (8) ────────────────────────────────────
  famAch("AROUND", 1,   "First Lap",           "First Around the World session. Time to travel.",                         "🌍", "Common"),
  famAch("AROUND", 3,   "Three Laps",          "3 Around the World sessions. Getting comfortable with the journey.",      "🌍", "Common"),
  famAch("AROUND", 5,   "World Traveller",     "5 Around the World sessions. The board is your map.",                     "🌍", "Rare"),
  famAch("AROUND", 10,  "Seasoned Traveller",  "10 Around the World sessions. Every number is familiar territory.",       "🌍", "Rare"),
  famAch("AROUND", 20,  "Globe Trotter",       "20 Around the World sessions. Around the board without hesitation.",      "🌍", "Epic"),
  famAch("AROUND", 30,  "World Expert",        "30 Around the World sessions. A veteran of the circular journey.",        "🌍", "Epic"),
  famAch("AROUND", 50,  "World Champion",      "50 Around the World sessions. No number left unfamiliar.",                "🌍", "Legendary"),
  famAch("AROUND", 100, "World Legend",        "100 Around the World sessions. One hundred laps of the dartboard.",       "🌍", "Mythic"),

  // ── GAME FAMILY — SHANGHAI (7) ────────────────────────────────────────────
  famAch("SHANGHAI", 1,   "Shanghai Arrival",  "First Shanghai session. Hit single, double and treble in one round.",     "🀄", "Common"),
  famAch("SHANGHAI", 3,   "Three Shanghais",   "3 Shanghai sessions. The single-round challenge embraced.",               "🀄", "Common"),
  famAch("SHANGHAI", 5,   "Five Shanghais",    "5 Shanghai sessions. Hunting the full score on every number.",            "🀄", "Rare"),
  famAch("SHANGHAI", 10,  "Shanghai Veteran",  "10 Shanghai sessions. A veteran of the high-risk format.",                "🀄", "Rare"),
  famAch("SHANGHAI", 20,  "Shanghai Expert",   "20 Shanghai sessions. Consistently close to the perfect score.",          "🀄", "Epic"),
  famAch("SHANGHAI", 30,  "Shanghai Master",   "30 Shanghai sessions. Mastery of the ultimate scoring format.",           "🀄", "Legendary"),
  famAch("SHANGHAI", 50,  "Shanghai Legend",   "50 Shanghai sessions. A legend of the most complete format.",             "🀄", "Mythic"),

  // ── GAME FAMILY — TEAM FORMATS (7) ────────────────────────────────────────
  famAch("TEAM", 1,   "Team Player",           "First team format session. Partnerships and doubles strategy.",            "👥", "Common"),
  famAch("TEAM", 3,   "Team Regular",          "3 team format sessions. Comfortable in the partnership game.",            "👥", "Common"),
  famAch("TEAM", 5,   "Team Member",           "5 team format sessions. A reliable team player.",                         "👥", "Rare"),
  famAch("TEAM", 10,  "Team Veteran",          "10 team format sessions. The team format suits your game.",               "👥", "Rare"),
  famAch("TEAM", 20,  "Team Specialist",       "20 team format sessions. Understanding doubles strategy fully.",          "👥", "Epic"),
  famAch("TEAM", 30,  "Team Expert",           "30 team format sessions. Elite team darts knowledge.",                    "👥", "Epic"),
  famAch("TEAM", 50,  "Team Legend",           "50 team format sessions. A legend of the partnership game.",              "👥", "Mythic"),

  // ── GAME FAMILY — FUN/NOVELTY FORMATS (8) ────────────────────────────────
  famAch("FUN", 1,   "Fun and Games",          "First fun-format session. Not everything has to be serious.",             "🎪", "Common"),
  famAch("FUN", 3,   "Party Starter",          "3 fun-format sessions. The social side of darts is strong.",             "🎪", "Common"),
  famAch("FUN", 5,   "Fun Specialist",         "5 fun-format sessions. You embrace the lighter side of darts.",          "🎪", "Rare"),
  famAch("FUN", 10,  "Fun Expert",             "10 fun-format sessions. Nobody enjoys darts more than you.",             "🎪", "Rare"),
  famAch("FUN", 20,  "Party Animal",           "20 fun-format sessions. The oche is your entertainment.",                "🎪", "Epic"),
  famAch("FUN", 30,  "Fun Champion",           "30 fun-format sessions. A champion of the novelty game.",                "🎪", "Epic"),
  famAch("FUN", 50,  "Fun Legend",             "50 fun-format sessions. Fifty sessions of joyful darts.",                "🎪", "Legendary"),
  famAch("FUN", 100, "Fun Immortal",           "100 fun-format sessions. Pure entertainment, one hundred times over.",   "🎪", "Mythic"),

  // ── GAME FAMILY — CHALLENGE FORMATS (7) ──────────────────────────────────
  famAch("CHALLENGE", 1,   "First Challenge",   "Completed your first challenge-format session. Push your limits.",      "🏆", "Common"),
  famAch("CHALLENGE", 3,   "Challenge Accepted","3 challenge sessions. You thrive under pressure.",                      "🏆", "Common"),
  famAch("CHALLENGE", 5,   "Challenge Regular", "5 challenge sessions. The hard formats don't faze you.",               "🏆", "Rare"),
  famAch("CHALLENGE", 10,  "Challenge Veteran", "10 challenge sessions. Consistently tackling the toughest tasks.",     "🏆", "Rare"),
  famAch("CHALLENGE", 20,  "Challenge Expert",  "20 challenge sessions. An expert at the most demanding formats.",      "🏆", "Epic"),
  famAch("CHALLENGE", 30,  "Challenge Master",  "30 challenge sessions. Mastery of darts' hardest tasks.",              "🏆", "Legendary"),
  famAch("CHALLENGE", 50,  "Challenge Legend",  "50 challenge sessions. A legend of the most demanding formats.",       "🏆", "Mythic"),

  // ── Per-game-type "played at least once" (75) ─────────────────────────────
  ...GAME_TYPE_PLAY_DEFS,
];

// ─────────────────────────────────────────────────────────────────────────────
// Award function
// ─────────────────────────────────────────────────────────────────────────────

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
    const [statsQ, modesQ, gameTypesQ, existingQ] = await Promise.all([
      db.execute(sql`
        SELECT
          COALESCE(SUM(p1_darts), 0)::int               AS total_darts,
          COUNT(*)::int                                   AS total_sessions,
          COALESCE(SUM(p1_score), 0)::bigint              AS total_score,
          COALESCE(SUM(p1_180s), 0)::int                  AS total_180s,
          COALESCE(SUM(p1_checkout_hits), 0)::int         AS checkout_hits,
          COALESCE(SUM(p1_checkout_attempts), 0)::int     AS checkout_attempts
        FROM practice_sessions WHERE player1_id = ${playerId}
      `),
      db.execute(sql`
        SELECT COUNT(DISTINCT game_type_key)::int AS game_modes
        FROM practice_sessions WHERE player1_id = ${playerId}
      `),
      db.execute(sql`
        SELECT game_type_key, COUNT(*)::int AS sessions
        FROM practice_sessions WHERE player1_id = ${playerId}
        GROUP BY game_type_key
      `),
      db.execute(sql`
        SELECT achievement_key FROM shadow_bot_achievements WHERE player_id = ${playerId}
      `),
    ]);

    const s = statsQ.rows[0] as {
      total_darts: number; total_sessions: number; total_score: string | number;
      total_180s: number; checkout_hits: number; checkout_attempts: number;
    };
    const totalDarts       = Number(s?.total_darts       ?? 0);
    const totalSessions    = Number(s?.total_sessions    ?? 0);
    const totalScore       = Number(s?.total_score       ?? 0);
    const total180s        = Number(s?.total_180s        ?? 0);
    const checkoutHits     = Number(s?.checkout_hits     ?? 0);
    const checkoutAttempts = Number(s?.checkout_attempts ?? 0);
    const gameModes        = Number((modesQ.rows[0] as { game_modes: number })?.game_modes ?? 0);

    const gameTypeMap = new Map<string, number>(
      (gameTypesQ.rows as { game_type_key: string; sessions: number }[])
        .map(r => [r.game_type_key, Number(r.sessions)])
    );

    const MIN_DARTS_FOR_LEVEL = 150;
    const computedAvg = totalDarts > 0 ? (totalScore / totalDarts) * 3 : 0;
    const levelIdx    = totalDarts >= MIN_DARTS_FOR_LEVEL ? botLevelIndex(computedAvg) : 0;

    const already = new Set((existingQ.rows as { achievement_key: string }[]).map(r => r.achievement_key));

    for (const def of SHADOW_BOT_ACHIEVEMENT_DEFS) {
      if (already.has(def.key)) continue;
      let met = false;
      switch (def.criteriaType) {
        case "TOTAL_DARTS":         met = totalDarts        >= def.criteriaValue; break;
        case "TOTAL_SESSIONS":      met = totalSessions     >= def.criteriaValue; break;
        case "GAME_MODES":          met = gameModes         >= def.criteriaValue; break;
        case "BOT_LEVEL":           met = levelIdx          >= def.criteriaValue; break;
        case "TOTAL_180S":          met = total180s         >= def.criteriaValue; break;
        case "CHECKOUT_HITS":       met = checkoutHits      >= def.criteriaValue; break;
        case "TOTAL_SCORE":         met = totalScore        >= def.criteriaValue; break;
        case "CHECKOUT_ATTEMPTS":   met = checkoutAttempts  >= def.criteriaValue; break;
        case "CHECKOUT_ACCURACY": {
          const pct = checkoutAttempts >= 10
            ? Math.floor((checkoutHits / checkoutAttempts) * 100)
            : 0;
          met = pct >= def.criteriaValue;
          break;
        }
        case "GAME_FAMILY": {
          const count = resolveGameFamilyCount(def.gameFilter!, gameTypeMap);
          met = count >= def.criteriaValue;
          break;
        }
      }
      if (met) await awardShadowBotAchievement(playerId, def.key);
    }
  } catch (err) {
    logger.error({ err, playerId }, "checkAndAwardShadowBotAchievements failed");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress function
// ─────────────────────────────────────────────────────────────────────────────

export type ShadowAchievementProgress = ShadowBotAchievementDef & {
  gamerscore: number;
  unlocked: boolean;
  unlockedAt: string | null;
  currentValue: number;
  progressPct: number;
};

export async function getShadowAchievementProgress(playerId: number): Promise<ShadowAchievementProgress[]> {
  const [statsQ, modesQ, gameTypesQ, existingQ] = await Promise.all([
    db.execute(sql`
      SELECT
        COALESCE(SUM(p1_darts), 0)::int               AS total_darts,
        COUNT(*)::int                                   AS total_sessions,
        COALESCE(SUM(p1_score), 0)::bigint              AS total_score,
        COALESCE(SUM(p1_180s), 0)::int                  AS total_180s,
        COALESCE(SUM(p1_checkout_hits), 0)::int         AS checkout_hits,
        COALESCE(SUM(p1_checkout_attempts), 0)::int     AS checkout_attempts
      FROM practice_sessions WHERE player1_id = ${playerId}
    `),
    db.execute(sql`
      SELECT COUNT(DISTINCT game_type_key)::int AS game_modes
      FROM practice_sessions WHERE player1_id = ${playerId}
    `),
    db.execute(sql`
      SELECT game_type_key, COUNT(*)::int AS sessions
      FROM practice_sessions WHERE player1_id = ${playerId}
      GROUP BY game_type_key
    `),
    db.execute(sql`
      SELECT achievement_key, unlocked_at FROM shadow_bot_achievements WHERE player_id = ${playerId}
    `),
  ]);

  const s = statsQ.rows[0] as {
    total_darts: number; total_sessions: number; total_score: string | number;
    total_180s: number; checkout_hits: number; checkout_attempts: number;
  };
  const totalDarts       = Number(s?.total_darts       ?? 0);
  const totalSessions    = Number(s?.total_sessions    ?? 0);
  const totalScore       = Number(s?.total_score       ?? 0);
  const total180s        = Number(s?.total_180s        ?? 0);
  const checkoutHits     = Number(s?.checkout_hits     ?? 0);
  const checkoutAttempts = Number(s?.checkout_attempts ?? 0);
  const gameModes        = Number((modesQ.rows[0] as { game_modes: number })?.game_modes ?? 0);

  const gameTypeMap = new Map<string, number>(
    (gameTypesQ.rows as { game_type_key: string; sessions: number }[])
      .map(r => [r.game_type_key, Number(r.sessions)])
  );

  const MIN_DARTS_FOR_LEVEL = 150;
  const computedAvg = totalDarts > 0 ? (totalScore / totalDarts) * 3 : 0;
  const levelIdx    = totalDarts >= MIN_DARTS_FOR_LEVEL ? botLevelIndex(computedAvg) : 0;

  const unlockedMap = new Map(
    (existingQ.rows as { achievement_key: string; unlocked_at: string }[])
      .map(r => [r.achievement_key, r.unlocked_at])
  );

  return SHADOW_BOT_ACHIEVEMENT_DEFS.map(def => {
    let currentValue = 0;
    switch (def.criteriaType) {
      case "TOTAL_DARTS":       currentValue = totalDarts;       break;
      case "TOTAL_SESSIONS":    currentValue = totalSessions;    break;
      case "GAME_MODES":        currentValue = gameModes;        break;
      case "BOT_LEVEL":         currentValue = levelIdx;         break;
      case "TOTAL_180S":        currentValue = total180s;        break;
      case "CHECKOUT_HITS":     currentValue = checkoutHits;     break;
      case "TOTAL_SCORE":       currentValue = totalScore;       break;
      case "CHECKOUT_ATTEMPTS": currentValue = checkoutAttempts; break;
      case "CHECKOUT_ACCURACY":
        currentValue = checkoutAttempts >= 10
          ? Math.floor((checkoutHits / checkoutAttempts) * 100)
          : 0;
        break;
      case "GAME_FAMILY":
        currentValue = resolveGameFamilyCount(def.gameFilter!, gameTypeMap);
        break;
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
