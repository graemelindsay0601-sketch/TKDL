import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

// ─── Title definitions ────────────────────────────────────────────────────────

export type TitleRarity = "Common" | "Rare" | "Epic" | "Legendary";

export interface TitleDef {
  key: string;
  title: string;
  description: string;
  rarity: TitleRarity;
  category: "starter" | "master501" | "league" | "bot" | "tour" | "hidden";
  icon: string;
  requiresAchievement: string; // single achievement key that unlocks this title
}

export const TITLE_DEFINITIONS: TitleDef[] = [

  // ── Starter ───────────────────────────────────────────────────────────────────
  { key:"TITLE_THE_DARTER",       title:"The Darter",        description:"Win your first Master-501 match",                  rarity:"Common",    category:"starter",   icon:"🎯", requiresAchievement:"M501_FIRST_WIN" },
  { key:"TITLE_TRIPLE_TON",       title:"Triple Ton",        description:"Land your first 180",                              rarity:"Common",    category:"starter",   icon:"💯", requiresAchievement:"M501_FIRST_180" },
  { key:"TITLE_FIRST_FINISH",     title:"First Finish",      description:"Land your first checkout in Master-501",           rarity:"Common",    category:"starter",   icon:"✅", requiresAchievement:"M501_FIRST_CO" },
  { key:"TITLE_GETTING_GOING",    title:"Getting Going",     description:"Complete 10 Master-501 runs",                      rarity:"Common",    category:"starter",   icon:"📋", requiresAchievement:"M501_TEN_RUNS" },
  { key:"TITLE_HAT_TRICK",        title:"Hat-Trick",         description:"Win 3 Master-501 matches",                         rarity:"Common",    category:"starter",   icon:"🎯", requiresAchievement:"M501_WIN_3" },
  { key:"TITLE_25_RUNS",          title:"The Regular",       description:"Complete 25 Master-501 runs",                      rarity:"Common",    category:"starter",   icon:"📋", requiresAchievement:"M501_RUNS_25" },

  // ── Streaks ───────────────────────────────────────────────────────────────────
  { key:"TITLE_ON_HEAT",          title:"On Heat",           description:"Win 3 consecutive Master-501 matches",             rarity:"Rare",      category:"master501", icon:"🔥", requiresAchievement:"M501_HEAT" },
  { key:"TITLE_ELECTRIC",         title:"Electric",          description:"Win 5 consecutive Master-501 matches",             rarity:"Rare",      category:"master501", icon:"⚡", requiresAchievement:"M501_ON_FIRE" },
  { key:"TITLE_MAGNIFICENT_SEVEN",title:"Magnificent Seven", description:"Win 7 consecutive Master-501 matches",             rarity:"Epic",      category:"master501", icon:"⚡", requiresAchievement:"M501_STREAK_7" },
  { key:"TITLE_UNSTOPPABLE",      title:"Unstoppable",       description:"Win 10 consecutive Master-501 matches",            rarity:"Legendary", category:"master501", icon:"🌪️", requiresAchievement:"M501_UNSTOPPABLE" },
  { key:"TITLE_FIFTEEN_STRAIGHT", title:"Fifteen Straight",  description:"Win 15 consecutive Master-501 matches",            rarity:"Legendary", category:"master501", icon:"🌪️", requiresAchievement:"M501_STREAK_15" },
  { key:"TITLE_TWENTY_STRAIGHT",  title:"Twenty Straight",   description:"Win 20 consecutive Master-501 matches",            rarity:"Legendary", category:"master501", icon:"👑", requiresAchievement:"M501_STREAK_20" },

  // ── Tier progression ─────────────────────────────────────────────────────────
  { key:"TITLE_CHALLENGER",       title:"The Challenger",    description:"Clear the Challenger tier",                        rarity:"Common",    category:"master501", icon:"🥈", requiresAchievement:"M501_CHALLENGER_CLEAR" },
  { key:"TITLE_CIRCUIT_PRO",      title:"Circuit Pro",       description:"Clear the Pro Circuit tier",                       rarity:"Rare",      category:"master501", icon:"🥇", requiresAchievement:"M501_PRO_CLEAR" },
  { key:"TITLE_PREMIER_CLASS",    title:"Premier Class",     description:"Clear the Premier tier",                           rarity:"Epic",      category:"master501", icon:"💎", requiresAchievement:"M501_PREMIER_CLEAR" },
  { key:"TITLE_GRAND_PRIX",       title:"Grand Prix Winner", description:"Clear the Grand Prix tier",                        rarity:"Epic",      category:"master501", icon:"🏁", requiresAchievement:"M501_GRAND_PRIX_CLEAR" },
  { key:"TITLE_WORLD_CHAMPION",   title:"World Champion",    description:"Conquer the World Championship tier",              rarity:"Legendary", category:"master501", icon:"👑", requiresAchievement:"M501_WORLD_CHAMP" },
  { key:"TITLE_WORLD_STAGE",      title:"World Stage",       description:"Reach the World Championship tier",                rarity:"Epic",      category:"master501", icon:"🔴", requiresAchievement:"M501_REACH_T5" },

  // ── Wins ─────────────────────────────────────────────────────────────────────
  { key:"TITLE_FIVE_STAR",        title:"Five-Star",         description:"Win 5 Master-501 matches",                         rarity:"Common",    category:"master501", icon:"🥅", requiresAchievement:"M501_WIN_5" },
  { key:"TITLE_QUARTER_CENTURY",  title:"Quarter Century",   description:"Win 25 Master-501 matches",                        rarity:"Rare",      category:"master501", icon:"🏅", requiresAchievement:"M501_WIN_25" },
  { key:"TITLE_HALF_CENTURY",     title:"Half Century",      description:"Win 50 Master-501 matches",                        rarity:"Rare",      category:"master501", icon:"🥈", requiresAchievement:"M501_WIN_50" },
  { key:"TITLE_75_WINS",          title:"75 Win Club",       description:"Win 75 Master-501 matches",                        rarity:"Epic",      category:"master501", icon:"🥇", requiresAchievement:"M501_WIN_75" },
  { key:"TITLE_THE_CENTURION",    title:"The Centurion",     description:"Win 100 Master-501 matches",                       rarity:"Epic",      category:"master501", icon:"💯", requiresAchievement:"M501_WIN_100" },
  { key:"TITLE_200_WINS",         title:"200 Wins",          description:"Win 200 Master-501 matches",                       rarity:"Legendary", category:"master501", icon:"👑", requiresAchievement:"M501_WIN_200" },

  // ── 180s ─────────────────────────────────────────────────────────────────────
  { key:"TITLE_TON80_COLLECTOR",  title:"Ton-80 Collector",  description:"Hit 5 total 180s in Master-501",                   rarity:"Rare",      category:"master501", icon:"🎯", requiresAchievement:"M501_180_FIVE" },
  { key:"TITLE_MAX_MACHINE",      title:"Maximum Machine",   description:"Hit 20 total 180s in Master-501",                  rarity:"Epic",      category:"master501", icon:"🔥", requiresAchievement:"M501_180_TWENTY" },
  { key:"TITLE_MAX_LEGEND",       title:"Maximum Legend",    description:"Hit 50 total 180s in Master-501",                  rarity:"Legendary", category:"master501", icon:"👑", requiresAchievement:"M501_180_FIFTY" },
  { key:"TITLE_MAX_FRENZY",       title:"Maximum Frenzy",    description:"Hit 5 180s in a single match",                     rarity:"Legendary", category:"master501", icon:"🔥", requiresAchievement:"M501_MATCH_5_180S" },
  { key:"TITLE_HAT_MAX",          title:"Hat-Trick of Maxes","description":"Hit 3 180s in a single match",                   rarity:"Epic",      category:"master501", icon:"🎯", requiresAchievement:"M501_MATCH_3_180S" },

  // ── Averages ─────────────────────────────────────────────────────────────────
  { key:"TITLE_SOLID_AVERAGE",    title:"Solid Average",     description:"Post 80+ average in Master-501",                   rarity:"Rare",      category:"master501", icon:"📊", requiresAchievement:"M501_AVG_80" },
  { key:"TITLE_QUALITY_PLAYER",   title:"Quality Player",    description:"Post 90+ average in Master-501",                   rarity:"Epic",      category:"master501", icon:"📈", requiresAchievement:"M501_AVG_90" },
  { key:"TITLE_CENTURY_AVERAGE",  title:"Century Average",   description:"Post 100+ average in Master-501",                  rarity:"Legendary", category:"master501", icon:"💯", requiresAchievement:"M501_AVG_100" },
  { key:"TITLE_WORLD_CLASS_AVG",  title:"World Class",       description:"Post 110+ average in Master-501",                  rarity:"Legendary", category:"master501", icon:"👑", requiresAchievement:"M501_AVG_110" },
  { key:"TITLE_LEGENDARY_AVG",    title:"The Legend",        description:"Post 120+ average in Master-501",                  rarity:"Legendary", category:"master501", icon:"👑", requiresAchievement:"M501_AVG_120" },

  // ── Checkouts ─────────────────────────────────────────────────────────────────
  { key:"TITLE_SHARP_FINISHER",   title:"Sharp Finisher",    description:"Land 10 checkouts in Master-501",                  rarity:"Rare",      category:"master501", icon:"🎯", requiresAchievement:"M501_CO_TEN" },
  { key:"TITLE_THE_FINISHER",     title:"The Finisher",      description:"Land 50 checkouts in Master-501",                  rarity:"Epic",      category:"master501", icon:"🏹", requiresAchievement:"M501_CO_FIFTY" },
  { key:"TITLE_PRECISION",        title:"Precision Finisher", description:"Hit 50%+ checkout rate in Master-501",             rarity:"Epic",      category:"master501", icon:"🏹", requiresAchievement:"M501_CO_RATE" },
  { key:"TITLE_ICE_VEINS",        title:"Ice Veins",         description:"Hit 60%+ checkout rate over 20+ attempts",         rarity:"Epic",      category:"master501", icon:"🏹", requiresAchievement:"M501_CO_RATE_60" },
  { key:"TITLE_COLD_AS_STEEL",    title:"Cold as Steel",     description:"Hit 70%+ checkout rate over 30+ attempts",         rarity:"Legendary", category:"master501", icon:"🏹", requiresAchievement:"M501_CO_RATE_70" },

  // ── Flawless ─────────────────────────────────────────────────────────────────
  { key:"TITLE_CLEAN_SWEEP",      title:"Clean Sweep",       description:"Win a BO5 without dropping a leg",                 rarity:"Rare",      category:"master501", icon:"🛡️", requiresAchievement:"M501_FLAWLESS_5" },
  { key:"TITLE_DOMINANT",         title:"Dominant",          description:"Win a BO9 without dropping a leg",                 rarity:"Epic",      category:"master501", icon:"🌟", requiresAchievement:"M501_FLAWLESS_9" },
  { key:"TITLE_GRAND_SLAM",       title:"Grand Slam",        description:"Win a BO11 without dropping a leg",                rarity:"Legendary", category:"master501", icon:"🌟", requiresAchievement:"M501_GRAND_SLAM" },

  // ── Drama ─────────────────────────────────────────────────────────────────────
  { key:"TITLE_LAST_GASP",        title:"Last Gasp",         description:"Win a match in the deciding leg",                  rarity:"Rare",      category:"master501", icon:"😤", requiresAchievement:"M501_LAST_GASP" },
  { key:"TITLE_MARATHON_MAN",     title:"Marathon Man",      description:"Win 3 matches in the deciding leg",                rarity:"Epic",      category:"master501", icon:"💪", requiresAchievement:"M501_MARATHON_3" },
  { key:"TITLE_THE_SURVIVOR",     title:"The Survivor",      description:"Win 10 matches in the deciding leg",               rarity:"Legendary", category:"master501", icon:"🌪️", requiresAchievement:"M501_LAST_GASP_10" },

  // ── Grind ─────────────────────────────────────────────────────────────────────
  { key:"TITLE_THE_GRINDER",      title:"The Grinder",       description:"Complete 50 Master-501 runs",                      rarity:"Rare",      category:"master501", icon:"🎲", requiresAchievement:"M501_FIFTY_RUNS" },
  { key:"TITLE_CENTURION_RUNS",   title:"Centurion",         description:"Complete 100 Master-501 runs",                     rarity:"Epic",      category:"master501", icon:"💯", requiresAchievement:"M501_CENTURY_RUNS" },
  { key:"TITLE_300_RUNS",         title:"300",               description:"Complete 300 Master-501 runs",                     rarity:"Legendary", category:"master501", icon:"👑", requiresAchievement:"M501_RUNS_300" },

  // ── Darts ─────────────────────────────────────────────────────────────────────
  { key:"TITLE_THOUSAND_DARTS",   title:"Thousand Darts",    description:"Throw 1,000 darts in Master-501",                  rarity:"Rare",      category:"master501", icon:"🎯", requiresAchievement:"M501_DARTS_1000" },
  { key:"TITLE_FIVE_THOUSAND",    title:"Five Thousand",     description:"Throw 5,000 darts in Master-501",                  rarity:"Epic",      category:"master501", icon:"🎯", requiresAchievement:"M501_DARTS_5000" },
  { key:"TITLE_TEN_THOUSAND",     title:"Ten Thousand Darts","description":"Throw 10,000 darts in Master-501",               rarity:"Legendary", category:"master501", icon:"👑", requiresAchievement:"M501_DARTS_10000" },

  // ── Session binge ─────────────────────────────────────────────────────────────
  { key:"TITLE_MARATHON_DAY",     title:"Marathon Day",      description:"Complete 5 Master-501 runs in one day",            rarity:"Epic",      category:"master501", icon:"🎲", requiresAchievement:"M501_BINGE_5" },
  { key:"TITLE_DEDICATED",        title:"Dedicated",         description:"Complete 10 Master-501 runs in one day",           rarity:"Legendary", category:"master501", icon:"🎲", requiresAchievement:"M501_BINGE_10" },

];

// ─── Rarity colours ───────────────────────────────────────────────────────────

export const TITLE_RARITY_COLOR: Record<TitleRarity, string> = {
  Common:    "#9ca3af",
  Rare:      "#3b82f6",
  Epic:      "#a855f7",
  Legendary: "#ffd24a",
};

// ─── DB helpers ───────────────────────────────────────────────────────────────

export async function seedTitles(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS player_titles (
      id          SERIAL PRIMARY KEY,
      player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      title_key   TEXT NOT NULL,
      unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(player_id, title_key)
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_player_titles_pid ON player_titles(player_id)`);
  await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS active_title TEXT`);
  logger.info("Titles table ready");
}

async function grantTitle(playerId: number, titleKey: string): Promise<boolean> {
  try {
    await db.execute(sql`
      INSERT INTO player_titles (player_id, title_key)
      VALUES (${playerId}, ${titleKey})
      ON CONFLICT (player_id, title_key) DO NOTHING
    `);
    return true;
  } catch {
    return false;
  }
}

// ─── Check + grant titles based on current achievement set ───────────────────

export async function checkAndGrantTitles(playerId: number): Promise<void> {
  try {
    const achRows = await db.execute(sql`
      SELECT a.key FROM player_achievements pa
      JOIN achievements a ON a.id = pa.achievement_id
      WHERE pa.player_id = ${playerId}
    `);
    const unlockedKeys = new Set((achRows.rows as any[]).map(r => r.key as string));

    for (const def of TITLE_DEFINITIONS) {
      if (unlockedKeys.has(def.requiresAchievement)) {
        await grantTitle(playerId, def.key);
      }
    }
  } catch (err) {
    logger.error({ err, playerId }, "[Titles] checkAndGrantTitles failed");
  }
}

// ─── Get earned titles for a player ─────────────────────────────────────────

export async function getPlayerTitles(playerId: number): Promise<Array<TitleDef & { unlockedAt: string }>> {
  const rows = await db.execute(sql`
    SELECT title_key, unlocked_at FROM player_titles WHERE player_id = ${playerId}
  `);
  const earned = new Map((rows.rows as any[]).map(r => [r.title_key as string, r.unlocked_at as string]));
  return TITLE_DEFINITIONS
    .filter(d => earned.has(d.key))
    .map(d => ({ ...d, unlockedAt: earned.get(d.key)! }));
}
