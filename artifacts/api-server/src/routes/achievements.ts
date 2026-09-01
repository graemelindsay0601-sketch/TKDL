import { Router } from "express";
import { db, achievementsTable, playerAchievementsTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { SHADOW_BOT_ACHIEVEMENT_DEFS, gamerscoreForRarity } from "../lib/shadow-bot-achievements";
import { CC_ACHIEVEMENT_DEFS } from "../lib/card-clash-achievements";
import { PINNABLE_SYSTEMS, getPinnedAchievements, setPinnedAchievements } from "../lib/pinned-achievements";

const router = Router();

/**
 * Unified trophy detail — one consistent "click a trophy, see who's got it
 * and when" page for all four achievement systems in the app (core career
 * achievements, Shadow Bot, Tour, Card Clash), which otherwise each have
 * their own separate catalog and storage with no shared browsing surface.
 * This intentionally reads from all four existing tables as-is rather than
 * migrating them into one physical table — that would mean touching real
 * players' existing unlock history for a purely cosmetic win. Every "X
 * unlocked Y" mention in the app should link to /achievements/:system/:key,
 * which this powers.
 */
type AchievementSystem = "core" | "shadow-bot" | "tour" | "card-clash";

// Shadow Bot / Card Clash storage tables are created lazily (on first
// practice session / first match) rather than at boot, so on an
// environment where nobody has touched that mode yet the table can
// legitimately not exist. That's "nobody's earned it," not a real error —
// treat it as zero holders instead of a 500 so the trophy page still loads.
async function holdersOrEmpty<T>(query: Promise<{ rows: T[] }>): Promise<T[]> {
  try {
    return (await query).rows;
  } catch (err: any) {
    if (err?.cause?.code === "42P01" || /relation .* does not exist/.test(String(err?.message))) {
      return [];
    }
    throw err;
  }
}

router.get("/achievements/detail/:system/:key", async (req, res): Promise<void> => {
  const system = req.params.system as AchievementSystem;
  const key = req.params.key;

  try {
    if (system === "core") {
      const [def] = await db.select().from(achievementsTable).where(eq(achievementsTable.key, key));
      if (!def) { res.status(404).json({ error: "Achievement not found" }); return; }
      const holders = await holdersOrEmpty<{ player_id: number; player_name: string; unlocked_at: string; season_id: number }>(db.execute(sql`
        SELECT pa.player_id, p.name AS player_name, pa.unlocked_at, pa.season_id
        FROM player_achievements pa
        JOIN players p ON p.id = pa.player_id
        WHERE pa.achievement_id = ${def.id}
        ORDER BY pa.unlocked_at ASC
      `));
      res.json({
        system, key: def.key, name: def.name, description: def.description, icon: def.icon,
        rarity: def.rarity, category: def.category, hidden: def.hidden,
        reward: { coins: def.coinReward, pack: def.packReward },
        repeatable: holders.some(h => h.season_id !== 0),
        totalUnlocks: holders.length,
        unlockedBy: holders.map(h => ({ playerId: h.player_id, playerName: h.player_name, unlockedAt: h.unlocked_at, seasonId: h.season_id || null })),
      });
      return;
    }

    if (system === "shadow-bot") {
      const def = SHADOW_BOT_ACHIEVEMENT_DEFS.find(d => d.key === key);
      if (!def) { res.status(404).json({ error: "Achievement not found" }); return; }
      const holders = await holdersOrEmpty<{ player_id: number; player_name: string; unlocked_at: string }>(db.execute(sql`
        SELECT sba.player_id, p.name AS player_name, sba.unlocked_at
        FROM shadow_bot_achievements sba
        JOIN players p ON p.id = sba.player_id
        WHERE sba.achievement_key = ${key}
        ORDER BY sba.unlocked_at ASC
      `));
      res.json({
        system, key: def.key, name: def.name, description: def.description, icon: def.icon,
        rarity: def.rarity, category: "Practice", hidden: false,
        reward: { coins: def.coinReward, pack: def.packReward, gamerscore: gamerscoreForRarity(def.rarity) },
        repeatable: false,
        totalUnlocks: holders.length,
        unlockedBy: holders.map(h => ({ playerId: h.player_id, playerName: h.player_name, unlockedAt: h.unlocked_at, seasonId: null })),
      });
      return;
    }

    if (system === "tour") {
      const [def] = (await db.execute(sql`SELECT * FROM tour_achievement_definitions WHERE key = ${key}`)).rows as any[];
      if (!def) { res.status(404).json({ error: "Achievement not found" }); return; }
      const holders = await holdersOrEmpty<{ player_id: number; player_name: string; awarded_at: string }>(db.execute(sql`
        SELECT pta.player_id, p.name AS player_name, pta.awarded_at
        FROM player_tour_achievements pta
        JOIN players p ON p.id = pta.player_id
        WHERE pta.achievement_key = ${key}
        ORDER BY pta.awarded_at ASC
      `));
      res.json({
        system, key: def.key, name: def.name, description: def.description, icon: def.icon,
        rarity: null, category: def.category, hidden: false,
        reward: { gamerscore: def.gamerscore },
        repeatable: false,
        totalUnlocks: holders.length,
        unlockedBy: holders.map(h => ({ playerId: h.player_id, playerName: h.player_name, unlockedAt: h.awarded_at, seasonId: null })),
      });
      return;
    }

    if (system === "card-clash") {
      const def = CC_ACHIEVEMENT_DEFS.find(d => d.key === key);
      if (!def) { res.status(404).json({ error: "Achievement not found" }); return; }
      const holders = await holdersOrEmpty<{ player_id: number; player_name: string; earned_at: string }>(db.execute(sql`
        SELECT cce.player_id, p.name AS player_name, cce.earned_at
        FROM card_clash_achievements_earned cce
        JOIN players p ON p.id = cce.player_id
        WHERE cce.achievement_key = ${key}
        ORDER BY cce.earned_at ASC
      `));
      res.json({
        system, key: def.key, name: def.name, description: def.description, icon: def.icon,
        rarity: def.rarity, category: "Card Clash", hidden: false,
        reward: { coins: def.coinReward, pack: def.packReward },
        repeatable: false,
        totalUnlocks: holders.length,
        unlockedBy: holders.map(h => ({ playerId: h.player_id, playerName: h.player_name, unlockedAt: h.earned_at, seasonId: null })),
      });
      return;
    }

    res.status(400).json({ error: "Unknown achievement system" });
  } catch (err) {
    (req as any).log?.error?.({ err }, "Failed to load achievement detail");
    res.status(500).json({ error: "Failed to load achievement detail" });
  }
});

router.get("/achievements", async (_req, res): Promise<void> => {
  const [achievements, unlocks] = await Promise.all([
    db.select().from(achievementsTable)
      .orderBy(asc(achievementsTable.priority), asc(achievementsTable.name)),
    db.select({ achievementId: playerAchievementsTable.achievementId })
      .from(playerAchievementsTable),
  ]);

  const unlockCounts = new Map<number, number>();
  for (const u of unlocks) {
    unlockCounts.set(u.achievementId, (unlockCounts.get(u.achievementId) ?? 0) + 1);
  }

  const result = achievements.map(a => ({
    ...a,
    unlockedCount: unlockCounts.get(a.id) ?? 0,
  }));

  res.json(result);
});

router.get("/achievements/recent", async (_req, res): Promise<void> => {
  try {
    const rows = (await db.execute(sql`
      SELECT
        pa.unlocked_at,
        p.id   AS player_id,
        p.name AS player_name,
        a.key  AS achievement_key,
        a.name AS achievement_name,
        a.icon,
        a.rarity
      FROM player_achievements pa
      JOIN players    p ON p.id = pa.player_id
      JOIN achievements a ON a.id = pa.achievement_id
      ORDER BY pa.unlocked_at DESC
      LIMIT 6
    `)).rows;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to get recent achievements" });
  }
});

router.get("/achievements/shadow-bot-definitions", async (_req, res): Promise<void> => {
  try {
    const rows = (await db.execute(sql`
      SELECT achievement_key, COUNT(*)::int AS unlock_count
      FROM shadow_bot_achievements
      GROUP BY achievement_key
    `)).rows as { achievement_key: string; unlock_count: number }[];

    const countMap = new Map(rows.map(r => [r.achievement_key, r.unlock_count]));

    const result = SHADOW_BOT_ACHIEVEMENT_DEFS.map(def => ({
      key:          def.key,
      name:         def.name,
      description:  def.description,
      icon:         def.icon,
      rarity:       def.rarity,
      gamerscore:   gamerscoreForRarity(def.rarity),
      criteriaType: def.criteriaType,
      criteriaValue: def.criteriaValue,
      unlockedCount: countMap.get(def.key) ?? 0,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to get shadow bot achievement definitions" });
  }
});

router.get("/achievements/card-clash-definitions", async (_req, res): Promise<void> => {
  try {
    const rows = (await db.execute(sql`
      SELECT achievement_key, COUNT(*)::int AS unlock_count
      FROM card_clash_achievements_earned
      GROUP BY achievement_key
    `)).rows as { achievement_key: string; unlock_count: number }[];

    const countMap = new Map(rows.map(r => [r.achievement_key, r.unlock_count]));

    const result = CC_ACHIEVEMENT_DEFS.map(def => ({
      key:           def.key,
      name:          def.name,
      description:   def.description,
      icon:          def.icon,
      rarity:        def.rarity,
      coinReward:    def.coinReward,
      packReward:    def.packReward,
      criteriaType:  def.statType,
      criteriaValue: def.statValue,
      unlockedCount: countMap.get(def.key) ?? 0,
    }));

    res.json(result);
  } catch (err) {
    (_req as any).log?.error?.({ err }, "Failed to get card clash achievement definitions");
    res.status(500).json({ error: "Failed to get card clash achievement definitions" });
  }
});

/**
 * Aggregate achievement counts across all four systems, for the Hub's
 * "X total achievements" stat — previously a hardcoded "456" that had
 * drifted from reality as achievements were added/retired.
 */
router.get("/achievements/counts", async (_req, res): Promise<void> => {
  try {
    const [coreRows, tourRows] = await Promise.all([
      db.select().from(achievementsTable),
      holdersOrEmpty<{ count: number }>(db.execute(sql`SELECT COUNT(*)::int AS count FROM tour_achievement_definitions`)),
    ]);
    const core      = coreRows.length;
    const tour      = Number(tourRows[0]?.count ?? 0);
    const shadowBot = SHADOW_BOT_ACHIEVEMENT_DEFS.length;
    const cardClash = CC_ACHIEVEMENT_DEFS.length;
    res.json({ core, tour, shadowBot, cardClash, total: core + tour + shadowBot + cardClash });
  } catch (err) {
    (_req as any).log?.error?.({ err }, "Failed to get achievement counts");
    res.status(500).json({ error: "Failed to get achievement counts" });
  }
});

/**
 * Trophy case — a player's pinned favourite achievements, shown on their
 * profile and on the Hub. Deliberately spans all four achievement systems
 * (a key alone isn't unique across them — GHOST-style collisions aside,
 * Tour/Shadow Bot/Card Clash/core key namespaces aren't coordinated), so a
 * pin is always a {system, key} pair, never a bare key.
 */
router.get("/players/:id/pinned-achievements", async (req, res): Promise<void> => {
  const playerId = parseInt(req.params.id, 10);
  if (!playerId) { res.status(400).json({ error: "Invalid player id" }); return; }
  try {
    const pins = await getPinnedAchievements(playerId);
    res.json({ pins });
  } catch (err) {
    (req as any).log?.error?.({ err }, "Failed to get pinned achievements");
    res.status(500).json({ error: "Failed to get pinned achievements" });
  }
});

router.put("/players/:id/pinned-achievements", async (req, res): Promise<void> => {
  const playerId = parseInt(req.params.id, 10);
  if (!playerId) { res.status(400).json({ error: "Invalid player id" }); return; }

  // A trophy case is self-curated — without this check anyone could rewrite
  // any other player's pins just by knowing their id.
  const sessionPlayerId = (req.session as any)?.playerId ?? null;
  if (!sessionPlayerId) { res.status(401).json({ error: "Login required" }); return; }
  if (sessionPlayerId !== playerId) { res.status(403).json({ error: "You can only edit your own trophy case" }); return; }

  const body = req.body as { pins?: unknown };
  if (!Array.isArray(body.pins) || body.pins.length > 5) {
    res.status(400).json({ error: "pins must be an array of at most 5 {system, key} entries" });
    return;
  }
  const pins: { system: string; key: string }[] = [];
  for (const p of body.pins) {
    if (
      !p || typeof p !== "object" ||
      typeof (p as any).system !== "string" || typeof (p as any).key !== "string" ||
      !PINNABLE_SYSTEMS.includes((p as any).system)
    ) {
      res.status(400).json({ error: `Each pin needs a valid system (${PINNABLE_SYSTEMS.join(", ")}) and key` });
      return;
    }
    pins.push({ system: (p as any).system, key: (p as any).key });
  }

  try {
    await setPinnedAchievements(playerId, pins);
    res.json({ pins });
  } catch (err) {
    (req as any).log?.error?.({ err }, "Failed to set pinned achievements");
    res.status(500).json({ error: "Failed to set pinned achievements" });
  }
});

export default router;
