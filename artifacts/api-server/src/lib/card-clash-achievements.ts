import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { addCoinsToPlayer } from "../services/card-shop-service";
import { logger } from "./logger";

// ── Achievement definitions ──────────────────────────────────────────────────

export interface CCAchievementDef {
  key: string;
  name: string;
  description: string;
  icon: string;
  rarity: "Common" | "Rare" | "Epic" | "Legendary";
  coinReward: number;
  packReward: "SINGLE" | "FIVE" | "TEN" | null;
  statType: "MATCHES_PLAYED" | "MATCHES_WON" | "CARDS_OWNED" | "PACKS_OPENED" | "LOGIN_STREAK" | "HAS_LEGENDARY";
  statValue: number;
}

export const CC_ACHIEVEMENT_DEFS: CCAchievementDef[] = [
  // Starter
  { key: "CC_FIRST_MATCH",    name: "First Clash",         description: "Play your first Card Clash match",      icon: "🃏", rarity: "Common",    coinReward: 50,   packReward: null,     statType: "MATCHES_PLAYED", statValue: 1 },
  { key: "CC_FIRST_WIN",      name: "Clash Victory",       description: "Win your first Card Clash match",       icon: "⚡", rarity: "Common",    coinReward: 100,  packReward: null,     statType: "MATCHES_WON",   statValue: 1 },
  { key: "CC_PACK_OPENER",    name: "Pack Opener",         description: "Open your first card pack",             icon: "📦", rarity: "Common",    coinReward: 30,   packReward: null,     statType: "PACKS_OPENED",  statValue: 1 },

  // Collector
  { key: "CC_COLLECTOR_10",   name: "Getting Started",     description: "Collect 10 unique cards",               icon: "🎴", rarity: "Common",    coinReward: 75,   packReward: null,     statType: "CARDS_OWNED",   statValue: 10 },
  { key: "CC_COLLECTOR_25",   name: "Card Enthusiast",     description: "Collect 25 unique cards",               icon: "🎴", rarity: "Rare",      coinReward: 200,  packReward: "SINGLE", statType: "CARDS_OWNED",   statValue: 25 },
  { key: "CC_COLLECTOR_50",   name: "Half the Deck",       description: "Collect 50 unique cards",               icon: "🎴", rarity: "Epic",      coinReward: 500,  packReward: "FIVE",   statType: "CARDS_OWNED",   statValue: 50 },
  { key: "CC_COLLECTOR_ALL",  name: "Complete the Clash",  description: "Collect all 100 unique cards",          icon: "👑", rarity: "Legendary", coinReward: 2000, packReward: "TEN",    statType: "CARDS_OWNED",   statValue: 100 },
  { key: "CC_LEGENDARY_CARD", name: "Legendary Pull",      description: "Own any Legendary card",                icon: "✨", rarity: "Rare",      coinReward: 250,  packReward: null,     statType: "HAS_LEGENDARY", statValue: 1 },

  // Wins
  { key: "CC_WIN_5",          name: "On a Roll",           description: "Win 5 Card Clash matches",              icon: "🏆", rarity: "Common",    coinReward: 150,  packReward: null,     statType: "MATCHES_WON",   statValue: 5 },
  { key: "CC_WIN_10",         name: "Regular Clashmaster", description: "Win 10 Card Clash matches",             icon: "🏆", rarity: "Rare",      coinReward: 300,  packReward: "SINGLE", statType: "MATCHES_WON",   statValue: 10 },
  { key: "CC_WIN_25",         name: "Clash Dominator",     description: "Win 25 Card Clash matches",             icon: "🏆", rarity: "Epic",      coinReward: 750,  packReward: "FIVE",   statType: "MATCHES_WON",   statValue: 25 },
  { key: "CC_WIN_50",         name: "TKDL Card Legend",    description: "Win 50 Card Clash matches",             icon: "👑", rarity: "Legendary", coinReward: 2000, packReward: "TEN",    statType: "MATCHES_WON",   statValue: 50 },

  // Packs opened
  { key: "CC_PACKS_5",        name: "Pack Addict",         description: "Open 5 card packs total",              icon: "📦", rarity: "Common",    coinReward: 100,  packReward: null,     statType: "PACKS_OPENED",  statValue: 5 },
  { key: "CC_PACKS_10",       name: "Pack Fanatic",        description: "Open 10 card packs total",             icon: "📦", rarity: "Rare",      coinReward: 200,  packReward: "SINGLE", statType: "PACKS_OPENED",  statValue: 10 },
  { key: "CC_PACKS_25",       name: "Pack Obsessed",       description: "Open 25 card packs total",             icon: "📦", rarity: "Epic",      coinReward: 500,  packReward: "FIVE",   statType: "PACKS_OPENED",  statValue: 25 },

  // Login streak
  { key: "CC_STREAK_3",       name: "Hat Trick",           description: "Log in 3 days in a row",               icon: "🔥", rarity: "Common",    coinReward: 75,   packReward: null,     statType: "LOGIN_STREAK",  statValue: 3 },
  { key: "CC_STREAK_7",       name: "Week Warrior",        description: "Log in 7 days in a row",               icon: "🔥", rarity: "Rare",      coinReward: 200,  packReward: "SINGLE", statType: "LOGIN_STREAK",  statValue: 7 },
  { key: "CC_STREAK_30",      name: "Kilbirnie Regular",   description: "Log in 30 days in a row",              icon: "🔥", rarity: "Epic",      coinReward: 1000, packReward: "FIVE",   statType: "LOGIN_STREAK",  statValue: 30 },
];

const PACK_NAMES: Record<string, string> = { SINGLE: "Arrow Pack", FIVE: "League Night Pack", TEN: "Kilbirnie Elite" };
const RARITY_ORDER: Record<string, number> = { Common: 1, Rare: 2, Epic: 3, Legendary: 4 };

// ── Ensure tables exist ──────────────────────────────────────────────────────

let tablesEnsured = false;
async function ensureTables() {
  if (tablesEnsured) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS card_clash_achievements_earned (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL,
        achievement_key TEXT NOT NULL,
        coins_awarded INTEGER DEFAULT 0,
        pack_awarded TEXT,
        earned_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(player_id, achievement_key)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS card_clash_pack_inventory (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL,
        pack_type TEXT NOT NULL,
        earned_reason TEXT,
        earned_at TIMESTAMPTZ DEFAULT NOW(),
        opened_at TIMESTAMPTZ,
        is_opened BOOLEAN DEFAULT FALSE
      )
    `);
    // Add packs_opened counter to player_currency if not exists
    await db.execute(sql`ALTER TABLE player_currency ADD COLUMN IF NOT EXISTS packs_opened INTEGER DEFAULT 0`);
    tablesEnsured = true;
  } catch (e) {
    logger.warn({ e }, "[CC_ACH] ensureTables warning (may already exist)");
    tablesEnsured = true;
  }
}

// ── Player stats ─────────────────────────────────────────────────────────────

async function getCCPlayerStats(playerId: number) {
  try {
    const [matchR, invR, loginR, packsR] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE player_1_id = ${playerId} OR player_2_id = ${playerId}) AS matches_played,
          COUNT(*) FILTER (WHERE winner_id = ${playerId}) AS matches_won
        FROM card_clash_matches
        WHERE is_mock IS NOT TRUE
      `),
      db.execute(sql`
        SELECT
          COUNT(DISTINCT ci.card_id) AS cards_owned,
          COUNT(*) FILTER (WHERE LOWER(cd.rarity) = 'legendary') AS legendary_owned
        FROM player_card_inventory ci
        LEFT JOIN card_definitions cd ON cd.card_id = ci.card_id AND cd.enabled = TRUE
        WHERE ci.player_id = ${playerId}
      `),
      db.execute(sql`
        SELECT COALESCE(current_streak, 0) AS login_streak
        FROM player_login_streaks WHERE player_id = ${playerId}
      `),
      db.execute(sql`
        SELECT COALESCE(packs_opened, 0) AS packs_opened
        FROM player_currency WHERE player_id = ${playerId}
      `),
    ]);

    const m = matchR.rows[0] as any;
    const i = invR.rows[0] as any;
    const l = loginR.rows[0] as any;
    const p = packsR.rows[0] as any;

    return {
      matchesPlayed: Number(m?.matches_played ?? 0),
      matchesWon: Number(m?.matches_won ?? 0),
      cardsOwned: Number(i?.cards_owned ?? 0),
      hasLegendary: Number(i?.legendary_owned ?? 0) > 0,
      loginStreak: Number(l?.login_streak ?? 0),
      packsOpened: Number(p?.packs_opened ?? 0),
    };
  } catch (e) {
    logger.warn({ e }, "[CC_ACH] getCCPlayerStats error");
    return { matchesPlayed: 0, matchesWon: 0, cardsOwned: 0, hasLegendary: false, loginStreak: 0, packsOpened: 0 };
  }
}

function statMet(def: CCAchievementDef, stats: Awaited<ReturnType<typeof getCCPlayerStats>>): boolean {
  switch (def.statType) {
    case "MATCHES_PLAYED": return stats.matchesPlayed >= def.statValue;
    case "MATCHES_WON":    return stats.matchesWon >= def.statValue;
    case "CARDS_OWNED":    return stats.cardsOwned >= def.statValue;
    case "PACKS_OPENED":   return stats.packsOpened >= def.statValue;
    case "LOGIN_STREAK":   return stats.loginStreak >= def.statValue;
    case "HAS_LEGENDARY":  return stats.hasLegendary;
    default: return false;
  }
}

// ── Check and award ──────────────────────────────────────────────────────────

export async function checkAndAwardCCAchievements(playerId: number): Promise<Array<CCAchievementDef & { packName?: string }>> {
  await ensureTables();
  const newly: Array<CCAchievementDef & { packName?: string }> = [];

  try {
    const [stats, earnedR] = await Promise.all([
      getCCPlayerStats(playerId),
      db.execute(sql`SELECT achievement_key FROM card_clash_achievements_earned WHERE player_id = ${playerId}`),
    ]);
    const earned = new Set((earnedR.rows as any[]).map(r => r.achievement_key));

    for (const def of CC_ACHIEVEMENT_DEFS) {
      if (earned.has(def.key)) continue;
      if (!statMet(def, stats)) continue;

      // Award it
      try {
        await db.execute(sql`
          INSERT INTO card_clash_achievements_earned (player_id, achievement_key, coins_awarded, pack_awarded)
          VALUES (${playerId}, ${def.key}, ${def.coinReward}, ${def.packReward ?? null})
          ON CONFLICT (player_id, achievement_key) DO NOTHING
        `);

        if (def.coinReward > 0) {
          await addCoinsToPlayer(playerId, def.coinReward);
        }

        if (def.packReward) {
          await db.execute(sql`
            INSERT INTO card_clash_pack_inventory (player_id, pack_type, earned_reason)
            VALUES (${playerId}, ${def.packReward}, ${"ACHIEVEMENT:" + def.key})
          `);
        }

        newly.push({ ...def, packName: def.packReward ? PACK_NAMES[def.packReward] : undefined });
        logger.info({ playerId, key: def.key, coins: def.coinReward, pack: def.packReward }, "[CC_ACH] Awarded");
      } catch (e) {
        logger.warn({ e, key: def.key }, "[CC_ACH] Award insert conflict (OK)");
      }
    }
  } catch (e) {
    logger.warn({ e }, "[CC_ACH] checkAndAward error");
  }

  return newly;
}

// ── List achievements with earned status ─────────────────────────────────────

export async function getCCAchievementsForPlayer(playerId: number) {
  await ensureTables();
  try {
    const [stats, earnedR] = await Promise.all([
      getCCPlayerStats(playerId),
      db.execute(sql`
        SELECT achievement_key, earned_at, coins_awarded, pack_awarded
        FROM card_clash_achievements_earned WHERE player_id = ${playerId}
      `),
    ]);
    const earnedMap = new Map<string, any>();
    for (const r of earnedR.rows as any[]) earnedMap.set(r.achievement_key, r);

    return {
      stats,
      achievements: CC_ACHIEVEMENT_DEFS.sort((a, b) => {
        const aEarned = earnedMap.has(a.key) ? 0 : 1;
        const bEarned = earnedMap.has(b.key) ? 0 : 1;
        if (aEarned !== bEarned) return aEarned - bEarned;
        return (RARITY_ORDER[b.rarity] ?? 0) - (RARITY_ORDER[a.rarity] ?? 0);
      }).map(def => ({
        ...def,
        earned: earnedMap.has(def.key),
        earnedAt: earnedMap.get(def.key)?.earned_at ?? null,
        progress: statMet(def, stats) ? def.statValue : getProgress(def, stats),
        packName: def.packReward ? PACK_NAMES[def.packReward] : null,
      })),
    };
  } catch (e) {
    logger.warn({ e }, "[CC_ACH] getCCAchievementsForPlayer error");
    return { stats: null, achievements: [] };
  }
}

function getProgress(def: CCAchievementDef, stats: any): number {
  switch (def.statType) {
    case "MATCHES_PLAYED": return stats.matchesPlayed;
    case "MATCHES_WON":    return stats.matchesWon;
    case "CARDS_OWNED":    return stats.cardsOwned;
    case "PACKS_OPENED":   return stats.packsOpened;
    case "LOGIN_STREAK":   return stats.loginStreak;
    case "HAS_LEGENDARY":  return stats.hasLegendary ? 1 : 0;
    default: return 0;
  }
}

// ── Pack inventory ───────────────────────────────────────────────────────────

export async function getPlayerPackInventory(playerId: number) {
  await ensureTables();
  try {
    const rows = await db.execute(sql`
      SELECT id, pack_type, earned_reason, earned_at, is_opened, opened_at
      FROM card_clash_pack_inventory
      WHERE player_id = ${playerId} AND is_opened = FALSE
      ORDER BY earned_at ASC
    `);
    return (rows.rows as any[]).map(r => ({
      ...r,
      packName: PACK_NAMES[r.pack_type] ?? r.pack_type,
    }));
  } catch (e) {
    logger.warn({ e }, "[CC_ACH] getPlayerPackInventory error");
    return [];
  }
}

export async function markPackOpened(inventoryId: number, playerId: number): Promise<boolean> {
  await ensureTables();
  try {
    const check = await db.execute(sql`
      SELECT id, is_opened FROM card_clash_pack_inventory
      WHERE id = ${inventoryId} AND player_id = ${playerId}
    `);
    const row = check.rows[0] as any;
    if (!row) return false;
    if (row.is_opened) return false;

    await db.execute(sql`
      UPDATE card_clash_pack_inventory
      SET is_opened = TRUE, opened_at = NOW()
      WHERE id = ${inventoryId} AND player_id = ${playerId}
    `);
    return true;
  } catch (e) {
    logger.warn({ e }, "[CC_ACH] markPackOpened error");
    return false;
  }
}

export async function incrementPacksOpened(playerId: number, count: number = 1) {
  await ensureTables();
  try {
    await db.execute(sql`
      UPDATE player_currency
      SET packs_opened = COALESCE(packs_opened, 0) + ${count}
      WHERE player_id = ${playerId}
    `);
  } catch (e) {
    logger.warn({ e }, "[CC_ACH] incrementPacksOpened error");
  }
}
