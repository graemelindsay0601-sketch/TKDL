import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TitleRarity = "Common" | "Rare" | "Epic" | "Legendary";
export type TitleSource = "league" | "shadow_bot" | "tour";

export interface TitleDef {
  key:                  string;
  title:                string;
  description:          string;
  rarity:               TitleRarity;
  category:             string;
  icon:                 string;
  requiresAchievement:  string;
  achievementSource?:   TitleSource; // default "league" (main achievements table)
}

// ─── Rarity colours ───────────────────────────────────────────────────────────

export const TITLE_RARITY_COLOR: Record<TitleRarity, string> = {
  Common:    "#9ca3af",
  Rare:      "#3b82f6",
  Epic:      "#a855f7",
  Legendary: "#ffd24a",
};

// ─── Title definitions ────────────────────────────────────────────────────────

export const TITLE_DEFINITIONS: TitleDef[] = [

  // ── League — First steps ───────────────────────────────────────────────────
  { key:"TITLE_FIRST_BLOOD",      title:"First Blood",        description:"Win your first league match",                       rarity:"Common",    category:"league",    icon:"🩸", requiresAchievement:"FIRST_BLOOD" },
  { key:"TITLE_SEASON_STARTER",   title:"Season Starter",     description:"Play your first season match",                      rarity:"Common",    category:"league",    icon:"🚀", requiresAchievement:"SEASON_STARTER" },
  { key:"TITLE_THE_CLIMBER",      title:"The Climber",        description:"Climb the Elo rankings",                            rarity:"Common",    category:"league",    icon:"📈", requiresAchievement:"CLIMBER" },
  { key:"TITLE_BRONZE_BLOODED",   title:"Bronze Blooded",     description:"Earn Bronze tier status",                           rarity:"Common",    category:"league",    icon:"🥉", requiresAchievement:"BRONZE_BLOODED" },
  { key:"TITLE_FIGHTER",          title:"The Fighter",        description:"Never give up on a match",                          rarity:"Common",    category:"league",    icon:"🥊", requiresAchievement:"FIGHTER" },
  { key:"TITLE_WARMED_UP",        title:"Warmed Up",          description:"Play 10 games across all modes",                    rarity:"Common",    category:"league",    icon:"🔥", requiresAchievement:"WARMED_UP" },

  // ── League — Rivalry & competition ───────────────────────────────────────
  { key:"TITLE_DUELIST",          title:"The Duelist",        description:"Establish a head-to-head rivalry",                  rarity:"Rare",      category:"league",    icon:"⚔️", requiresAchievement:"DUELIST" },
  { key:"TITLE_HEAT_CHECK",       title:"Heat Check",         description:"Win 3 in a row",                                    rarity:"Rare",      category:"league",    icon:"🔥", requiresAchievement:"HEAT_CHECK" },
  { key:"TITLE_RIVAL_BREAKER",    title:"Rival Breaker",      description:"Break a losing streak against a rival",             rarity:"Epic",      category:"league",    icon:"💥", requiresAchievement:"RIVAL_BREAKER" },
  { key:"TITLE_KING_SLAYER",      title:"King Slayer",        description:"Beat the season leader",                            rarity:"Epic",      category:"league",    icon:"👑", requiresAchievement:"KING_SLAYER" },
  { key:"TITLE_COMEBACK_KING",    title:"Comeback King",      description:"Win after a losing streak",                         rarity:"Epic",      category:"league",    icon:"🔄", requiresAchievement:"COMEBACK_KING" },
  { key:"TITLE_NEMESIS",          title:"The Nemesis",        description:"Become someone's nemesis",                          rarity:"Rare",      category:"league",    icon:"😈", requiresAchievement:"NEMESIS_RELATIONSHIP" },
  { key:"TITLE_UNDERDOG",         title:"The Underdog",       description:"Upset a higher-rated player",                       rarity:"Rare",      category:"league",    icon:"🐕", requiresAchievement:"UNDERDOG_SPECIAL" },
  { key:"TITLE_GIANT_KILLER",     title:"Giant Killer",       description:"Beat a significantly higher-rated opponent",        rarity:"Epic",      category:"league",    icon:"🗡️", requiresAchievement:"GIANT_KILLER" },

  // ── League — Elo & ranking ────────────────────────────────────────────────
  { key:"TITLE_SILVER_STANDARD",  title:"Silver Standard",    description:"Reach Silver tier",                                 rarity:"Rare",      category:"league",    icon:"🥈", requiresAchievement:"SILVER_STANDARD" },
  { key:"TITLE_CENTURY_POINTS",   title:"Century Points",     description:"Score 100 season points",                           rarity:"Rare",      category:"league",    icon:"💯", requiresAchievement:"CENTURY_POINTS" },
  { key:"TITLE_ELO_1200",         title:"1200 Club",          description:"Reach 1200 Elo",                                    rarity:"Epic",      category:"league",    icon:"📊", requiresAchievement:"ELO_1200" },
  { key:"TITLE_ELO_1300",         title:"1300 Club",          description:"Reach 1300 Elo",                                    rarity:"Legendary", category:"league",    icon:"📊", requiresAchievement:"ELO_1300" },
  { key:"TITLE_ROCK_SOLID",       title:"Rock Solid",         description:"Maintain a solid defensive record",                 rarity:"Rare",      category:"league",    icon:"🪨", requiresAchievement:"ROCK_SOLID" },
  { key:"TITLE_IRON_WALL",        title:"Iron Wall",          description:"Become near unbeatable",                            rarity:"Epic",      category:"league",    icon:"🛡️", requiresAchievement:"IRON_WALL" },

  // ── League — Career milestones ────────────────────────────────────────────
  { key:"TITLE_VETERAN",          title:"The Veteran",        description:"A seasoned campaigner",                             rarity:"Rare",      category:"league",    icon:"🎖️", requiresAchievement:"VETERAN" },
  { key:"TITLE_PROFESSIONAL",     title:"The Professional",   description:"Play 200 career games",                             rarity:"Epic",      category:"league",    icon:"💼", requiresAchievement:"PROFESSIONAL" },
  { key:"TITLE_PREDATOR",         title:"The Predator",       description:"Hunt down opponents relentlessly",                  rarity:"Epic",      category:"league",    icon:"🦅", requiresAchievement:"PREDATOR" },
  { key:"TITLE_CONQUEROR",        title:"The Conqueror",      description:"Dominate across all formats",                       rarity:"Epic",      category:"league",    icon:"🏆", requiresAchievement:"CONQUEROR" },
  { key:"TITLE_ASSASSIN",         title:"The Assassin",       description:"Clinical and ruthless",                             rarity:"Legendary", category:"league",    icon:"🗡️", requiresAchievement:"ASSASSIN" },
  { key:"TITLE_KILBIRNIE_LION",   title:"Kilbirnie Lion",     description:"The pride of Kilbirnie",                            rarity:"Legendary", category:"league",    icon:"🦁", requiresAchievement:"KILBIRNIE_LION" },
  { key:"TITLE_LEGEND",           title:"Legend",             description:"A true legend of the league",                       rarity:"Legendary", category:"league",    icon:"⭐", requiresAchievement:"LEGEND" },
  { key:"TITLE_HALL_OF_FAME",     title:"Hall of Fame",       description:"Inducted into the TKDL Hall of Fame",               rarity:"Legendary", category:"league",    icon:"🏛️", requiresAchievement:"HALL_OF_FAME" },
  { key:"TITLE_DYNASTY",          title:"Dynasty",            description:"Build a lasting legacy",                            rarity:"Legendary", category:"league",    icon:"👑", requiresAchievement:"DYNASTY" },
  { key:"TITLE_PERFECT_SEASON",   title:"Perfect Season",     description:"Complete a perfect season",                         rarity:"Legendary", category:"league",    icon:"⚡", requiresAchievement:"PERFECT_SEASON" },
  { key:"TITLE_BACK_TO_BACK",     title:"Back-to-Back",       description:"Win back-to-back seasons",                          rarity:"Legendary", category:"league",    icon:"🔁", requiresAchievement:"BACK_TO_BACK_TITLE" },

  // ── Practice — Getting going ──────────────────────────────────────────────
  { key:"TITLE_GETTING_STARTED",  title:"Getting Started",    description:"Complete 10 practice sessions",                     rarity:"Common",    category:"practice",  icon:"📋", requiresAchievement:"PRACTICE_TOTAL_SESSIONS_10" },
  { key:"TITLE_REGULAR",          title:"The Regular",        description:"A familiar face at the oche",                       rarity:"Common",    category:"practice",  icon:"🗓️", requiresAchievement:"REGULAR_PLAYER" },
  { key:"TITLE_MOST_ACTIVE",      title:"Most Active",        description:"Most active player in the league",                  rarity:"Rare",      category:"practice",  icon:"⚡", requiresAchievement:"MOST_ACTIVE" },
  { key:"TITLE_DEDICATED",        title:"Dedicated",          description:"Reach 100 practice sessions",                       rarity:"Rare",      category:"practice",  icon:"💪", requiresAchievement:"PRACTICE_TOTAL_SESSIONS_25" },
  { key:"TITLE_GRIND_100",        title:"Centurion Sessions", description:"Reach 100 total practice sessions",                 rarity:"Epic",      category:"practice",  icon:"💯", requiresAchievement:"PRACTICE_TOTAL_SESSIONS_100" },
  { key:"TITLE_SHOWMAN",          title:"The Showman",        description:"Show off across all modes",                         rarity:"Rare",      category:"practice",  icon:"🎭", requiresAchievement:"SHOWMAN" },

  // ── Practice — Game variety ───────────────────────────────────────────────
  { key:"TITLE_GAME_HOPPER",      title:"Game Hopper",        description:"Play 10 different game types",                      rarity:"Rare",      category:"practice",  icon:"🎮", requiresAchievement:"GAME_HOPPER_10" },
  { key:"TITLE_JACK_OF_ALL",      title:"Jack of All",        description:"Master every game format",                          rarity:"Epic",      category:"practice",  icon:"🌐", requiresAchievement:"JACK_OF_ALL" },
  { key:"TITLE_WORLD_TOUR",       title:"World Tour",         description:"Tour every game mode",                              rarity:"Epic",      category:"practice",  icon:"🌍", requiresAchievement:"WORLD_TOUR" },
  { key:"TITLE_COMPLETE_COLL",    title:"Complete Collector",  description:"Collect wins in every format",                      rarity:"Legendary", category:"practice",  icon:"🌌", requiresAchievement:"COMPLETE_COLLECTOR" },
  { key:"TITLE_DECORATED",        title:"Decorated",          description:"Rack up achievements across all modes",             rarity:"Legendary", category:"practice",  icon:"🎗️", requiresAchievement:"DECORATED" },

  // ── Game-specific — 501 & variants ───────────────────────────────────────
  { key:"TITLE_FIVE_O_ONE",       title:"Five-O-One",         description:"Win 15+ standard 501 games",                        rarity:"Common",    category:"game",      icon:"5️⃣", requiresAchievement:"FIVE_O_ONE" },
  { key:"TITLE_STRAIGHT_SHOOTER", title:"Straight Shooter",   description:"Win 3 Straight-Out 501 games",                      rarity:"Common",    category:"game",      icon:"🎯", requiresAchievement:"501_STRAIGHT_OUT_WINS_3" },
  { key:"TITLE_TREBLE_FINISHER",  title:"Treble Finisher",    description:"Win 3 Treble-Out 501 games",                        rarity:"Common",    category:"game",      icon:"🎯", requiresAchievement:"501_TREBLE_OUT_WINS_3" },
  { key:"TITLE_TREBLE_MASTER",    title:"Treble Master",      description:"Master the treble format",                          rarity:"Rare",      category:"game",      icon:"🎯", requiresAchievement:"TREBLE_MASTER" },
  { key:"TITLE_SNIPER",           title:"The Sniper",         description:"The most precise finisher",                         rarity:"Epic",      category:"game",      icon:"🔭", requiresAchievement:"SNIPER" },
  { key:"TITLE_PRECISION",        title:"Precision",          description:"Precision checkout artist",                         rarity:"Epic",      category:"game",      icon:"🎯", requiresAchievement:"PRECISION" },
  { key:"TITLE_HIGH_ROLLER",      title:"High Roller",        description:"Go for big numbers",                                 rarity:"Rare",      category:"game",      icon:"🎲", requiresAchievement:"HIGH_ROLLER" },

  // ── Game-specific — Tactical / other formats ──────────────────────────────
  { key:"TITLE_TACTICIAN",        title:"The Tactician",      description:"Win 3 Tactics games",                               rarity:"Rare",      category:"game",      icon:"♟️", requiresAchievement:"TACTICS_WINS_3" },
  { key:"TITLE_KILLER",           title:"Killer",             description:"Win 3 Killer games",                                rarity:"Common",    category:"game",      icon:"☠️", requiresAchievement:"KILLER_WINS_3" },
  { key:"TITLE_GHOST",            title:"The Ghost",          description:"Disappear from the Killer board",                   rarity:"Epic",      category:"game",      icon:"👻", requiresAchievement:"GHOST" },
  { key:"TITLE_CRICKET_KING",     title:"Cricket King",       description:"Dominate the Cricket format",                       rarity:"Rare",      category:"game",      icon:"🏏", requiresAchievement:"CRICKET_KING" },
  { key:"TITLE_SNAKE",            title:"The Snake",          description:"Slippery and dangerous",                            rarity:"Epic",      category:"game",      icon:"🐍", requiresAchievement:"SNAKE" },
  { key:"TITLE_LONE_WOLF",        title:"Lone Wolf",          description:"A solo operator",                                   rarity:"Rare",      category:"game",      icon:"🐺", requiresAchievement:"LONE_WOLF" },
  { key:"TITLE_CHAOS_AGENT",      title:"Chaos Agent",        description:"Bring unpredictability to every game",              rarity:"Epic",      category:"game",      icon:"🌀", requiresAchievement:"CHAOS_AGENT" },
  { key:"TITLE_DETONATOR",        title:"Detonator",          description:"Explosive finisher",                                rarity:"Epic",      category:"game",      icon:"💣", requiresAchievement:"DETONATOR" },
  { key:"TITLE_REAPER",           title:"The Reaper",         description:"End seasons as the top eliminator",                 rarity:"Epic",      category:"game",      icon:"💀", requiresAchievement:"REAPER_SEASONAL" },
  { key:"TITLE_IMMORTAL",         title:"Immortal",           description:"Play endlessly and never stop improving",           rarity:"Legendary", category:"game",      icon:"⚰️", requiresAchievement:"IMMORTAL" },
  { key:"TITLE_PHOENIX",          title:"Phoenix",            description:"Rise from the ashes",                               rarity:"Legendary", category:"game",      icon:"🦅", requiresAchievement:"PHOENIX" },

  // ── Shadow Bot ────────────────────────────────────────────────────────────
  { key:"TITLE_BOT_TRAINER",      title:"Bot Trainer",        description:"Unlock Amateur bot level",                          rarity:"Common",    category:"bot",       icon:"🤖", requiresAchievement:"BOT_AMATEUR",      achievementSource:"shadow_bot" },
  { key:"TITLE_CLUB_TRAINER",     title:"Club Trainer",       description:"Unlock Club bot level",                             rarity:"Rare",      category:"bot",       icon:"🔵", requiresAchievement:"BOT_CLUB",         achievementSource:"shadow_bot" },
  { key:"TITLE_COUNTY_TRAINER",   title:"County Trainer",     description:"Unlock County bot level",                           rarity:"Epic",      category:"bot",       icon:"🟣", requiresAchievement:"BOT_COUNTY",       achievementSource:"shadow_bot" },
  { key:"TITLE_PRO_TRAINER",      title:"Pro Trainer",        description:"Unlock Pro bot level",                              rarity:"Legendary", category:"bot",       icon:"🟡", requiresAchievement:"BOT_PRO",          achievementSource:"shadow_bot" },
  { key:"TITLE_POLYMATH",         title:"The Polymath",       description:"Train your bot in 12 game modes",                   rarity:"Rare",      category:"bot",       icon:"🧠", requiresAchievement:"BOT_POLYMATH",     achievementSource:"shadow_bot" },
  { key:"TITLE_ALL_ROUNDER",      title:"All-Rounder",        description:"Train your bot in 7 game modes",                    rarity:"Rare",      category:"bot",       icon:"🌐", requiresAchievement:"BOT_ALL_ROUNDER",  achievementSource:"shadow_bot" },
  { key:"TITLE_FORMAT_MASTER",    title:"Format Master",      description:"Train in 20 game modes",                            rarity:"Epic",      category:"bot",       icon:"⚡", requiresAchievement:"BOT_FORMAT_MASTER",achievementSource:"shadow_bot" },

  // ── M501 — Starter ────────────────────────────────────────────────────────
  { key:"TITLE_THE_DARTER",       title:"The Darter",         description:"Win your first Master-501 match",                   rarity:"Common",    category:"master501", icon:"🎯", requiresAchievement:"M501_FIRST_WIN" },
  { key:"TITLE_TRIPLE_TON",       title:"Triple Ton",         description:"Land your first 180 in Master-501",                 rarity:"Common",    category:"master501", icon:"💯", requiresAchievement:"M501_FIRST_180" },
  { key:"TITLE_FIRST_FINISH_501", title:"First Finish",       description:"Land your first checkout in Master-501",            rarity:"Common",    category:"master501", icon:"✅", requiresAchievement:"M501_FIRST_CO" },
  { key:"TITLE_GETTING_GOING",    title:"Getting Going",      description:"Complete 10 Master-501 runs",                       rarity:"Common",    category:"master501", icon:"📋", requiresAchievement:"M501_TEN_RUNS" },
  { key:"TITLE_HAT_TRICK",        title:"Hat-Trick",          description:"Win 3 Master-501 matches",                          rarity:"Common",    category:"master501", icon:"🎯", requiresAchievement:"M501_WIN_3" },

  // ── M501 — Streaks ────────────────────────────────────────────────────────
  { key:"TITLE_ON_HEAT",          title:"On Heat",            description:"Win 3 consecutive M501 matches",                    rarity:"Rare",      category:"master501", icon:"🔥", requiresAchievement:"M501_HEAT" },
  { key:"TITLE_ELECTRIC",         title:"Electric",           description:"Win 5 consecutive M501 matches",                    rarity:"Rare",      category:"master501", icon:"⚡", requiresAchievement:"M501_ON_FIRE" },
  { key:"TITLE_UNSTOPPABLE",      title:"Unstoppable",        description:"Win 10 consecutive M501 matches",                   rarity:"Legendary", category:"master501", icon:"🌪️", requiresAchievement:"M501_UNSTOPPABLE" },

  // ── M501 — Tier progression ───────────────────────────────────────────────
  { key:"TITLE_CHALLENGER",       title:"The Challenger",     description:"Clear the Challenger tier",                         rarity:"Common",    category:"master501", icon:"🥈", requiresAchievement:"M501_CHALLENGER_CLEAR" },
  { key:"TITLE_CIRCUIT_PRO",      title:"Circuit Pro",        description:"Clear the Pro Circuit tier",                        rarity:"Rare",      category:"master501", icon:"🥇", requiresAchievement:"M501_PRO_CLEAR" },
  { key:"TITLE_PREMIER_CLASS",    title:"Premier Class",      description:"Clear the Premier tier",                            rarity:"Epic",      category:"master501", icon:"💎", requiresAchievement:"M501_PREMIER_CLEAR" },
  { key:"TITLE_WORLD_CHAMPION",   title:"World Champion",     description:"Conquer the World Championship tier",               rarity:"Legendary", category:"master501", icon:"👑", requiresAchievement:"M501_WORLD_CHAMP" },

  // ── M501 — Wins ───────────────────────────────────────────────────────────
  { key:"TITLE_QUARTER_CENTURY",  title:"Quarter Century",    description:"Win 25 M501 matches",                               rarity:"Rare",      category:"master501", icon:"🏅", requiresAchievement:"M501_WIN_25" },
  { key:"TITLE_THE_CENTURION",    title:"The Centurion",      description:"Win 100 M501 matches",                              rarity:"Epic",      category:"master501", icon:"💯", requiresAchievement:"M501_WIN_100" },
  { key:"TITLE_200_WINS",         title:"200 Wins",           description:"Win 200 M501 matches",                              rarity:"Legendary", category:"master501", icon:"👑", requiresAchievement:"M501_WIN_200" },

  // ── M501 — Averages & checkouts ───────────────────────────────────────────
  { key:"TITLE_SHARP_FINISHER",   title:"Sharp Finisher",     description:"Land 10 checkouts in M501",                         rarity:"Rare",      category:"master501", icon:"🎯", requiresAchievement:"M501_CO_TEN" },
  { key:"TITLE_ICE_VEINS",        title:"Ice Veins",          description:"Hit 60%+ checkout rate over 20+ attempts",          rarity:"Epic",      category:"master501", icon:"🏹", requiresAchievement:"M501_CO_RATE_60" },
  { key:"TITLE_SOLID_AVERAGE",    title:"Solid Average",      description:"Post 80+ average in M501",                          rarity:"Rare",      category:"master501", icon:"📊", requiresAchievement:"M501_AVG_80" },
  { key:"TITLE_CENTURY_AVERAGE",  title:"Century Average",    description:"Post 100+ average in M501",                         rarity:"Legendary", category:"master501", icon:"💯", requiresAchievement:"M501_AVG_100" },

  // ── M501 — Flawless ───────────────────────────────────────────────────────
  { key:"TITLE_CLEAN_SWEEP",      title:"Clean Sweep",        description:"Win a BO5 without dropping a leg",                  rarity:"Rare",      category:"master501", icon:"🛡️", requiresAchievement:"M501_FLAWLESS_5" },
  { key:"TITLE_DOMINANT",         title:"Dominant",           description:"Win a BO9 without dropping a leg",                  rarity:"Epic",      category:"master501", icon:"🌟", requiresAchievement:"M501_FLAWLESS_9" },
  { key:"TITLE_GRAND_SLAM",       title:"Grand Slam",         description:"Win a BO11 without dropping a leg",                 rarity:"Legendary", category:"master501", icon:"🌟", requiresAchievement:"M501_GRAND_SLAM" },

  // ── M501 — 180s ───────────────────────────────────────────────────────────
  { key:"TITLE_MAX_MACHINE",      title:"Maximum Machine",    description:"Hit 20 total 180s in M501",                         rarity:"Epic",      category:"master501", icon:"🔥", requiresAchievement:"M501_180_TWENTY" },
  { key:"TITLE_MAX_LEGEND",       title:"Maximum Legend",     description:"Hit 50 total 180s in M501",                         rarity:"Legendary", category:"master501", icon:"👑", requiresAchievement:"M501_180_FIFTY" },

  // ── M501 — Drama & grind ──────────────────────────────────────────────────
  { key:"TITLE_LAST_GASP",        title:"Last Gasp",          description:"Win a M501 match in the deciding leg",              rarity:"Rare",      category:"master501", icon:"😤", requiresAchievement:"M501_LAST_GASP" },
  { key:"TITLE_THE_GRINDER",      title:"The Grinder",        description:"Complete 50 M501 runs",                             rarity:"Rare",      category:"master501", icon:"🎲", requiresAchievement:"M501_FIFTY_RUNS" },
  { key:"TITLE_TEN_THOUSAND",     title:"Ten Thousand Darts", description:"Throw 10,000 darts in M501",                        rarity:"Legendary", category:"master501", icon:"👑", requiresAchievement:"M501_DARTS_10000" },

];

// ─── DB helpers ───────────────────────────────────────────────────────────────

// ─── Startup sweep: grant titles for all existing achievements ────────────────

export async function sweepAllPlayerTitles(): Promise<void> {
  try {
    const rows = await db.execute(sql`SELECT id FROM players`);
    await Promise.all((rows.rows as any[]).map(r => checkAndGrantTitles(r.id as number)));
    logger.info("Titles sweep complete");
  } catch (err) {
    logger.error({ err }, "[Titles] sweep failed");
  }
}

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

async function grantTitle(playerId: number, titleKey: string): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO player_titles (player_id, title_key)
      VALUES (${playerId}, ${titleKey})
      ON CONFLICT (player_id, title_key) DO NOTHING
    `);
  } catch {
    // already exists — fine
  }
}

// ─── Check + grant titles based on ALL achievement sources ───────────────────

export async function checkAndGrantTitles(playerId: number): Promise<void> {
  try {
    // Collect unlocked keys from all three sources
    const [leagueRows, botRows] = await Promise.all([
      db.execute(sql`
        SELECT a.key FROM player_achievements pa
        JOIN achievements a ON a.id = pa.achievement_id
        WHERE pa.player_id = ${playerId}
      `),
      db.execute(sql`
        SELECT achievement_key AS key FROM shadow_bot_achievements
        WHERE player_id = ${playerId}
      `),
    ]);

    const leagueKeys   = new Set((leagueRows.rows as any[]).map(r => r.key as string));
    const botKeys      = new Set((botRows.rows as any[]).map(r => r.key as string));

    for (const def of TITLE_DEFINITIONS) {
      const source = def.achievementSource ?? "league";
      const has =
        source === "shadow_bot" ? botKeys.has(def.requiresAchievement) :
        leagueKeys.has(def.requiresAchievement);
      if (has) await grantTitle(playerId, def.key);
    }
  } catch (err) {
    logger.error({ err, playerId }, "[Titles] checkAndGrantTitles failed");
  }
}

// ─── Get ALL titles for a player (earned + locked) ───────────────────────────

export interface PlayerTitleResult extends TitleDef {
  earned:     boolean;
  unlockedAt: string | null;
  isActive:   boolean;
}

export async function getAllPlayerTitles(playerId: number): Promise<PlayerTitleResult[]> {
  const [earnedRows, activeRow] = await Promise.all([
    db.execute(sql`SELECT title_key, unlocked_at FROM player_titles WHERE player_id = ${playerId}`),
    db.execute(sql`SELECT active_title FROM players WHERE id = ${playerId}`),
  ]);

  const earned     = new Map((earnedRows.rows as any[]).map(r => [r.title_key as string, r.unlocked_at as string]));
  const activeTitle = (activeRow.rows[0] as any)?.active_title as string | null ?? null;

  return TITLE_DEFINITIONS.map(def => ({
    ...def,
    earned:     earned.has(def.key),
    unlockedAt: earned.get(def.key) ?? null,
    isActive:   def.key === activeTitle,
  }));
}
