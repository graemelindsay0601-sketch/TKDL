import { db } from "@workspace/db";
import { achievementsTable, playerAchievementsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "./logger";
import type { AchievementDef } from "./achievements";

// ─── Tiered names per rarity ─────────────────────────────────────────────────
// 5 sessions  → Common    (Beginner)
// 10 sessions → Rare      (Apprentice)
// 25 sessions → Epic      (Journeyman)
// 50 sessions → Legendary (Master)
// 100 sessions → Mythic   (Legend)

function sessionTier(n: number): { rarity: string; priority: number } {
  if (n >= 100) return { rarity: "Mythic",    priority: 90 };
  if (n >= 50)  return { rarity: "Legendary", priority: 80 };
  if (n >= 25)  return { rarity: "Epic",      priority: 60 };
  if (n >= 10)  return { rarity: "Rare",      priority: 40 };
  return              { rarity: "Common",    priority: 20 };
}

function makeSessionAchs(
  gameKey: string,
  icon: string,
  gameName: string,
  thresholds: number[],
  labels: string[],
): AchievementDef[] {
  return thresholds.map((n, i) => ({
    key: `PRACTICE_${gameKey}_SESSIONS_${n}`,
    name: `${icon} ${labels[i]}`,
    description: `Play ${n} ${gameName} practice session${n > 1 ? "s" : ""}`,
    icon,
    ...sessionTier(n),
    category: "Practice",
    hidden: false,
    criteriaType: `PRACTICE_${gameKey}_SESSIONS`,
    criteriaValue: n,
    engineType: "STAT_BASED",
  }));
}

export const PRACTICE_ACHIEVEMENT_DEFINITIONS: AchievementDef[] = [
  // ── Total 180s ───────────────────────────────────────────────────────────────
  { key:"PRACTICE_TOTAL_180S_5",   name:"🎯 Century Start",    description:"Hit 5 total 180s in practice",    icon:"🎯", rarity:"Common",    category:"Practice", hidden:false, priority:20, criteriaType:"PRACTICE_TOTAL_180S", criteriaValue:5,   engineType:"STAT_BASED" },
  { key:"PRACTICE_TOTAL_180S_15",  name:"💯 180 Collector",    description:"Hit 15 total 180s in practice",   icon:"💯", rarity:"Rare",      category:"Practice", hidden:false, priority:40, criteriaType:"PRACTICE_TOTAL_180S", criteriaValue:15,  engineType:"STAT_BASED" },
  { key:"PRACTICE_TOTAL_180S_30",  name:"🔥 180 Specialist",   description:"Hit 30 total 180s in practice",   icon:"🔥", rarity:"Epic",      category:"Practice", hidden:false, priority:60, criteriaType:"PRACTICE_TOTAL_180S", criteriaValue:30,  engineType:"STAT_BASED" },
  { key:"PRACTICE_TOTAL_180S_60",  name:"⚡ 180 Archer",       description:"Hit 60 total 180s in practice",   icon:"⚡", rarity:"Legendary", category:"Practice", hidden:false, priority:80, criteriaType:"PRACTICE_TOTAL_180S", criteriaValue:60,  engineType:"STAT_BASED" },
  { key:"PRACTICE_TOTAL_180S_100", name:"👑 180 Legend",       description:"Hit 100 total 180s in practice",  icon:"👑", rarity:"Mythic",    category:"Practice", hidden:false, priority:90, criteriaType:"PRACTICE_TOTAL_180S", criteriaValue:100, engineType:"STAT_BASED" },
  // ── Big Fish (170 checkout) ───────────────────────────────────────────────────
  { key:"PRACTICE_BIG_FISH",   name:"🐟 The Big Fish",     description:"Land a 170 checkout (T20 T20 D25)",     icon:"🐟", rarity:"Legendary", category:"Practice", hidden:false, priority:80, criteriaType:"PRACTICE_170_CHECKOUT",  criteriaValue:1, engineType:"STAT_BASED" },
  { key:"PRACTICE_BIG_FISH_5", name:"🐟 Big Fish Hunter",  description:"Land five 170 checkouts in practice",   icon:"🐟", rarity:"Mythic",    category:"Practice", hidden:false, priority:90, criteriaType:"PRACTICE_170_CHECKOUT",  criteriaValue:5, engineType:"STAT_BASED" },
  // ── 100+ checkouts ───────────────────────────────────────────────────────────
  { key:"PRACTICE_100_PLUS_CHECKOUT_1",  name:"💪 Century Finisher",  description:"Land a 100+ checkout in practice",     icon:"💪", rarity:"Rare",      category:"Practice", hidden:false, priority:40, criteriaType:"PRACTICE_100_PLUS_CHECKOUT", criteriaValue:1,  engineType:"STAT_BASED" },
  { key:"PRACTICE_100_PLUS_CHECKOUT_5",  name:"🎯 High Finish Master", description:"Land 5 checkouts of 100+ in practice", icon:"🎯", rarity:"Epic",      category:"Practice", hidden:false, priority:60, criteriaType:"PRACTICE_100_PLUS_CHECKOUT", criteriaValue:5,  engineType:"STAT_BASED" },
  { key:"PRACTICE_100_PLUS_CHECKOUT_10", name:"🏆 Century Club",       description:"Land 10 checkouts of 100+ in practice",icon:"🏆", rarity:"Legendary", category:"Practice", hidden:false, priority:80, criteriaType:"PRACTICE_100_PLUS_CHECKOUT", criteriaValue:10, engineType:"STAT_BASED" },
  // ── Total checkout hits ───────────────────────────────────────────────────────
  { key:"PRACTICE_ALL_CHECKOUTS_5",   name:"✅ Finishing Touch", description:"Hit 5 practice checkouts",    icon:"✅", rarity:"Common",    category:"Practice", hidden:false, priority:20, criteriaType:"PRACTICE_TOTAL_CHECKOUTS", criteriaValue:5,   engineType:"STAT_BASED" },
  { key:"PRACTICE_ALL_CHECKOUTS_15",  name:"💪 Finisher",        description:"Hit 15 practice checkouts",   icon:"💪", rarity:"Rare",      category:"Practice", hidden:false, priority:40, criteriaType:"PRACTICE_TOTAL_CHECKOUTS", criteriaValue:15,  engineType:"STAT_BASED" },
  { key:"PRACTICE_ALL_CHECKOUTS_30",  name:"🎯 Checkout Ace",    description:"Hit 30 practice checkouts",   icon:"🎯", rarity:"Epic",      category:"Practice", hidden:false, priority:60, criteriaType:"PRACTICE_TOTAL_CHECKOUTS", criteriaValue:30,  engineType:"STAT_BASED" },
  { key:"PRACTICE_ALL_CHECKOUTS_60",  name:"🏆 Double Master",   description:"Hit 60 practice checkouts",   icon:"🏆", rarity:"Legendary", category:"Practice", hidden:false, priority:80, criteriaType:"PRACTICE_TOTAL_CHECKOUTS", criteriaValue:60,  engineType:"STAT_BASED" },
  { key:"PRACTICE_ALL_CHECKOUTS_100", name:"👑 Checkout God",    description:"Hit 100 practice checkouts",  icon:"👑", rarity:"Mythic",    category:"Practice", hidden:false, priority:90, criteriaType:"PRACTICE_TOTAL_CHECKOUTS", criteriaValue:100, engineType:"STAT_BASED" },
  // ── Total wins ────────────────────────────────────────────────────────────────
  { key:"PRACTICE_TOTAL_WINS_5",   name:"🥇 First Victory",     description:"Win 5 practice games",   icon:"🥇", rarity:"Common",    category:"Practice", hidden:false, priority:20, criteriaType:"PRACTICE_TOTAL_WINS", criteriaValue:5,   engineType:"STAT_BASED" },
  { key:"PRACTICE_TOTAL_WINS_15",  name:"🥇 Consistent Winner", description:"Win 15 practice games",  icon:"🥇", rarity:"Rare",      category:"Practice", hidden:false, priority:40, criteriaType:"PRACTICE_TOTAL_WINS", criteriaValue:15,  engineType:"STAT_BASED" },
  { key:"PRACTICE_TOTAL_WINS_30",  name:"🏆 Practice Champion", description:"Win 30 practice games",  icon:"🏆", rarity:"Epic",      category:"Practice", hidden:false, priority:60, criteriaType:"PRACTICE_TOTAL_WINS", criteriaValue:30,  engineType:"STAT_BASED" },
  { key:"PRACTICE_TOTAL_WINS_60",  name:"🎖️ Dominant Player",   description:"Win 60 practice games",  icon:"🎖️", rarity:"Legendary", category:"Practice", hidden:false, priority:80, criteriaType:"PRACTICE_TOTAL_WINS", criteriaValue:60,  engineType:"STAT_BASED" },
  { key:"PRACTICE_TOTAL_WINS_100", name:"👑 Unstoppable Force", description:"Win 100 practice games", icon:"👑", rarity:"Mythic",    category:"Practice", hidden:false, priority:90, criteriaType:"PRACTICE_TOTAL_WINS", criteriaValue:100, engineType:"STAT_BASED" },
  // ── Total sessions ────────────────────────────────────────────────────────────
  { key:"PRACTICE_TOTAL_SESSIONS_10",  name:"⚙️ Getting Started",  description:"Play 10 practice sessions",   icon:"⚙️", rarity:"Common",    category:"Practice", hidden:false, priority:20, criteriaType:"PRACTICE_TOTAL_SESSIONS", criteriaValue:10,  engineType:"STAT_BASED" },
  { key:"PRACTICE_TOTAL_SESSIONS_25",  name:"⚙️ Regular Player",   description:"Play 25 practice sessions",   icon:"⚙️", rarity:"Rare",      category:"Practice", hidden:false, priority:40, criteriaType:"PRACTICE_TOTAL_SESSIONS", criteriaValue:25,  engineType:"STAT_BASED" },
  { key:"PRACTICE_TOTAL_SESSIONS_50",  name:"⚙️ Practice Grinder", description:"Play 50 practice sessions",   icon:"⚙️", rarity:"Epic",      category:"Practice", hidden:false, priority:60, criteriaType:"PRACTICE_TOTAL_SESSIONS", criteriaValue:50,  engineType:"STAT_BASED" },
  { key:"PRACTICE_TOTAL_SESSIONS_100", name:"⚙️ Dedicated Grinder",description:"Play 100 practice sessions",  icon:"⚙️", rarity:"Legendary", category:"Practice", hidden:false, priority:80, criteriaType:"PRACTICE_TOTAL_SESSIONS", criteriaValue:100, engineType:"STAT_BASED" },
  // ── X01 double-out wins ───────────────────────────────────────────────────────
  { key:"PRACTICE_X01_DOUBLE_OUT_WINS_5",   name:"501️⃣ 501 Starter",   description:"Win 5 games of 501 Double Out in practice",   icon:"🎯", rarity:"Common",    category:"Practice", hidden:false, priority:20, criteriaType:"PRACTICE_X01_DOUBLE_OUT_WINS", criteriaValue:5,   engineType:"STAT_BASED" },
  { key:"PRACTICE_X01_DOUBLE_OUT_WINS_15",  name:"501️⃣ 501 Master",    description:"Win 15 games of 501 Double Out in practice",  icon:"🎯", rarity:"Rare",      category:"Practice", hidden:false, priority:40, criteriaType:"PRACTICE_X01_DOUBLE_OUT_WINS", criteriaValue:15,  engineType:"STAT_BASED" },
  { key:"PRACTICE_X01_DOUBLE_OUT_WINS_30",  name:"501️⃣ 501 Dominator", description:"Win 30 games of 501 Double Out in practice",  icon:"🎯", rarity:"Epic",      category:"Practice", hidden:false, priority:60, criteriaType:"PRACTICE_X01_DOUBLE_OUT_WINS", criteriaValue:30,  engineType:"STAT_BASED" },
  { key:"PRACTICE_X01_DOUBLE_OUT_WINS_60",  name:"501️⃣ 501 Legend",    description:"Win 60 games of 501 Double Out in practice",  icon:"🎯", rarity:"Legendary", category:"Practice", hidden:false, priority:80, criteriaType:"PRACTICE_X01_DOUBLE_OUT_WINS", criteriaValue:60,  engineType:"STAT_BASED" },
  { key:"PRACTICE_X01_DOUBLE_OUT_WINS_100", name:"501️⃣ 501 Emperor",   description:"Win 100 games of 501 Double Out in practice", icon:"🎯", rarity:"Mythic",    category:"Practice", hidden:false, priority:90, criteriaType:"PRACTICE_X01_DOUBLE_OUT_WINS", criteriaValue:100, engineType:"STAT_BASED" },
  // ── 301 wins ─────────────────────────────────────────────────────────────────
  { key:"PRACTICE_301_WINS_5",  name:"3️⃣ 301 Starter",   description:"Win 5 games of 301 in practice",  icon:"🎯", rarity:"Common", category:"Practice", hidden:false, priority:20, criteriaType:"PRACTICE_301_WINS", criteriaValue:5,  engineType:"STAT_BASED" },
  { key:"PRACTICE_301_WINS_15", name:"3️⃣ 301 Master",    description:"Win 15 games of 301 in practice", icon:"🎯", rarity:"Rare",   category:"Practice", hidden:false, priority:40, criteriaType:"PRACTICE_301_WINS", criteriaValue:15, engineType:"STAT_BASED" },
  { key:"PRACTICE_301_WINS_30", name:"3️⃣ 301 Dominator", description:"Win 30 games of 301 in practice", icon:"🎯", rarity:"Epic",   category:"Practice", hidden:false, priority:60, criteriaType:"PRACTICE_301_WINS", criteriaValue:30, engineType:"STAT_BASED" },
  // ── Cricket wins ─────────────────────────────────────────────────────────────
  { key:"PRACTICE_CRICKET_WINS_3",  name:"🦗 Cricket Rookie",    description:"Win 3 Cricket games in practice",  icon:"🦗", rarity:"Common",    category:"Practice", hidden:false, priority:20, criteriaType:"PRACTICE_CRICKET_WINS", criteriaValue:3,  engineType:"STAT_BASED" },
  { key:"PRACTICE_CRICKET_WINS_10", name:"🦗 Cricket Master",    description:"Win 10 Cricket games in practice", icon:"🦗", rarity:"Rare",      category:"Practice", hidden:false, priority:40, criteriaType:"PRACTICE_CRICKET_WINS", criteriaValue:10, engineType:"STAT_BASED" },
  { key:"PRACTICE_CRICKET_WINS_20", name:"🦗 Cricket Dominator", description:"Win 20 Cricket games in practice", icon:"🦗", rarity:"Epic",      category:"Practice", hidden:false, priority:60, criteriaType:"PRACTICE_CRICKET_WINS", criteriaValue:20, engineType:"STAT_BASED" },
  { key:"PRACTICE_CRICKET_WINS_40", name:"🦗 Cricket Legend",    description:"Win 40 Cricket games in practice", icon:"🦗", rarity:"Legendary", category:"Practice", hidden:false, priority:80, criteriaType:"PRACTICE_CRICKET_WINS", criteriaValue:40, engineType:"STAT_BASED" },
  // ── Killer wins ──────────────────────────────────────────────────────────────
  { key:"PRACTICE_KILLER_WINS_3",  name:"💀 Killer Starter",   description:"Win 3 Killer games in practice",  icon:"💀", rarity:"Common", category:"Practice", hidden:false, priority:20, criteriaType:"PRACTICE_KILLER_WINS", criteriaValue:3,  engineType:"STAT_BASED" },
  { key:"PRACTICE_KILLER_WINS_10", name:"💀 Killer Master",    description:"Win 10 Killer games in practice", icon:"💀", rarity:"Rare",   category:"Practice", hidden:false, priority:40, criteriaType:"PRACTICE_KILLER_WINS", criteriaValue:10, engineType:"STAT_BASED" },
  { key:"PRACTICE_KILLER_WINS_20", name:"💀 Killer Assassin",  description:"Win 20 Killer games in practice", icon:"💀", rarity:"Epic",   category:"Practice", hidden:false, priority:60, criteriaType:"PRACTICE_KILLER_WINS", criteriaValue:20, engineType:"STAT_BASED" },
  // ── Bot level wins ────────────────────────────────────────────────────────────
  { key:"PRACTICE_BOT_LEVEL_5_WINS_1",   name:"🤖 Bot Beater",        description:"Beat a Level 5 bot in practice",         icon:"🤖", rarity:"Common",    category:"Practice", hidden:false, priority:20, criteriaType:"PRACTICE_BOT_LEVEL_WINS", criteriaValue:5,  engineType:"STAT_BASED" },
  { key:"PRACTICE_BOT_LEVEL_5_WINS_3",   name:"🤖 Level 5 Warrior",   description:"Beat a Level 5 bot 3 times",             icon:"🤖", rarity:"Rare",      category:"Practice", hidden:false, priority:40, criteriaType:"PRACTICE_BOT_LEVEL_WINS", criteriaValue:5,  engineType:"STAT_BASED", secondaryCriteria:"win_count_vs_level", secondaryValue:3 },
  { key:"PRACTICE_BOT_LEVEL_10_WINS_5",  name:"🤖 Level 10 Master",   description:"Beat a Level 10 bot 5 times",            icon:"🤖", rarity:"Epic",      category:"Practice", hidden:false, priority:60, criteriaType:"PRACTICE_BOT_LEVEL_WINS", criteriaValue:10, engineType:"STAT_BASED", secondaryCriteria:"win_count_vs_level", secondaryValue:5 },
  { key:"PRACTICE_BOT_LEVEL_15_WINS_5",  name:"🤖 Level 15 Dominator",description:"Beat a Level 15 bot 5 times",            icon:"🤖", rarity:"Legendary", category:"Practice", hidden:false, priority:80, criteriaType:"PRACTICE_BOT_LEVEL_WINS", criteriaValue:15, engineType:"STAT_BASED", secondaryCriteria:"win_count_vs_level", secondaryValue:5 },
  { key:"PRACTICE_BOT_LEVEL_20_WINS_5",  name:"🤖 Level 20 Conqueror",description:"Beat the Level 20 (max) bot 5 times",    icon:"🤖", rarity:"Mythic",    category:"Practice", hidden:false, priority:90, criteriaType:"PRACTICE_BOT_LEVEL_WINS", criteriaValue:20, engineType:"STAT_BASED", secondaryCriteria:"win_count_vs_level", secondaryValue:5 },
  // ── Pro persona wins ──────────────────────────────────────────────────────────
  { key:"PRACTICE_BEAT_LUKE_3",   name:"🏴󠁧󠁢󠁥󠁮󠁧󠁿 Luke's Nemesis",    description:"Beat Luke Harbours 3 times in practice",      icon:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", rarity:"Rare", category:"Practice", hidden:false, priority:40, criteriaType:"PRACTICE_BOT_PRO_WINS", criteriaValue:3, engineType:"STAT_BASED", secondaryCriteria:"pro_name", secondaryValue:0 },
  { key:"PRACTICE_BEAT_LUCA_3",   name:"🏴󠁧󠁢󠁥󠁮󠁧󠁿 Luca Slayer",       description:"Beat Luca Scrawler 3 times in practice",      icon:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", rarity:"Rare", category:"Practice", hidden:false, priority:40, criteriaType:"PRACTICE_BOT_PRO_WINS", criteriaValue:3, engineType:"STAT_BASED", secondaryCriteria:"pro_name", secondaryValue:1 },
  { key:"PRACTICE_BEAT_MIKKEL_3", name:"🇳🇱 Green Machine Down",   description:"Beat Mikkel van Garwin 3 times in practice",  icon:"🇳🇱", rarity:"Rare", category:"Practice", hidden:false, priority:40, criteriaType:"PRACTICE_BOT_PRO_WINS", criteriaValue:3, engineType:"STAT_BASED", secondaryCriteria:"pro_name", secondaryValue:2 },
  { key:"PRACTICE_BEAT_PERRY_3",  name:"🏴󠁧󠁢󠁥󠁮󠁧󠁿 Snakebite Striker",  description:"Beat Perry Wight 3 times in practice",        icon:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", rarity:"Rare", category:"Practice", hidden:false, priority:40, criteriaType:"PRACTICE_BOT_PRO_WINS", criteriaValue:3, engineType:"STAT_BASED", secondaryCriteria:"pro_name", secondaryValue:6 },
  // ── Win streaks ───────────────────────────────────────────────────────────────
  { key:"PRACTICE_WIN_STREAK_3",  name:"🔥 Hot Hand",     description:"Win 3 practice games in a row",  icon:"🔥", rarity:"Common", category:"Practice", hidden:false, priority:20, criteriaType:"PRACTICE_WIN_STREAK", criteriaValue:3,  engineType:"STAT_BASED" },
  { key:"PRACTICE_WIN_STREAK_5",  name:"🔥 On Fire",      description:"Win 5 practice games in a row",  icon:"🔥", rarity:"Rare",   category:"Practice", hidden:false, priority:40, criteriaType:"PRACTICE_WIN_STREAK", criteriaValue:5,  engineType:"STAT_BASED" },
  { key:"PRACTICE_WIN_STREAK_10", name:"🔥 Unstoppable",  description:"Win 10 practice games in a row", icon:"🔥", rarity:"Epic",   category:"Practice", hidden:false, priority:60, criteriaType:"PRACTICE_WIN_STREAK", criteriaValue:10, engineType:"STAT_BASED" },
  // ── Single-session feats ──────────────────────────────────────────────────────
  { key:"PRACTICE_TRIPLE_180_GAME",  name:"🎯 Triple Trouble",  description:"Hit 3+ 180s in a single practice game", icon:"🎯", rarity:"Epic",      category:"Practice", hidden:false, priority:60, criteriaType:"PRACTICE_TRIPLE_180_GAME",  criteriaValue:3,   engineType:"STAT_BASED" },
  { key:"PRACTICE_PERFECT_SESSION",  name:"✅ Perfect Finish",  description:"Hit every checkout attempt in a session",icon:"✅", rarity:"Legendary", category:"Practice", hidden:false, priority:80, criteriaType:"PRACTICE_PERFECT_SESSION",  criteriaValue:100, engineType:"STAT_BASED" },

  // ══════════════════════════════════════════════════════════════════════════════
  // TIERED PER-GAME-TYPE SESSION ACHIEVEMENTS (5 / 10 / 25 / 50 / 100 sessions)
  // ══════════════════════════════════════════════════════════════════════════════
  ...makeSessionAchs("CRICKET",  "🦗", "Cricket",              [5,10,25,50,100], ["Cricket Beginner","Cricket Apprentice","Cricket Journeyman","Cricket Master","Cricket Legend"]),
  ...makeSessionAchs("501",      "🎯", "501",                   [5,10,25,50,100], ["501 Beginner","501 Apprentice","501 Journeyman","501 Master","501 Legend"]),
  ...makeSessionAchs("301",      "3️⃣", "301",                   [5,10,25,50,100], ["301 Beginner","301 Apprentice","301 Journeyman","301 Master","301 Legend"]),
  ...makeSessionAchs("GOLF",     "⛳", "Golf Darts",            [5,10,25,50,100], ["Golf Beginner","Golf Apprentice","Golf Journeyman","Golf Master","Golf Legend"]),
  ...makeSessionAchs("FOOTBALL", "⚽", "Football Darts",        [5,10,25,50,100], ["Football Beginner","Football Apprentice","Football Journeyman","Football Master","Football Legend"]),
  ...makeSessionAchs("SHANGHAI", "🎴", "Shanghai",              [5,10,25,50,100], ["Shanghai Beginner","Shanghai Apprentice","Shanghai Journeyman","Shanghai Master","Shanghai Legend"]),
  ...makeSessionAchs("HALVEIT",  "✂️", "Halve-It",              [5,10,25,50,100], ["Halve-It Beginner","Halve-It Apprentice","Halve-It Journeyman","Halve-It Master","Halve-It Legend"]),
  ...makeSessionAchs("COUNTUP",  "🔢", "Count Up",              [5,10,25,50,100], ["Count Up Beginner","Count Up Apprentice","Count Up Journeyman","Count Up Master","Count Up Legend"]),
  ...makeSessionAchs("BOBS27",   "🎱", "Bob's 27",              [5,10,25,50,100], ["Bob's 27 Beginner","Bob's 27 Apprentice","Bob's 27 Journeyman","Bob's 27 Master","Bob's 27 Legend"]),
  ...makeSessionAchs("ATW",      "🌍", "Around the World",      [5,10,25,50,100], ["Around the World Beginner","Around the World Apprentice","Around the World Journeyman","Around the World Master","Around the World Legend"]),
  ...makeSessionAchs("KILLER",   "💀", "Killer",                [5,10,25,50,100], ["Killer Beginner","Killer Apprentice","Killer Journeyman","Killer Master","Killer Legend"]),
  ...makeSessionAchs("CTD",      "🐉", "Chase the Dragon",      [5,10,25,50,100], ["Dragon Beginner","Dragon Apprentice","Dragon Journeyman","Dragon Master","Dragon Legend"]),
  ...makeSessionAchs("FIVES",    "5️⃣", "Fives",                 [5,10,25,50,100], ["Fives Beginner","Fives Apprentice","Fives Journeyman","Fives Master","Fives Legend"]),
  ...makeSessionAchs("BASEBALL", "⚾", "Baseball Darts",        [5,10,25,50,100], ["Baseball Beginner","Baseball Apprentice","Baseball Journeyman","Baseball Master","Baseball Legend"]),
  ...makeSessionAchs("SCRAM",    "🎲", "Scram",                 [5,10,25,50,100], ["Scram Beginner","Scram Apprentice","Scram Journeyman","Scram Master","Scram Legend"]),
  ...makeSessionAchs("ATC",      "🕐", "Around the Clock",      [5,10,25,50,100], ["Clock Beginner","Clock Apprentice","Clock Journeyman","Clock Master","Clock Legend"]),
];

// ─── grantIfNotHas (local to this module) ─────────────────────────────────────
async function grantIfNotHas(playerId: number, key: string): Promise<boolean> {
  const [ach] = await db.select().from(achievementsTable).where(eq(achievementsTable.key, key));
  if (!ach) return false;
  const [existing] = await db.select({ id: playerAchievementsTable.id })
    .from(playerAchievementsTable)
    .where(and(eq(playerAchievementsTable.playerId, playerId), eq(playerAchievementsTable.achievementId, ach.id)));
  if (existing) return false;
  await db.insert(playerAchievementsTable).values({ playerId, achievementId: ach.id });
  logger.info({ playerId, key }, "Practice achievement unlocked");
  return true;
}

export async function checkPracticeAchievements(playerId: number): Promise<void> {
  try {
    // ── Total 180s ──────────────────────────────────────────────────────────────
    const [r180] = (await db.execute(sql`
      SELECT COALESCE(SUM(p1_180s), 0)::int AS count
      FROM practice_sessions WHERE player1_id = ${playerId}
    `)).rows as { count: number }[];
    const total180s = r180?.count ?? 0;
    if (total180s >= 5)   await grantIfNotHas(playerId, "PRACTICE_TOTAL_180S_5");
    if (total180s >= 15)  await grantIfNotHas(playerId, "PRACTICE_TOTAL_180S_15");
    if (total180s >= 30)  await grantIfNotHas(playerId, "PRACTICE_TOTAL_180S_30");
    if (total180s >= 60)  await grantIfNotHas(playerId, "PRACTICE_TOTAL_180S_60");
    if (total180s >= 100) await grantIfNotHas(playerId, "PRACTICE_TOTAL_180S_100");

    // ── Triple 180 in a single game ────────────────────────────────────────────
    const [rTriple] = (await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM practice_sessions
      WHERE player1_id = ${playerId} AND p1_180s >= 3
    `)).rows as { count: number }[];
    if ((rTriple?.count ?? 0) >= 1) await grantIfNotHas(playerId, "PRACTICE_TRIPLE_180_GAME");

    // ── 100+ checkouts (tracked via p1_score on checkout session or session_data) ─
    // We approximate: sessions where p1_checkout_hits > 0 and p1_score_per_dart was high.
    // More reliably: count sessions where a checkout happened with high value from session_data.
    const [r100plus] = (await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM practice_sessions
      WHERE player1_id = ${playerId}
        AND p1_checkout_hits > 0
        AND p1_score::float / NULLIF(p1_checkout_hits, 0) >= 100
    `)).rows as { count: number }[];
    const count100plus = r100plus?.count ?? 0;
    if (count100plus >= 1)  await grantIfNotHas(playerId, "PRACTICE_100_PLUS_CHECKOUT_1");
    if (count100plus >= 5)  await grantIfNotHas(playerId, "PRACTICE_100_PLUS_CHECKOUT_5");
    if (count100plus >= 10) await grantIfNotHas(playerId, "PRACTICE_100_PLUS_CHECKOUT_10");

    // ── Total checkouts hit ─────────────────────────────────────────────────────
    const [rCO] = (await db.execute(sql`
      SELECT COALESCE(SUM(p1_checkout_hits), 0)::int AS count
      FROM practice_sessions WHERE player1_id = ${playerId}
    `)).rows as { count: number }[];
    const totalCO = rCO?.count ?? 0;
    if (totalCO >= 5)   await grantIfNotHas(playerId, "PRACTICE_ALL_CHECKOUTS_5");
    if (totalCO >= 15)  await grantIfNotHas(playerId, "PRACTICE_ALL_CHECKOUTS_15");
    if (totalCO >= 30)  await grantIfNotHas(playerId, "PRACTICE_ALL_CHECKOUTS_30");
    if (totalCO >= 60)  await grantIfNotHas(playerId, "PRACTICE_ALL_CHECKOUTS_60");
    if (totalCO >= 100) await grantIfNotHas(playerId, "PRACTICE_ALL_CHECKOUTS_100");

    // ── Perfect session (100% checkout accuracy) ────────────────────────────────
    const [rPerf] = (await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM practice_sessions
      WHERE player1_id = ${playerId}
        AND p1_checkout_attempts > 0
        AND p1_checkout_attempts = p1_checkout_hits
    `)).rows as { count: number }[];
    if ((rPerf?.count ?? 0) >= 1) await grantIfNotHas(playerId, "PRACTICE_PERFECT_SESSION");

    // ── Total wins ──────────────────────────────────────────────────────────────
    const [rWins] = (await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM practice_sessions
      WHERE player1_id = ${playerId} AND winner_idx = 0
    `)).rows as { count: number }[];
    const totalWins = rWins?.count ?? 0;
    if (totalWins >= 5)   await grantIfNotHas(playerId, "PRACTICE_TOTAL_WINS_5");
    if (totalWins >= 15)  await grantIfNotHas(playerId, "PRACTICE_TOTAL_WINS_15");
    if (totalWins >= 30)  await grantIfNotHas(playerId, "PRACTICE_TOTAL_WINS_30");
    if (totalWins >= 60)  await grantIfNotHas(playerId, "PRACTICE_TOTAL_WINS_60");
    if (totalWins >= 100) await grantIfNotHas(playerId, "PRACTICE_TOTAL_WINS_100");

    // ── Win streak ──────────────────────────────────────────────────────────────
    const recentSessions = (await db.execute(sql`
      SELECT winner_idx FROM practice_sessions
      WHERE player1_id = ${playerId}
      ORDER BY created_at DESC
      LIMIT 20
    `)).rows as { winner_idx: number | null }[];
    let streak = 0, maxStreak = 0;
    for (const s of recentSessions) {
      if (s.winner_idx === 0) { streak++; maxStreak = Math.max(maxStreak, streak); }
      else streak = 0;
    }
    if (maxStreak >= 3)  await grantIfNotHas(playerId, "PRACTICE_WIN_STREAK_3");
    if (maxStreak >= 5)  await grantIfNotHas(playerId, "PRACTICE_WIN_STREAK_5");
    if (maxStreak >= 10) await grantIfNotHas(playerId, "PRACTICE_WIN_STREAK_10");

    // ── Total sessions ──────────────────────────────────────────────────────────
    const [rSess] = (await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM practice_sessions
      WHERE player1_id = ${playerId}
    `)).rows as { count: number }[];
    const totalSess = rSess?.count ?? 0;
    if (totalSess >= 10)  await grantIfNotHas(playerId, "PRACTICE_TOTAL_SESSIONS_10");
    if (totalSess >= 25)  await grantIfNotHas(playerId, "PRACTICE_TOTAL_SESSIONS_25");
    if (totalSess >= 50)  await grantIfNotHas(playerId, "PRACTICE_TOTAL_SESSIONS_50");
    if (totalSess >= 100) await grantIfNotHas(playerId, "PRACTICE_TOTAL_SESSIONS_100");

    // ── 501 double-out wins ─────────────────────────────────────────────────────
    const [r501] = (await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM practice_sessions
      WHERE player1_id = ${playerId} AND winner_idx = 0
        AND game_type_key LIKE '%double_out%'
    `)).rows as { count: number }[];
    const count501 = r501?.count ?? 0;
    if (count501 >= 5)   await grantIfNotHas(playerId, "PRACTICE_X01_DOUBLE_OUT_WINS_5");
    if (count501 >= 15)  await grantIfNotHas(playerId, "PRACTICE_X01_DOUBLE_OUT_WINS_15");
    if (count501 >= 30)  await grantIfNotHas(playerId, "PRACTICE_X01_DOUBLE_OUT_WINS_30");
    if (count501 >= 60)  await grantIfNotHas(playerId, "PRACTICE_X01_DOUBLE_OUT_WINS_60");
    if (count501 >= 100) await grantIfNotHas(playerId, "PRACTICE_X01_DOUBLE_OUT_WINS_100");

    // ── 301 wins ────────────────────────────────────────────────────────────────
    const [r301] = (await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM practice_sessions
      WHERE player1_id = ${playerId} AND winner_idx = 0
        AND game_type_key LIKE '301%'
    `)).rows as { count: number }[];
    const count301 = r301?.count ?? 0;
    if (count301 >= 5)  await grantIfNotHas(playerId, "PRACTICE_301_WINS_5");
    if (count301 >= 15) await grantIfNotHas(playerId, "PRACTICE_301_WINS_15");
    if (count301 >= 30) await grantIfNotHas(playerId, "PRACTICE_301_WINS_30");

    // ── Cricket wins ────────────────────────────────────────────────────────────
    const [rCricket] = (await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM practice_sessions
      WHERE player1_id = ${playerId} AND winner_idx = 0
        AND (game_type_key LIKE '%cricket%')
    `)).rows as { count: number }[];
    const countCricket = rCricket?.count ?? 0;
    if (countCricket >= 3)  await grantIfNotHas(playerId, "PRACTICE_CRICKET_WINS_3");
    if (countCricket >= 10) await grantIfNotHas(playerId, "PRACTICE_CRICKET_WINS_10");
    if (countCricket >= 20) await grantIfNotHas(playerId, "PRACTICE_CRICKET_WINS_20");
    if (countCricket >= 40) await grantIfNotHas(playerId, "PRACTICE_CRICKET_WINS_40");

    // ── Killer wins ─────────────────────────────────────────────────────────────
    const [rKiller] = (await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM practice_sessions
      WHERE player1_id = ${playerId} AND winner_idx = 0
        AND game_type_key LIKE '%killer%'
    `)).rows as { count: number }[];
    const countKiller = rKiller?.count ?? 0;
    if (countKiller >= 3)  await grantIfNotHas(playerId, "PRACTICE_KILLER_WINS_3");
    if (countKiller >= 10) await grantIfNotHas(playerId, "PRACTICE_KILLER_WINS_10");
    if (countKiller >= 20) await grantIfNotHas(playerId, "PRACTICE_KILLER_WINS_20");

    // ── Per-game-type session counts ────────────────────────────────────────────
    const gamePatterns: Array<{ key: string; like: string }> = [
      { key: "CRICKET",  like: "%cricket%" },
      { key: "501",      like: "%501%" },
      { key: "301",      like: "301%" },
      { key: "GOLF",     like: "%golf%" },
      { key: "FOOTBALL", like: "%football%" },
      { key: "SHANGHAI", like: "%shanghai%" },
      { key: "HALVEIT",  like: "%halve%it%" },
      { key: "COUNTUP",  like: "%count%up%" },
      { key: "BOBS27",   like: "%bob%" },
      { key: "ATW",      like: "%around%world%" },
      { key: "KILLER",   like: "%killer%" },
      { key: "CTD",      like: "%chase%dragon%" },
      { key: "FIVES",    like: "%fives%" },
      { key: "BASEBALL", like: "%baseball%" },
      { key: "SCRAM",    like: "%scram%" },
      { key: "ATC",      like: "%clock%" },
    ];

    for (const { key, like } of gamePatterns) {
      const [rG] = (await db.execute(sql`
        SELECT COUNT(*)::int AS count FROM practice_sessions
        WHERE player1_id = ${playerId}
          AND game_type_key LIKE ${like}
      `)).rows as { count: number }[];
      const n = rG?.count ?? 0;
      if (n >= 5)   await grantIfNotHas(playerId, `PRACTICE_${key}_SESSIONS_5`);
      if (n >= 10)  await grantIfNotHas(playerId, `PRACTICE_${key}_SESSIONS_10`);
      if (n >= 25)  await grantIfNotHas(playerId, `PRACTICE_${key}_SESSIONS_25`);
      if (n >= 50)  await grantIfNotHas(playerId, `PRACTICE_${key}_SESSIONS_50`);
      if (n >= 100) await grantIfNotHas(playerId, `PRACTICE_${key}_SESSIONS_100`);
    }

  } catch (err) {
    logger.error({ err, playerId }, "Error checking practice achievements");
  }
}
