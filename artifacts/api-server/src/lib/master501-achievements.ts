import { db } from "@workspace/db";
import { achievementsTable, playerAchievementsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import type { AchievementDef } from "./achievements";

// ─── Achievement definitions ──────────────────────────────────────────────────

export const MASTER501_ACHIEVEMENT_DEFINITIONS: AchievementDef[] = [

  // ── First steps ──────────────────────────────────────────────────────────────
  { key:"M501_FIRST_WIN",        name:"🎯 First Blood",          description:"Win your first Master-501 match",                            icon:"🎯", rarity:"Common",    category:"Master-501", hidden:false, priority:20, criteriaType:"M501_WINS",            criteriaValue:1,   engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_FIRST_180",        name:"💯 Triple Ton",           description:"Hit a 180 in a Master-501 match",                            icon:"💯", rarity:"Common",    category:"Master-501", hidden:false, priority:20, criteriaType:"M501_TOTAL_180S",      criteriaValue:1,   engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_FIRST_CO",         name:"✅ First Finish",          description:"Land your first checkout in a Master-501 match",             icon:"✅", rarity:"Common",    category:"Master-501", hidden:false, priority:20, criteriaType:"M501_TOTAL_CO",        criteriaValue:1,   engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_TEN_RUNS",         name:"📋 Getting Going",        description:"Complete 10 Master-501 runs",                                icon:"📋", rarity:"Common",    category:"Master-501", hidden:false, priority:20, criteriaType:"M501_TOTAL_RUNS",      criteriaValue:10,  engineType:"STAT_BASED" , coinReward: 15},

  // ── Win milestones ───────────────────────────────────────────────────────────
  { key:"M501_WIN_2",            name:"🎯 Back-to-Back",         description:"Win 2 Master-501 matches",                                   icon:"🎯", rarity:"Common",    category:"Master-501", hidden:false, priority:21, criteriaType:"M501_WINS",            criteriaValue:2,   engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_WIN_3",            name:"🎯 Hat-Trick",            description:"Win 3 Master-501 matches",                                   icon:"🎯", rarity:"Common",    category:"Master-501", hidden:false, priority:22, criteriaType:"M501_WINS",            criteriaValue:3,   engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_WIN_5",            name:"🥅 Five-Star",            description:"Win 5 Master-501 matches",                                   icon:"🥅", rarity:"Common",    category:"Master-501", hidden:false, priority:22, criteriaType:"M501_WINS",            criteriaValue:5,   engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_WIN_10",           name:"🏅 Ten Wins",             description:"Win 10 Master-501 matches",                                  icon:"🏅", rarity:"Common",    category:"Master-501", hidden:false, priority:22, criteriaType:"M501_WINS",            criteriaValue:10,  engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_WIN_15",           name:"🏅 Fifteen Strong",       description:"Win 15 Master-501 matches",                                  icon:"🏅", rarity:"Common",    category:"Master-501", hidden:false, priority:22, criteriaType:"M501_WINS",            criteriaValue:15,  engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_WIN_20",           name:"🏅 Score of Wins",        description:"Win 20 Master-501 matches",                                  icon:"🏅", rarity:"Rare",      category:"Master-501", hidden:false, priority:30, criteriaType:"M501_WINS",            criteriaValue:20,  engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_WIN_25",           name:"🏅 Quarter Century",      description:"Win 25 Master-501 matches",                                  icon:"🏅", rarity:"Rare",      category:"Master-501", hidden:false, priority:30, criteriaType:"M501_WINS",            criteriaValue:25,  engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_WIN_30",           name:"🏅 Thirty Up",            description:"Win 30 Master-501 matches",                                  icon:"🏅", rarity:"Rare",      category:"Master-501", hidden:false, priority:32, criteriaType:"M501_WINS",            criteriaValue:30,  engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_WIN_40",           name:"🥈 Forty Wins",           description:"Win 40 Master-501 matches",                                  icon:"🥈", rarity:"Rare",      category:"Master-501", hidden:false, priority:33, criteriaType:"M501_WINS",            criteriaValue:40,  engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_WIN_50",           name:"🥈 Half-Century",         description:"Win 50 Master-501 matches",                                  icon:"🥈", rarity:"Rare",      category:"Master-501", hidden:false, priority:35, criteriaType:"M501_WINS",            criteriaValue:50,  engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_WIN_75",           name:"🥇 75 Wins",              description:"Win 75 Master-501 matches",                                  icon:"🥇", rarity:"Epic",      category:"Master-501", hidden:false, priority:50, criteriaType:"M501_WINS",            criteriaValue:75,  engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_WIN_100",          name:"💯 The Centurion",        description:"Win 100 Master-501 matches",                                 icon:"💯", rarity:"Epic",      category:"Master-501", hidden:false, priority:60, criteriaType:"M501_WINS",            criteriaValue:100, engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_WIN_150",          name:"💯 150 Wins",             description:"Win 150 Master-501 matches",                                 icon:"💯", rarity:"Epic",      category:"Master-501", hidden:true,  priority:65, criteriaType:"M501_WINS",            criteriaValue:150, engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_WIN_200",          name:"👑 200 Wins",             description:"Win 200 Master-501 matches",                                 icon:"👑", rarity:"Legendary", category:"Master-501", hidden:true,  priority:88, criteriaType:"M501_WINS",            criteriaValue:200, engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},

  // ── Run milestones ───────────────────────────────────────────────────────────
  { key:"M501_RUNS_25",          name:"📋 25 Runs",              description:"Complete 25 Master-501 runs",                                icon:"📋", rarity:"Common",    category:"Master-501", hidden:false, priority:21, criteriaType:"M501_TOTAL_RUNS",      criteriaValue:25,  engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_FIFTY_RUNS",       name:"🎲 Grinder",              description:"Complete 50 Master-501 runs",                                icon:"🎲", rarity:"Rare",      category:"Master-501", hidden:false, priority:40, criteriaType:"M501_TOTAL_RUNS",      criteriaValue:50,  engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_CENTURY_RUNS",     name:"💯 Centurion",            description:"Complete 100 Master-501 runs",                               icon:"💯", rarity:"Epic",      category:"Master-501", hidden:true,  priority:75, criteriaType:"M501_TOTAL_RUNS",      criteriaValue:100, engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_RUNS_200",         name:"🎲 200 Runs",             description:"Complete 200 Master-501 runs",                               icon:"🎲", rarity:"Epic",      category:"Master-501", hidden:true,  priority:76, criteriaType:"M501_TOTAL_RUNS",      criteriaValue:200, engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_RUNS_300",         name:"🎲 300 Runs",             description:"Complete 300 Master-501 runs",                               icon:"🎲", rarity:"Legendary", category:"Master-501", hidden:true,  priority:87, criteriaType:"M501_TOTAL_RUNS",      criteriaValue:300, engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},
  { key:"M501_RUNS_500",         name:"👑 500 Runs",             description:"Complete 500 Master-501 runs",                               icon:"👑", rarity:"Legendary", category:"Master-501", hidden:true,  priority:89, criteriaType:"M501_TOTAL_RUNS",      criteriaValue:500, engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},

  // ── Tier progression ─────────────────────────────────────────────────────────
  { key:"M501_CHALLENGER_CLEAR", name:"🥈 Challenger Cleared",   description:"Beat the Challenger Tier — clear all 3 rounds",              icon:"🥈", rarity:"Rare",      category:"Master-501", hidden:false, priority:40, criteriaType:"M501_TIER_CLEAR",     criteriaValue:1,   engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_PRO_CLEAR",        name:"🥇 Circuit Pro",          description:"Beat the Pro Circuit Tier — clear all 3 rounds",             icon:"🥇", rarity:"Rare",      category:"Master-501", hidden:false, priority:45, criteriaType:"M501_TIER_CLEAR",     criteriaValue:2,   engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_PREMIER_CLEAR",    name:"💎 Premier Class",        description:"Beat the Premier Tier — clear all 3 rounds",                 icon:"💎", rarity:"Epic",      category:"Master-501", hidden:false, priority:60, criteriaType:"M501_TIER_CLEAR",     criteriaValue:3,   engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_GRAND_PRIX_CLEAR", name:"🏁 Grand Prix Winner",    description:"Beat the Grand Prix Tier — clear all 3 rounds",              icon:"🏁", rarity:"Epic",      category:"Master-501", hidden:false, priority:65, criteriaType:"M501_TIER_CLEAR",     criteriaValue:4,   engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_WORLD_CHAMP",      name:"👑 World Champion",       description:"Conquer the World Championship — complete the full ladder",   icon:"👑", rarity:"Legendary", category:"Master-501", hidden:false, priority:90, criteriaType:"M501_TIER_CLEAR",     criteriaValue:5,   engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},

  // ── First visit to each tier ─────────────────────────────────────────────────
  { key:"M501_REACH_T2",         name:"🟢 Pro Entry",            description:"Reach the Pro Circuit tier for the first time",              icon:"🟢", rarity:"Common",    category:"Master-501", hidden:false, priority:25, criteriaType:"M501_REACH_TIER",     criteriaValue:2,   engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_REACH_T3",         name:"🔵 Premier Entry",        description:"Reach the Premier tier for the first time",                  icon:"🔵", rarity:"Rare",      category:"Master-501", hidden:false, priority:35, criteriaType:"M501_REACH_TIER",     criteriaValue:3,   engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_REACH_T4",         name:"🟡 Grand Prix Entry",     description:"Reach the Grand Prix tier for the first time",               icon:"🟡", rarity:"Epic",      category:"Master-501", hidden:false, priority:55, criteriaType:"M501_REACH_TIER",     criteriaValue:4,   engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_REACH_T5",         name:"🔴 World Stage",          description:"Reach the World Championship tier for the first time",       icon:"🔴", rarity:"Epic",      category:"Master-501", hidden:false, priority:65, criteriaType:"M501_REACH_TIER",     criteriaValue:5,   engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},

  // ── Tier + Round specific wins ───────────────────────────────────────────────
  { key:"M501_WIN_T1R1",         name:"🥈 Challenger R1",        description:"Win a Challenger Round 1 match",                             icon:"🥈", rarity:"Common",    category:"Master-501", hidden:false, priority:20, criteriaType:"M501_TR_WIN",         criteriaValue:11,  engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_WIN_T1R2",         name:"🥈 Challenger R2",        description:"Win a Challenger Round 2 match",                             icon:"🥈", rarity:"Common",    category:"Master-501", hidden:false, priority:22, criteriaType:"M501_TR_WIN",         criteriaValue:12,  engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_WIN_T2R1",         name:"🥇 Pro Circuit R1",       description:"Win a Pro Circuit Round 1 match",                            icon:"🥇", rarity:"Common",    category:"Master-501", hidden:false, priority:25, criteriaType:"M501_TR_WIN",         criteriaValue:21,  engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_WIN_T2R2",         name:"🥇 Pro Circuit R2",       description:"Win a Pro Circuit Round 2 match",                            icon:"🥇", rarity:"Rare",      category:"Master-501", hidden:false, priority:35, criteriaType:"M501_TR_WIN",         criteriaValue:22,  engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_WIN_T3R1",         name:"💎 Premier R1",           description:"Win a Premier Round 1 match",                                icon:"💎", rarity:"Rare",      category:"Master-501", hidden:false, priority:40, criteriaType:"M501_TR_WIN",         criteriaValue:31,  engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_WIN_T3R2",         name:"💎 Premier R2",           description:"Win a Premier Round 2 match",                                icon:"💎", rarity:"Rare",      category:"Master-501", hidden:false, priority:45, criteriaType:"M501_TR_WIN",         criteriaValue:32,  engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_WIN_T4R1",         name:"🏁 Grand Prix R1",        description:"Win a Grand Prix Round 1 match",                             icon:"🏁", rarity:"Epic",      category:"Master-501", hidden:false, priority:55, criteriaType:"M501_TR_WIN",         criteriaValue:41,  engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_WIN_T4R2",         name:"🏁 Grand Prix R2",        description:"Win a Grand Prix Round 2 match",                             icon:"🏁", rarity:"Epic",      category:"Master-501", hidden:false, priority:60, criteriaType:"M501_TR_WIN",         criteriaValue:42,  engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_WIN_T5R1",         name:"🔴 World Stage R1",       description:"Win a World Championship Round 1 match",                     icon:"🔴", rarity:"Epic",      category:"Master-501", hidden:false, priority:65, criteriaType:"M501_TR_WIN",         criteriaValue:51,  engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_WIN_T5R2",         name:"🔴 World Stage R2",       description:"Win a World Championship Round 2 match",                     icon:"🔴", rarity:"Epic",      category:"Master-501", hidden:false, priority:70, criteriaType:"M501_TR_WIN",         criteriaValue:52,  engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},

  // ── Per-tier run volume ───────────────────────────────────────────────────────
  { key:"M501_T1_RUNS_5",        name:"🥈 T1 Regular",           description:"Complete 5 matches in the Challenger tier",                  icon:"🥈", rarity:"Common",    category:"Master-501", hidden:false, priority:20, criteriaType:"M501_TIER_RUNS",      criteriaValue:15,  engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_T1_RUNS_10",       name:"🥈 T1 Veteran",           description:"Complete 10 matches in the Challenger tier",                 icon:"🥈", rarity:"Common",    category:"Master-501", hidden:false, priority:21, criteriaType:"M501_TIER_RUNS",      criteriaValue:110, engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_T1_RUNS_20",       name:"🥈 T1 Stalwart",          description:"Complete 20 matches in the Challenger tier",                 icon:"🥈", rarity:"Rare",      category:"Master-501", hidden:false, priority:30, criteriaType:"M501_TIER_RUNS",      criteriaValue:120, engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_T2_RUNS_5",        name:"🥇 T2 Regular",           description:"Complete 5 matches in the Pro Circuit tier",                 icon:"🥇", rarity:"Common",    category:"Master-501", hidden:false, priority:25, criteriaType:"M501_TIER_RUNS",      criteriaValue:25,  engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_T2_RUNS_10",       name:"🥇 T2 Veteran",           description:"Complete 10 matches in the Pro Circuit tier",                icon:"🥇", rarity:"Rare",      category:"Master-501", hidden:false, priority:35, criteriaType:"M501_TIER_RUNS",      criteriaValue:210, engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_T2_RUNS_20",       name:"🥇 T2 Stalwart",          description:"Complete 20 matches in the Pro Circuit tier",                icon:"🥇", rarity:"Rare",      category:"Master-501", hidden:false, priority:38, criteriaType:"M501_TIER_RUNS",      criteriaValue:220, engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_T3_RUNS_5",        name:"💎 T3 Regular",           description:"Complete 5 matches in the Premier tier",                     icon:"💎", rarity:"Rare",      category:"Master-501", hidden:false, priority:40, criteriaType:"M501_TIER_RUNS",      criteriaValue:35,  engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_T3_RUNS_10",       name:"💎 T3 Veteran",           description:"Complete 10 matches in the Premier tier",                    icon:"💎", rarity:"Rare",      category:"Master-501", hidden:false, priority:45, criteriaType:"M501_TIER_RUNS",      criteriaValue:310, engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_T3_RUNS_20",       name:"💎 T3 Stalwart",          description:"Complete 20 matches in the Premier tier",                    icon:"💎", rarity:"Epic",      category:"Master-501", hidden:false, priority:55, criteriaType:"M501_TIER_RUNS",      criteriaValue:320, engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_T4_RUNS_5",        name:"🏁 T4 Regular",           description:"Complete 5 matches in the Grand Prix tier",                  icon:"🏁", rarity:"Epic",      category:"Master-501", hidden:false, priority:57, criteriaType:"M501_TIER_RUNS",      criteriaValue:45,  engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_T4_RUNS_10",       name:"🏁 T4 Veteran",           description:"Complete 10 matches in the Grand Prix tier",                 icon:"🏁", rarity:"Epic",      category:"Master-501", hidden:false, priority:60, criteriaType:"M501_TIER_RUNS",      criteriaValue:410, engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_T4_RUNS_20",       name:"🏁 T4 Stalwart",          description:"Complete 20 matches in the Grand Prix tier",                 icon:"🏁", rarity:"Epic",      category:"Master-501", hidden:true,  priority:62, criteriaType:"M501_TIER_RUNS",      criteriaValue:420, engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_T5_RUNS_5",        name:"🔴 World Entrant",        description:"Complete 5 matches in the World Championship tier",          icon:"🔴", rarity:"Epic",      category:"Master-501", hidden:false, priority:65, criteriaType:"M501_TIER_RUNS",      criteriaValue:55,  engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_T5_RUNS_10",       name:"🔴 World Veteran",        description:"Complete 10 matches in the World Championship tier",         icon:"🔴", rarity:"Epic",      category:"Master-501", hidden:true,  priority:70, criteriaType:"M501_TIER_RUNS",      criteriaValue:510, engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_T5_RUNS_20",       name:"🔴 World Stalwart",       description:"Complete 20 matches in the World Championship tier",         icon:"🔴", rarity:"Legendary", category:"Master-501", hidden:true,  priority:86, criteriaType:"M501_TIER_RUNS",      criteriaValue:520, engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},

  // ── Per-tier wins ─────────────────────────────────────────────────────────────
  { key:"M501_T1_WINS_5",        name:"🥈 Challenger Victor",    description:"Win 5 matches in the Challenger tier",                       icon:"🥈", rarity:"Common",    category:"Master-501", hidden:false, priority:20, criteriaType:"M501_TIER_WINS",      criteriaValue:15,  engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_T1_WINS_10",       name:"🥈 Challenger Ace",       description:"Win 10 matches in the Challenger tier",                      icon:"🥈", rarity:"Rare",      category:"Master-501", hidden:false, priority:30, criteriaType:"M501_TIER_WINS",      criteriaValue:110, engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_T1_WINS_20",       name:"🥈 Challenger King",      description:"Win 20 matches in the Challenger tier",                      icon:"🥈", rarity:"Rare",      category:"Master-501", hidden:false, priority:35, criteriaType:"M501_TIER_WINS",      criteriaValue:120, engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_T2_WINS_5",        name:"🥇 Pro Victor",           description:"Win 5 matches in the Pro Circuit tier",                      icon:"🥇", rarity:"Rare",      category:"Master-501", hidden:false, priority:38, criteriaType:"M501_TIER_WINS",      criteriaValue:25,  engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_T2_WINS_10",       name:"🥇 Pro Ace",              description:"Win 10 matches in the Pro Circuit tier",                     icon:"🥇", rarity:"Rare",      category:"Master-501", hidden:false, priority:40, criteriaType:"M501_TIER_WINS",      criteriaValue:210, engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_T2_WINS_20",       name:"🥇 Pro King",             description:"Win 20 matches in the Pro Circuit tier",                     icon:"🥇", rarity:"Epic",      category:"Master-501", hidden:false, priority:55, criteriaType:"M501_TIER_WINS",      criteriaValue:220, engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_T3_WINS_5",        name:"💎 Premier Victor",       description:"Win 5 matches in the Premier tier",                          icon:"💎", rarity:"Epic",      category:"Master-501", hidden:false, priority:55, criteriaType:"M501_TIER_WINS",      criteriaValue:35,  engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_T3_WINS_10",       name:"💎 Premier Ace",          description:"Win 10 matches in the Premier tier",                         icon:"💎", rarity:"Epic",      category:"Master-501", hidden:false, priority:60, criteriaType:"M501_TIER_WINS",      criteriaValue:310, engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_T3_WINS_20",       name:"💎 Premier King",         description:"Win 20 matches in the Premier tier",                         icon:"💎", rarity:"Epic",      category:"Master-501", hidden:true,  priority:65, criteriaType:"M501_TIER_WINS",      criteriaValue:320, engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_T4_WINS_5",        name:"🏁 Grand Prix Victor",    description:"Win 5 matches in the Grand Prix tier",                       icon:"🏁", rarity:"Epic",      category:"Master-501", hidden:false, priority:65, criteriaType:"M501_TIER_WINS",      criteriaValue:45,  engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_T4_WINS_10",       name:"🏁 Grand Prix Ace",       description:"Win 10 matches in the Grand Prix tier",                      icon:"🏁", rarity:"Epic",      category:"Master-501", hidden:true,  priority:70, criteriaType:"M501_TIER_WINS",      criteriaValue:410, engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_T4_WINS_20",       name:"🏁 Grand Prix King",      description:"Win 20 matches in the Grand Prix tier",                      icon:"🏁", rarity:"Legendary", category:"Master-501", hidden:true,  priority:85, criteriaType:"M501_TIER_WINS",      criteriaValue:420, engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},
  { key:"M501_T5_WINS_5",        name:"🔴 World Victor",         description:"Win 5 matches in the World Championship tier",               icon:"🔴", rarity:"Epic",      category:"Master-501", hidden:false, priority:70, criteriaType:"M501_TIER_WINS",      criteriaValue:55,  engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_T5_WINS_10",       name:"🔴 World Ace",            description:"Win 10 matches in the World Championship tier",              icon:"🔴", rarity:"Legendary", category:"Master-501", hidden:true,  priority:85, criteriaType:"M501_TIER_WINS",      criteriaValue:510, engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},
  { key:"M501_T5_WINS_20",       name:"🔴 World King",           description:"Win 20 matches in the World Championship tier",              icon:"🔴", rarity:"Legendary", category:"Master-501", hidden:true,  priority:89, criteriaType:"M501_TIER_WINS",      criteriaValue:520, engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},

  // ── Win streaks ───────────────────────────────────────────────────────────────
  { key:"M501_STREAK_2",         name:"🔥 Two in a Row",         description:"Win 2 consecutive Master-501 matches",                       icon:"🔥", rarity:"Common",    category:"Master-501", hidden:false, priority:22, criteriaType:"M501_STREAK",         criteriaValue:2,   engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_HEAT",             name:"🔥 On Heat",              description:"Win 3 consecutive Master-501 matches",                       icon:"🔥", rarity:"Rare",      category:"Master-501", hidden:false, priority:40, criteriaType:"M501_STREAK",         criteriaValue:3,   engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_STREAK_4",         name:"🔥 Four-Timer",           description:"Win 4 consecutive Master-501 matches",                       icon:"🔥", rarity:"Rare",      category:"Master-501", hidden:false, priority:41, criteriaType:"M501_STREAK",         criteriaValue:4,   engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_ON_FIRE",          name:"⚡ Electric",             description:"Win 5 consecutive Master-501 matches",                       icon:"⚡", rarity:"Epic",      category:"Master-501", hidden:false, priority:60, criteriaType:"M501_STREAK",         criteriaValue:5,   engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_STREAK_7",         name:"⚡ Magnificent Seven",    description:"Win 7 consecutive Master-501 matches",                       icon:"⚡", rarity:"Epic",      category:"Master-501", hidden:false, priority:62, criteriaType:"M501_STREAK",         criteriaValue:7,   engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_UNSTOPPABLE",      name:"🌪️ Unstoppable",          description:"Win 10 consecutive Master-501 matches",                      icon:"🌪️", rarity:"Legendary", category:"Master-501", hidden:true,  priority:85, criteriaType:"M501_STREAK",         criteriaValue:10,  engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},
  { key:"M501_STREAK_15",        name:"🌪️ Fifteen Straight",     description:"Win 15 consecutive Master-501 matches",                      icon:"🌪️", rarity:"Legendary", category:"Master-501", hidden:true,  priority:88, criteriaType:"M501_STREAK",         criteriaValue:15,  engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},
  { key:"M501_STREAK_20",        name:"👑 Twenty-Straight",      description:"Win 20 consecutive Master-501 matches",                      icon:"👑", rarity:"Legendary", category:"Master-501", hidden:true,  priority:90, criteriaType:"M501_STREAK",         criteriaValue:20,  engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},

  // ── Perfect sets ─────────────────────────────────────────────────────────────
  { key:"M501_FLAWLESS_5",       name:"🛡️ Clean Sweep",          description:"Win a Best-of-5 without dropping a single leg",              icon:"🛡️", rarity:"Rare",      category:"Master-501", hidden:false, priority:40, criteriaType:"M501_FLAWLESS_5",     criteriaValue:1,   engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_FLAWLESS_9",       name:"🌟 Dominant Nine",        description:"Win a Best-of-9 without dropping a single leg",              icon:"🌟", rarity:"Epic",      category:"Master-501", hidden:false, priority:65, criteriaType:"M501_FLAWLESS_9",     criteriaValue:1,   engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_GRAND_SLAM",       name:"🌟 Grand Slam",           description:"Win a Best-of-11 without dropping a leg",                   icon:"🌟", rarity:"Legendary", category:"Master-501", hidden:true,  priority:88, criteriaType:"M501_GRAND_SLAM",     criteriaValue:1,   engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},

  // ── Drama ─────────────────────────────────────────────────────────────────────
  { key:"M501_LAST_GASP",        name:"😤 Last Gasp",            description:"Win a match that goes to the very last deciding leg",        icon:"😤", rarity:"Rare",      category:"Master-501", hidden:false, priority:35, criteriaType:"M501_LAST_GASP",      criteriaValue:1,   engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_MARATHON_3",       name:"💪 Marathon Man",         description:"Win 3 matches that go to the final deciding leg",            icon:"💪", rarity:"Epic",      category:"Master-501", hidden:false, priority:55, criteriaType:"M501_LAST_GASP",      criteriaValue:3,   engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_LAST_GASP_5",      name:"💪 Five-Time Grafter",    description:"Win 5 matches that go to the final deciding leg",            icon:"💪", rarity:"Epic",      category:"Master-501", hidden:true,  priority:63, criteriaType:"M501_LAST_GASP",      criteriaValue:5,   engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_LAST_GASP_10",     name:"🌪️ The Survivor",         description:"Win 10 matches that go to the final deciding leg",           icon:"🌪️", rarity:"Legendary", category:"Master-501", hidden:true,  priority:84, criteriaType:"M501_LAST_GASP",      criteriaValue:10,  engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},

  // ── Scoring — 180s milestones ─────────────────────────────────────────────────
  { key:"M501_180_THREE",        name:"🎯 Triple Ton Treble",    description:"Hit 3 total 180s across Master-501 matches",                 icon:"🎯", rarity:"Common",    category:"Master-501", hidden:false, priority:22, criteriaType:"M501_TOTAL_180S",     criteriaValue:3,   engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_180_FIVE",         name:"🎯 Ton-80 Collector",     description:"Hit 5 total 180s across Master-501 matches",                 icon:"🎯", rarity:"Rare",      category:"Master-501", hidden:false, priority:40, criteriaType:"M501_TOTAL_180S",     criteriaValue:5,   engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_180_TEN",          name:"🔥 Ten Maximums",         description:"Hit 10 total 180s across Master-501 matches",                icon:"🔥", rarity:"Rare",      category:"Master-501", hidden:false, priority:42, criteriaType:"M501_TOTAL_180S",     criteriaValue:10,  engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_180_TWENTY",       name:"🔥 Maximum Machine",      description:"Hit 20 total 180s across Master-501 matches",                icon:"🔥", rarity:"Epic",      category:"Master-501", hidden:false, priority:60, criteriaType:"M501_TOTAL_180S",     criteriaValue:20,  engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_180_FIFTY",        name:"👑 Maximum Legend",       description:"Hit 50 total 180s across Master-501 matches",                icon:"👑", rarity:"Legendary", category:"Master-501", hidden:true,  priority:87, criteriaType:"M501_TOTAL_180S",     criteriaValue:50,  engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},
  { key:"M501_180_HUNDRED",      name:"👑 Maximum God",          description:"Hit 100 total 180s across Master-501 matches",               icon:"👑", rarity:"Legendary", category:"Master-501", hidden:true,  priority:89, criteriaType:"M501_TOTAL_180S",     criteriaValue:100, engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},

  // ── 180s in a single match ───────────────────────────────────────────────────
  { key:"M501_MATCH_3_180S",     name:"🎯 Hat-Trick of Maximums","description":"Hit 3 maximums (180s) in a single Master-501 match",      icon:"🎯", rarity:"Epic",      category:"Master-501", hidden:false, priority:62, criteriaType:"M501_MATCH_180S",     criteriaValue:3,   engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_MATCH_5_180S",     name:"🔥 Maximum Frenzy",       description:"Hit 5 maximums (180s) in a single Master-501 match",        icon:"🔥", rarity:"Legendary", category:"Master-501", hidden:true,  priority:86, criteriaType:"M501_MATCH_180S",     criteriaValue:5,   engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},

  // ── Scoring — averages ────────────────────────────────────────────────────────
  { key:"M501_AVG_65",           name:"📊 Decent Average",       description:"Post a 3-dart average of 65+ in a Master-501 match",        icon:"📊", rarity:"Common",    category:"Master-501", hidden:false, priority:22, criteriaType:"M501_BEST_AVG",       criteriaValue:65,  engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_AVG_70",           name:"📊 Respectable Average",  description:"Post a 3-dart average of 70+ in a Master-501 match",        icon:"📊", rarity:"Common",    category:"Master-501", hidden:false, priority:23, criteriaType:"M501_BEST_AVG",       criteriaValue:70,  engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_AVG_75",           name:"📊 Strong Average",       description:"Post a 3-dart average of 75+ in a Master-501 match",        icon:"📊", rarity:"Rare",      category:"Master-501", hidden:false, priority:38, criteriaType:"M501_BEST_AVG",       criteriaValue:75,  engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_AVG_80",           name:"📊 Solid Average",        description:"Post a 3-dart average of 80+ in a Master-501 match",        icon:"📊", rarity:"Rare",      category:"Master-501", hidden:false, priority:40, criteriaType:"M501_BEST_AVG",       criteriaValue:80,  engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_AVG_85",           name:"📈 Quality Average",      description:"Post a 3-dart average of 85+ in a Master-501 match",        icon:"📈", rarity:"Rare",      category:"Master-501", hidden:false, priority:42, criteriaType:"M501_BEST_AVG",       criteriaValue:85,  engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_AVG_90",           name:"📈 Quality Player",       description:"Post a 3-dart average of 90+ in a Master-501 match",        icon:"📈", rarity:"Epic",      category:"Master-501", hidden:false, priority:60, criteriaType:"M501_BEST_AVG",       criteriaValue:90,  engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_AVG_95",           name:"📈 High-Class Average",   description:"Post a 3-dart average of 95+ in a Master-501 match",        icon:"📈", rarity:"Epic",      category:"Master-501", hidden:false, priority:63, criteriaType:"M501_BEST_AVG",       criteriaValue:95,  engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_AVG_100",          name:"💯 Century Average",      description:"Post a 3-dart average of 100+ in a Master-501 match",       icon:"💯", rarity:"Legendary", category:"Master-501", hidden:false, priority:85, criteriaType:"M501_BEST_AVG",       criteriaValue:100, engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},
  { key:"M501_AVG_105",          name:"💯 Elite Average",        description:"Post a 3-dart average of 105+ in a Master-501 match",       icon:"💯", rarity:"Legendary", category:"Master-501", hidden:true,  priority:86, criteriaType:"M501_BEST_AVG",       criteriaValue:105, engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},
  { key:"M501_AVG_110",          name:"💯 World-Class Average",  description:"Post a 3-dart average of 110+ in a Master-501 match",       icon:"💯", rarity:"Legendary", category:"Master-501", hidden:true,  priority:87, criteriaType:"M501_BEST_AVG",       criteriaValue:110, engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},
  { key:"M501_AVG_115",          name:"👑 Superstar Average",    description:"Post a 3-dart average of 115+ in a Master-501 match",       icon:"👑", rarity:"Legendary", category:"Master-501", hidden:true,  priority:88, criteriaType:"M501_BEST_AVG",       criteriaValue:115, engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},
  { key:"M501_AVG_120",          name:"👑 Legendary Average",    description:"Post a 3-dart average of 120+ in a Master-501 match",       icon:"👑", rarity:"Legendary", category:"Master-501", hidden:true,  priority:89, criteriaType:"M501_BEST_AVG",       criteriaValue:120, engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},

  // ── Checkout — volume ─────────────────────────────────────────────────────────
  { key:"M501_CO_FIVE",          name:"🎯 Five Finishes",        description:"Land 5 checkouts across Master-501 matches",                icon:"🎯", rarity:"Common",    category:"Master-501", hidden:false, priority:22, criteriaType:"M501_TOTAL_CO",       criteriaValue:5,   engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_CO_TEN",           name:"🎯 Sharp Finisher",       description:"Land 10 checkouts across Master-501 matches",               icon:"🎯", rarity:"Rare",      category:"Master-501", hidden:false, priority:40, criteriaType:"M501_TOTAL_CO",       criteriaValue:10,  engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_CO_TWENTYFIVE",    name:"🎯 25 Finishes",          description:"Land 25 checkouts across Master-501 matches",               icon:"🎯", rarity:"Rare",      category:"Master-501", hidden:false, priority:42, criteriaType:"M501_TOTAL_CO",       criteriaValue:25,  engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_CO_FIFTY",         name:"🏹 Fifty Finishes",       description:"Land 50 checkouts across Master-501 matches",               icon:"🏹", rarity:"Epic",      category:"Master-501", hidden:false, priority:60, criteriaType:"M501_TOTAL_CO",       criteriaValue:50,  engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_CO_HUNDRED",       name:"🏹 Century of Finishes",  description:"Land 100 checkouts across Master-501 matches",              icon:"🏹", rarity:"Epic",      category:"Master-501", hidden:true,  priority:72, criteriaType:"M501_TOTAL_CO",       criteriaValue:100, engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_CO_TWOHUNDRED",    name:"👑 200 Finishes",         description:"Land 200 checkouts across Master-501 matches",              icon:"👑", rarity:"Legendary", category:"Master-501", hidden:true,  priority:87, criteriaType:"M501_TOTAL_CO",       criteriaValue:200, engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},

  // ── Checkout — in a single match ──────────────────────────────────────────────
  { key:"M501_MATCH_3_CO",       name:"🏹 Hat-Trick of Finishes","description":"Land 3 checkouts in a single Master-501 match",           icon:"🏹", rarity:"Rare",      category:"Master-501", hidden:false, priority:45, criteriaType:"M501_MATCH_COS",      criteriaValue:3,   engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_MATCH_5_CO",       name:"🏹 Five-Star Finisher",   description:"Land 5 checkouts in a single Master-501 match",            icon:"🏹", rarity:"Epic",      category:"Master-501", hidden:true,  priority:68, criteriaType:"M501_MATCH_COS",      criteriaValue:5,   engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},

  // ── Checkout — rate ───────────────────────────────────────────────────────────
  { key:"M501_CO_RATE",          name:"🏹 Precision Finisher",   description:"Hit 50%+ checkout rate over 10+ attempts in Master-501",   icon:"🏹", rarity:"Epic",      category:"Master-501", hidden:false, priority:60, criteriaType:"M501_CO_RATE_50",     criteriaValue:10,  engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_CO_RATE_60",       name:"🏹 Ice Veins",            description:"Hit 60%+ checkout rate over 20+ attempts in Master-501",   icon:"🏹", rarity:"Epic",      category:"Master-501", hidden:false, priority:67, criteriaType:"M501_CO_RATE_60",     criteriaValue:20,  engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_CO_RATE_70",       name:"🏹 Cold as Steel",        description:"Hit 70%+ checkout rate over 30+ attempts in Master-501",   icon:"🏹", rarity:"Legendary", category:"Master-501", hidden:true,  priority:84, criteriaType:"M501_CO_RATE_70",     criteriaValue:30,  engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},

  // ── Lifetime darts ────────────────────────────────────────────────────────────
  { key:"M501_DARTS_100",        name:"🎯 100 Darts",            description:"Throw 100 darts total in Master-501 matches",               icon:"🎯", rarity:"Common",    category:"Master-501", hidden:false, priority:20, criteriaType:"M501_TOTAL_DARTS",    criteriaValue:100,  engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_DARTS_500",        name:"🎯 500 Darts",            description:"Throw 500 darts total in Master-501 matches",               icon:"🎯", rarity:"Common",    category:"Master-501", hidden:false, priority:21, criteriaType:"M501_TOTAL_DARTS",    criteriaValue:500,  engineType:"STAT_BASED" , coinReward: 15},
  { key:"M501_DARTS_1000",       name:"🎯 1000 Darts",           description:"Throw 1,000 darts total in Master-501 matches",             icon:"🎯", rarity:"Rare",      category:"Master-501", hidden:false, priority:32, criteriaType:"M501_TOTAL_DARTS",    criteriaValue:1000, engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_DARTS_5000",       name:"🎯 5000 Darts",           description:"Throw 5,000 darts total in Master-501 matches",             icon:"🎯", rarity:"Epic",      category:"Master-501", hidden:false, priority:62, criteriaType:"M501_TOTAL_DARTS",    criteriaValue:5000, engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_DARTS_10000",      name:"👑 10,000 Darts",         description:"Throw 10,000 darts total in Master-501 matches",            icon:"👑", rarity:"Legendary", category:"Master-501", hidden:true,  priority:86, criteriaType:"M501_TOTAL_DARTS",    criteriaValue:10000,engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},

  // ── Session binge ─────────────────────────────────────────────────────────────
  { key:"M501_BINGE_3",          name:"🎲 Triple Shift",         description:"Complete 3 Master-501 runs in a single day",                icon:"🎲", rarity:"Rare",      category:"Master-501", hidden:false, priority:35, criteriaType:"M501_DAY_RUNS",       criteriaValue:3,   engineType:"STAT_BASED" , coinReward: 35, packReward: "SINGLE"},
  { key:"M501_BINGE_5",          name:"🎲 Marathon Day",         description:"Complete 5 Master-501 runs in a single day",                icon:"🎲", rarity:"Epic",      category:"Master-501", hidden:false, priority:58, criteriaType:"M501_DAY_RUNS",       criteriaValue:5,   engineType:"STAT_BASED" , coinReward: 75, packReward: "SINGLE"},
  { key:"M501_BINGE_10",         name:"🎲 Dedicated Player",     description:"Complete 10 Master-501 runs in a single day",               icon:"🎲", rarity:"Legendary", category:"Master-501", hidden:true,  priority:83, criteriaType:"M501_DAY_RUNS",       criteriaValue:10,  engineType:"STAT_BASED" , coinReward: 150, packReward: "FIVE"},

];

// ─── Grant helper ─────────────────────────────────────────────────────────────

async function grantIfNotHas(playerId: number, key: string): Promise<boolean> {
  const { addCoinsToPlayer } = await import("../services/card-shop-service");
  const { ensurePlayerCurrency } = await import("../lib/cardTablesMigration");

  const ach = await db.select().from(achievementsTable).where(eq(achievementsTable.key, key));
  if (!ach || ach.length === 0) return false;

  const achievement = ach[0];
  const existing = await db
    .select({ id: playerAchievementsTable.id })
    .from(playerAchievementsTable)
    .where(
      and(
        eq(playerAchievementsTable.playerId, playerId),
        eq(playerAchievementsTable.achievementId, achievement.id)
      )
    );

  if (existing && existing.length > 0) return false;

  // Insert achievement record
  await db.insert(playerAchievementsTable).values({ playerId, achievementId: achievement.id });

  // Award coins if defined
  if (achievement.coinReward && achievement.coinReward > 0) {
    await ensurePlayerCurrency(playerId);
    await addCoinsToPlayer(playerId, achievement.coinReward);
  }

  // Award pack if defined
  if (achievement.packReward) {
    await db.execute(sql`
      INSERT INTO card_clash_pack_inventory (player_id, pack_type, earned_reason)
      VALUES (${playerId}, ${achievement.packReward}, ${"ACHIEVEMENT:" + key})
    `);
  }

  logger.info(
    { playerId, key, coins: achievement.coinReward, packs: achievement.packReward },
    "[M501] Achievement unlocked with rewards"
  );
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

    // ── 1. Run + win counts ──────────────────────────────────────────────────
    const runsRow = await db.execute(sql`
      SELECT
        COUNT(*)                                           AS total_runs,
        COUNT(CASE WHEN result = 'win' THEN 1 END)        AS total_wins
      FROM master501_runs
      WHERE player_id = ${playerId} AND result IS NOT NULL
    `);
    const runs      = (runsRow.rows[0] as any);
    const totalRuns = Number(runs?.total_runs  ?? 0);
    const totalWins = Number(runs?.total_wins  ?? 0);

    // ── 2. Recent streak ────────────────────────────────────────────────────
    const streakRows = await db.execute(sql`
      SELECT result FROM master501_runs
      WHERE player_id = ${playerId} AND result IS NOT NULL
      ORDER BY completed_at DESC LIMIT 20
    `);
    const recent = (streakRows.rows as any[]).map(r => r.result as string);
    let streak = 0;
    for (const r of recent) {
      if (r === "win") streak++;
      else break;
    }

    // ── 3. Special match flags ───────────────────────────────────────────────
    const specialRows = await db.execute(sql`
      SELECT
        COUNT(CASE WHEN result = 'win' AND legs_lost = 0 AND legs_format = 5  THEN 1 END) AS flawless5,
        COUNT(CASE WHEN result = 'win' AND legs_lost = 0 AND legs_format = 9  THEN 1 END) AS flawless9,
        COUNT(CASE WHEN result = 'win' AND legs_lost = 0 AND legs_format = 11 THEN 1 END) AS grand_slam,
        COUNT(CASE WHEN result = 'win' AND (legs_won + legs_lost) = legs_format AND legs_lost > 0 THEN 1 END) AS last_gasp
      FROM master501_runs
      WHERE player_id = ${playerId} AND result IS NOT NULL
    `);
    const sp        = (specialRows.rows[0] as any);
    const flawless5 = Number(sp?.flawless5  ?? 0);
    const flawless9 = Number(sp?.flawless9  ?? 0);
    const grandSlam = Number(sp?.grand_slam ?? 0);
    const lastGasp  = Number(sp?.last_gasp  ?? 0);

    // ── 4. Tier clears (R3 wins per tier) ───────────────────────────────────
    const tierClearRows = await db.execute(sql`
      SELECT tier FROM master501_runs
      WHERE player_id = ${playerId} AND result = 'win' AND round = 3
      GROUP BY tier
    `);
    const clearedTiers = new Set((tierClearRows.rows as any[]).map(r => Number(r.tier)));

    // ── 5. Per-tier run + win counts ─────────────────────────────────────────
    const tierStatsRows = await db.execute(sql`
      SELECT
        tier,
        COUNT(*)                                       AS tier_runs,
        COUNT(CASE WHEN result = 'win' THEN 1 END)     AS tier_wins
      FROM master501_runs
      WHERE player_id = ${playerId} AND result IS NOT NULL
      GROUP BY tier
    `);
    const tierStats: Record<number, { runs: number; wins: number }> = {};
    for (const r of tierStatsRows.rows as any[]) {
      tierStats[Number(r.tier)] = { runs: Number(r.tier_runs), wins: Number(r.tier_wins) };
    }

    // ── 6. Specific tier+round wins ─────────────────────────────────────────
    const trWinRows = await db.execute(sql`
      SELECT tier, round, COUNT(*) AS cnt
      FROM master501_runs
      WHERE player_id = ${playerId} AND result = 'win'
      GROUP BY tier, round
    `);
    const trWins: Record<number, number> = {};
    for (const r of trWinRows.rows as any[]) {
      trWins[Number(r.tier) * 10 + Number(r.round)] = Number(r.cnt);
    }

    // ── 7. First-time reach per tier ─────────────────────────────────────────
    const tierReachRows = await db.execute(sql`
      SELECT DISTINCT tier FROM master501_runs
      WHERE player_id = ${playerId} AND result IS NOT NULL
    `);
    const reachedTiers = new Set((tierReachRows.rows as any[]).map(r => Number(r.tier)));

    // ── 8. Practice session stats (M501 sessions) ───────────────────────────
    const sessRow = await db.execute(sql`
      SELECT
        COALESCE(SUM(p1_180s),              0) AS total_180s,
        COALESCE(MAX(CASE WHEN p1_darts > 0 THEN (p1_score::float / p1_darts) * 3.0 END), 0) AS best_avg,
        COALESCE(SUM(p1_checkout_hits),     0) AS co_hits,
        COALESCE(SUM(p1_checkout_attempts), 0) AS co_attempts,
        COALESCE(MAX(p1_180s),              0) AS max_match_180s,
        COALESCE(MAX(p1_checkout_hits),     0) AS max_match_co,
        COALESCE(SUM(p1_darts),             0) AS total_darts
      FROM practice_sessions
      WHERE player1_id = ${playerId}
        AND session_data->>'mode' = 'master501'
    `);
    const sess          = (sessRow.rows[0] as any);
    const total180s     = Number(sess?.total_180s     ?? 0);
    const bestAvg       = Number(sess?.best_avg       ?? 0);
    const coHits        = Number(sess?.co_hits        ?? 0);
    const coAttempts    = Number(sess?.co_attempts    ?? 0);
    const maxMatch180s  = Number(sess?.max_match_180s ?? 0);
    const maxMatchCo    = Number(sess?.max_match_co   ?? 0);
    const totalDarts    = Number(sess?.total_darts    ?? 0);
    const coRate        = coAttempts >= 10 ? (coHits / coAttempts) : 0;
    const coRate20      = coAttempts >= 20 ? (coHits / coAttempts) : 0;
    const coRate30      = coAttempts >= 30 ? (coHits / coAttempts) : 0;

    // ── 9. Max binge (runs in a single day) ──────────────────────────────────
    const bingeRow = await db.execute(sql`
      SELECT COALESCE(MAX(daily_cnt), 0) AS max_day
      FROM (
        SELECT COUNT(*) AS daily_cnt
        FROM master501_runs
        WHERE player_id = ${playerId} AND result IS NOT NULL
        GROUP BY DATE(completed_at AT TIME ZONE 'UTC')
      ) sub
    `);
    const maxDay = Number((bingeRow.rows[0] as any)?.max_day ?? 0);

    // ─── Grant ───────────────────────────────────────────────────────────────

    // Volume / Runs
    if (totalRuns >=   10) await grantIfNotHas(playerId, "M501_TEN_RUNS");
    if (totalRuns >=   25) await grantIfNotHas(playerId, "M501_RUNS_25");
    if (totalRuns >=   50) await grantIfNotHas(playerId, "M501_FIFTY_RUNS");
    if (totalRuns >=  100) await grantIfNotHas(playerId, "M501_CENTURY_RUNS");
    if (totalRuns >=  200) await grantIfNotHas(playerId, "M501_RUNS_200");
    if (totalRuns >=  300) await grantIfNotHas(playerId, "M501_RUNS_300");
    if (totalRuns >=  500) await grantIfNotHas(playerId, "M501_RUNS_500");

    // Session binge
    if (maxDay >=   3) await grantIfNotHas(playerId, "M501_BINGE_3");
    if (maxDay >=   5) await grantIfNotHas(playerId, "M501_BINGE_5");
    if (maxDay >=  10) await grantIfNotHas(playerId, "M501_BINGE_10");

    // Lifetime darts
    if (totalDarts >=   100) await grantIfNotHas(playerId, "M501_DARTS_100");
    if (totalDarts >=   500) await grantIfNotHas(playerId, "M501_DARTS_500");
    if (totalDarts >=  1000) await grantIfNotHas(playerId, "M501_DARTS_1000");
    if (totalDarts >=  5000) await grantIfNotHas(playerId, "M501_DARTS_5000");
    if (totalDarts >= 10000) await grantIfNotHas(playerId, "M501_DARTS_10000");

    // First tier visits
    if (reachedTiers.has(2)) await grantIfNotHas(playerId, "M501_REACH_T2");
    if (reachedTiers.has(3)) await grantIfNotHas(playerId, "M501_REACH_T3");
    if (reachedTiers.has(4)) await grantIfNotHas(playerId, "M501_REACH_T4");
    if (reachedTiers.has(5)) await grantIfNotHas(playerId, "M501_REACH_T5");

    // Per-tier runs
    for (const [t, suffix, threshold] of [
      [1, "T1_RUNS_5", 5], [1, "T1_RUNS_10", 10], [1, "T1_RUNS_20", 20],
      [2, "T2_RUNS_5", 5], [2, "T2_RUNS_10", 10], [2, "T2_RUNS_20", 20],
      [3, "T3_RUNS_5", 5], [3, "T3_RUNS_10", 10], [3, "T3_RUNS_20", 20],
      [4, "T4_RUNS_5", 5], [4, "T4_RUNS_10", 10], [4, "T4_RUNS_20", 20],
      [5, "T5_RUNS_5", 5], [5, "T5_RUNS_10", 10], [5, "T5_RUNS_20", 20],
    ] as [number, string, number][]) {
      if ((tierStats[t]?.runs ?? 0) >= threshold)
        await grantIfNotHas(playerId, `M501_${suffix}`);
    }

    // Per-tier wins
    for (const [t, suffix, threshold] of [
      [1, "T1_WINS_5", 5], [1, "T1_WINS_10", 10], [1, "T1_WINS_20", 20],
      [2, "T2_WINS_5", 5], [2, "T2_WINS_10", 10], [2, "T2_WINS_20", 20],
      [3, "T3_WINS_5", 5], [3, "T3_WINS_10", 10], [3, "T3_WINS_20", 20],
      [4, "T4_WINS_5", 5], [4, "T4_WINS_10", 10], [4, "T4_WINS_20", 20],
      [5, "T5_WINS_5", 5], [5, "T5_WINS_10", 10], [5, "T5_WINS_20", 20],
    ] as [number, string, number][]) {
      if ((tierStats[t]?.wins ?? 0) >= threshold)
        await grantIfNotHas(playerId, `M501_${suffix}`);
    }

    // 180 milestones
    if (total180s >=   1) await grantIfNotHas(playerId, "M501_FIRST_180");
    if (total180s >=   3) await grantIfNotHas(playerId, "M501_180_THREE");
    if (total180s >=   5) await grantIfNotHas(playerId, "M501_180_FIVE");
    if (total180s >=  10) await grantIfNotHas(playerId, "M501_180_TEN");
    if (total180s >=  20) await grantIfNotHas(playerId, "M501_180_TWENTY");
    if (total180s >=  50) await grantIfNotHas(playerId, "M501_180_FIFTY");
    if (total180s >= 100) await grantIfNotHas(playerId, "M501_180_HUNDRED");

    // 180s in a single match
    if (maxMatch180s >= 3) await grantIfNotHas(playerId, "M501_MATCH_3_180S");
    if (maxMatch180s >= 5) await grantIfNotHas(playerId, "M501_MATCH_5_180S");

    // Averages
    if (bestAvg >=  65) await grantIfNotHas(playerId, "M501_AVG_65");
    if (bestAvg >=  70) await grantIfNotHas(playerId, "M501_AVG_70");
    if (bestAvg >=  75) await grantIfNotHas(playerId, "M501_AVG_75");
    if (bestAvg >=  80) await grantIfNotHas(playerId, "M501_AVG_80");
    if (bestAvg >=  85) await grantIfNotHas(playerId, "M501_AVG_85");
    if (bestAvg >=  90) await grantIfNotHas(playerId, "M501_AVG_90");
    if (bestAvg >=  95) await grantIfNotHas(playerId, "M501_AVG_95");
    if (bestAvg >= 100) await grantIfNotHas(playerId, "M501_AVG_100");
    if (bestAvg >= 105) await grantIfNotHas(playerId, "M501_AVG_105");
    if (bestAvg >= 110) await grantIfNotHas(playerId, "M501_AVG_110");
    if (bestAvg >= 115) await grantIfNotHas(playerId, "M501_AVG_115");
    if (bestAvg >= 120) await grantIfNotHas(playerId, "M501_AVG_120");

    // Checkout volume
    if (coHits >=   1) await grantIfNotHas(playerId, "M501_FIRST_CO");
    if (coHits >=   5) await grantIfNotHas(playerId, "M501_CO_FIVE");
    if (coHits >=  10) await grantIfNotHas(playerId, "M501_CO_TEN");
    if (coHits >=  25) await grantIfNotHas(playerId, "M501_CO_TWENTYFIVE");
    if (coHits >=  50) await grantIfNotHas(playerId, "M501_CO_FIFTY");
    if (coHits >= 100) await grantIfNotHas(playerId, "M501_CO_HUNDRED");
    if (coHits >= 200) await grantIfNotHas(playerId, "M501_CO_TWOHUNDRED");

    // Checkout in single match
    if (maxMatchCo >= 3) await grantIfNotHas(playerId, "M501_MATCH_3_CO");
    if (maxMatchCo >= 5) await grantIfNotHas(playerId, "M501_MATCH_5_CO");

    // Checkout rate
    if (coRate   >= 0.50) await grantIfNotHas(playerId, "M501_CO_RATE");
    if (coRate20 >= 0.60) await grantIfNotHas(playerId, "M501_CO_RATE_60");
    if (coRate30 >= 0.70) await grantIfNotHas(playerId, "M501_CO_RATE_70");

    if (result === "win") {
      // Win milestones
      if (totalWins >=   1) await grantIfNotHas(playerId, "M501_FIRST_WIN");
      if (totalWins >=   2) await grantIfNotHas(playerId, "M501_WIN_2");
      if (totalWins >=   3) await grantIfNotHas(playerId, "M501_WIN_3");
      if (totalWins >=   5) await grantIfNotHas(playerId, "M501_WIN_5");
      if (totalWins >=  10) await grantIfNotHas(playerId, "M501_WIN_10");
      if (totalWins >=  15) await grantIfNotHas(playerId, "M501_WIN_15");
      if (totalWins >=  20) await grantIfNotHas(playerId, "M501_WIN_20");
      if (totalWins >=  25) await grantIfNotHas(playerId, "M501_WIN_25");
      if (totalWins >=  30) await grantIfNotHas(playerId, "M501_WIN_30");
      if (totalWins >=  40) await grantIfNotHas(playerId, "M501_WIN_40");
      if (totalWins >=  50) await grantIfNotHas(playerId, "M501_WIN_50");
      if (totalWins >=  75) await grantIfNotHas(playerId, "M501_WIN_75");
      if (totalWins >= 100) await grantIfNotHas(playerId, "M501_WIN_100");
      if (totalWins >= 150) await grantIfNotHas(playerId, "M501_WIN_150");
      if (totalWins >= 200) await grantIfNotHas(playerId, "M501_WIN_200");

      // Tier clears
      if (clearedTiers.has(1)) await grantIfNotHas(playerId, "M501_CHALLENGER_CLEAR");
      if (clearedTiers.has(2)) await grantIfNotHas(playerId, "M501_PRO_CLEAR");
      if (clearedTiers.has(3)) await grantIfNotHas(playerId, "M501_PREMIER_CLEAR");
      if (clearedTiers.has(4)) await grantIfNotHas(playerId, "M501_GRAND_PRIX_CLEAR");
      if (clearedTiers.has(5)) await grantIfNotHas(playerId, "M501_WORLD_CHAMP");

      // Tier+Round specific wins
      for (const [key, trKey] of [
        ["M501_WIN_T1R1", 11], ["M501_WIN_T1R2", 12],
        ["M501_WIN_T2R1", 21], ["M501_WIN_T2R2", 22],
        ["M501_WIN_T3R1", 31], ["M501_WIN_T3R2", 32],
        ["M501_WIN_T4R1", 41], ["M501_WIN_T4R2", 42],
        ["M501_WIN_T5R1", 51], ["M501_WIN_T5R2", 52],
      ] as [string, number][]) {
        if ((trWins[trKey] ?? 0) >= 1) await grantIfNotHas(playerId, key);
      }

      // Streaks
      if (streak >=  2) await grantIfNotHas(playerId, "M501_STREAK_2");
      if (streak >=  3) await grantIfNotHas(playerId, "M501_HEAT");
      if (streak >=  4) await grantIfNotHas(playerId, "M501_STREAK_4");
      if (streak >=  5) await grantIfNotHas(playerId, "M501_ON_FIRE");
      if (streak >=  7) await grantIfNotHas(playerId, "M501_STREAK_7");
      if (streak >= 10) await grantIfNotHas(playerId, "M501_UNSTOPPABLE");
      if (streak >= 15) await grantIfNotHas(playerId, "M501_STREAK_15");
      if (streak >= 20) await grantIfNotHas(playerId, "M501_STREAK_20");

      // Flawless
      if (legsLost === 0 && legsFormat === 5)  { await grantIfNotHas(playerId, "M501_FLAWLESS_5"); }
      if (legsLost === 0 && legsFormat === 9)  { await grantIfNotHas(playerId, "M501_FLAWLESS_9"); }
      if (legsLost === 0 && legsFormat === 11) { await grantIfNotHas(playerId, "M501_GRAND_SLAM"); }
      if (flawless5 >= 1) await grantIfNotHas(playerId, "M501_FLAWLESS_5");
      if (flawless9 >= 1) await grantIfNotHas(playerId, "M501_FLAWLESS_9");
      if (grandSlam >= 1) await grantIfNotHas(playerId, "M501_GRAND_SLAM");

      // Last gasp
      const allLegsPlayed = legsWon + legsLost === legsFormat && legsLost > 0;
      if (allLegsPlayed)  await grantIfNotHas(playerId, "M501_LAST_GASP");
      if (lastGasp >= 3)  await grantIfNotHas(playerId, "M501_MARATHON_3");
      if (lastGasp >= 5)  await grantIfNotHas(playerId, "M501_LAST_GASP_5");
      if (lastGasp >= 10) await grantIfNotHas(playerId, "M501_LAST_GASP_10");
    }

  } catch (err) {
    logger.error({ err, playerId }, "[M501] Achievement check failed");
  }
}
