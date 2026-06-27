import { Router, Request, Response } from "express";
import {
  purchasePack,
  getPlayerInventory,
  getPlayerCurrency,
  addCoinsToPlayer,
  removeCoinsFromPlayer,
  giveCardToPlayer,
  removeCardFromPlayer,
  getPlayerPityStatus,
  resetPlayerCardData,
} from "../services/card-shop-service";
import {
  getActiveCardClashSeason,
  startCardClashMatch,
  recordCardUsedInMatch,
  finishCardClashMatch,
  deleteCardClashMatch,
  getCardClashStandings,
  getCardClashMatchHistory,
} from "../services/card-clash-service";
import { seedCardDefinitions, getAllCardDefinitions, toggleCardAvailability } from "../services/card-definitions-service";
import { challengeService } from "../services/challenge-service";
import { seasonalQuestService } from "../services/seasonal-quest-service";
import { logger } from "../lib/logger";
import {
  checkAndAwardCCAchievements,
  getCCAchievementsForPlayer,
  getPlayerPackInventory,
  markPackOpened,
  incrementPacksOpened,
} from "../lib/card-clash-achievements";
import { ensurePlayerCurrency } from "../lib/cardTablesMigration";
import { db, cardClashMatchesTable, cardClashSeasonsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

// Admin PIN for protecting card-clash admin routes
const ADMIN_PIN = process.env.ADMIN_PIN ?? "0601";

// === AUTO-FIX CARD CLASH ON STARTUP ===
async function autoFixCardClash() {
  try {
    logger.info("🔧 [STARTUP] Running Card Clash auto-fix...");

    // Fix 0a: Add ALL potentially missing columns to card_clash_seasons
    // Production table was created with old schema — we add everything with IF NOT EXISTS
    for (const alter of [
      sql`ALTER TABLE card_clash_seasons ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Season'`,
      sql`ALTER TABLE card_clash_seasons ADD COLUMN IF NOT EXISTS start_date DATE NOT NULL DEFAULT CURRENT_DATE`,
      sql`ALTER TABLE card_clash_seasons ADD COLUMN IF NOT EXISTS end_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days')`,
      sql`ALTER TABLE card_clash_seasons ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`,
      sql`ALTER TABLE card_clash_seasons ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false`,
      sql`ALTER TABLE card_clash_seasons ADD COLUMN IF NOT EXISTS total_matches INTEGER NOT NULL DEFAULT 0`,
      sql`ALTER TABLE card_clash_seasons ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`,
      sql`ALTER TABLE card_clash_seasons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    ]) {
      try { await db.execute(alter); } catch (e) { logger.warn({ e }, "seasons column alter skipped"); }
    }
    logger.info("✓ card_clash_seasons columns verified");

    // Fix 0b: Add missing columns to card_clash_matches + make season_id optional (seasons removed)
    for (const alter of [
      sql`ALTER TABLE card_clash_matches ADD COLUMN IF NOT EXISTS match_id UUID DEFAULT gen_random_uuid()`,
      sql`ALTER TABLE card_clash_matches ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'X01'`,
      sql`ALTER TABLE card_clash_matches ADD COLUMN IF NOT EXISTS player_1_id INTEGER REFERENCES players(id)`,
      sql`ALTER TABLE card_clash_matches ADD COLUMN IF NOT EXISTS player_2_id INTEGER REFERENCES players(id)`,
      sql`ALTER TABLE card_clash_matches ADD COLUMN IF NOT EXISTS winner_id INTEGER REFERENCES players(id)`,
      sql`ALTER TABLE card_clash_matches ADD COLUMN IF NOT EXISTS player_1_equipped_cards JSON`,
      sql`ALTER TABLE card_clash_matches ADD COLUMN IF NOT EXISTS player_2_equipped_cards JSON`,
      sql`ALTER TABLE card_clash_matches ADD COLUMN IF NOT EXISTS cards_used_in_match JSON`,
      sql`ALTER TABLE card_clash_matches ADD COLUMN IF NOT EXISTS player_1_points_earned INTEGER DEFAULT 0`,
      sql`ALTER TABLE card_clash_matches ADD COLUMN IF NOT EXISTS player_2_points_earned INTEGER DEFAULT 0`,
      sql`ALTER TABLE card_clash_matches ADD COLUMN IF NOT EXISTS is_mock BOOLEAN NOT NULL DEFAULT false`,
      // Drop NOT NULL on season_id so matches can exist without a season
      sql`ALTER TABLE card_clash_matches ALTER COLUMN season_id DROP NOT NULL`,
      sql`ALTER TABLE card_clash_matches DROP CONSTRAINT IF EXISTS card_clash_matches_season_id_card_clash_seasons_id_fk`,
    ]) {
      try { await db.execute(alter); } catch (e) { logger.warn({ e }, "matches column alter skipped"); }
    }
    logger.info("✓ card_clash_matches columns verified");

    // Fix 1: Ensure card_pity_system table exists with correct schema
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS card_pity_system (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
        pulls_since_legendary INTEGER NOT NULL DEFAULT 0,
        last_legendary_pull_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info("✓ card_pity_system table verified");

    // Fix 2: Ensure active season exists
    const activeSeason = await db.execute(sql`
      SELECT id FROM card_clash_seasons WHERE is_active = true LIMIT 1
    `);

    if (activeSeason.rows.length === 0) {
      const now = new Date();
      const startDate = now.toISOString().split("T")[0];
      const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      await db.execute(sql`
        INSERT INTO card_clash_seasons (name, start_date, end_date, is_active)
        VALUES (
          ${`Season ${now.getFullYear()}-${now.getMonth() + 1}`},
          ${startDate}::DATE,
          ${endDate}::DATE,
          true
        )
      `);
      logger.info(`✓ Created active season (${startDate} to ${endDate})`);
    } else {
      logger.info("✓ Active season already exists");
    }

    logger.info("✅ [STARTUP] Card Clash auto-fix complete");
  } catch (error) {
    logger.error({ error }, "⚠️ [STARTUP] Card Clash auto-fix failed - may need manual intervention");
  }
}

// Run auto-fix on module load
autoFixCardClash().catch(err => logger.error({ err }, "Auto-fix error during startup"));

// Middleware to verify admin PIN
const verifyAdminPin = (req: Request, res: Response, next: Function) => {
  const pin = req.headers["x-admin-pin"] as string;
  if (pin !== ADMIN_PIN) {
    return res.status(403).json({ error: "Unauthorized: Invalid admin PIN" });
  }
  next();
};

// === CARD SHOP ROUTES ===

// Get player currency balance
router.get("/shop/currency/:playerId", async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId);
    // Ensure player has a currency record (creates if doesn't exist)
    await ensurePlayerCurrency(playerId);
    const currency = await getPlayerCurrency(playerId);
    res.json(currency);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Get player Card Clash stats — computed directly from match history, no season needed
router.get("/player/:playerId/stats", async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId);
    
    await ensurePlayerCurrency(playerId);
    const [currency, inventory] = await Promise.all([
      getPlayerCurrency(playerId),
      getPlayerInventory(playerId),
    ]);

    // Aggregate wins/losses directly from card_clash_matches
    const result = await db.execute(sql`
      SELECT
        COUNT(CASE WHEN winner_id = ${playerId} THEN 1 END)::int AS wins,
        COUNT(CASE WHEN (player_1_id = ${playerId} OR player_2_id = ${playerId}) AND winner_id != ${playerId} THEN 1 END)::int AS losses,
        COUNT(CASE WHEN player_1_id = ${playerId} OR player_2_id = ${playerId} THEN 1 END)::int AS total_matches
      FROM card_clash_matches
      WHERE is_mock = 0
    `);
    const row = (result.rows?.[0] ?? {}) as any;

    res.json({
      playerId,
      coins: currency?.cardPoints || 0,
      cardsOwned: inventory?.length || 0,
      matchesPlayed: row.total_matches || 0,
      wins: row.wins || 0,
      losses: row.losses || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error, playerId: req.params.playerId }, "Failed to get player stats");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get player stats" });
  }
});

// Debug endpoint to check seasons table
router.get("/admin/debug/seasons", async (req: Request, res: Response) => {
  try {
    const adminPin = req.headers["x-admin-pin"] as string;
    if (adminPin !== ADMIN_PIN) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Try to get all seasons
    const seasons = await db.select().from(cardClashSeasonsTable);
    
    res.json({ 
      success: true, 
      count: seasons.length,
      seasons,
      message: "Table exists and is accessible"
    });
  } catch (error) {
    logger.error({ err: error }, "Season table debug failed");
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to access seasons table",
      message: "Table may not exist or there's a connection issue"
    });
  }
});

// Get active season endpoint
router.get("/admin/season/active", async (req: Request, res: Response) => {
  try {
    const adminPin = req.headers["x-admin-pin"] as string;
    if (adminPin !== ADMIN_PIN) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const season = await getActiveCardClashSeason();
    res.json({ success: true, season });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "No active season" });
  }
});


router.post("/shop/purchase", async (req: Request, res: Response) => {
  try {
    const { playerId, packType } = req.body;

    if (!["SINGLE", "FIVE", "TEN"].includes(packType)) {
      return res.status(400).json({ error: "Invalid pack type" });
    }

    // Ensure player has a currency record
    await ensurePlayerCurrency(playerId);
    
    const result = await purchasePack(playerId, packType);
    // Track packs opened and check achievements (fire-and-forget)
    incrementPacksOpened(playerId, 1).catch(() => {});
    checkAndAwardCCAchievements(playerId).catch(() => {});
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Get player card inventory
router.get("/inventory/:playerId", async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const inventory = await getPlayerInventory(playerId);
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Get all card definitions
router.get("/cards/all", async (req: Request, res: Response) => {
  try {
    const cards = await getAllCardDefinitions();
    res.json(cards || []);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Debug endpoint to check coin data in database
router.get("/debug/coins/:playerId", async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const currency = await getPlayerCurrency(playerId);
    const allCurrency = await db.query.playerCurrencyTable.findMany({
      where: (t) => ({ playerId: playerId }),
    });
    res.json({ 
      from_service: currency,
      from_db: allCurrency,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Get player pity status
router.get("/pity/:playerId", async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const pityStatus = await getPlayerPityStatus(playerId);
    res.json(pityStatus);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// === CARD CLASH MATCH ROUTES ===

// Get active season — season system removed, returns stable static response
router.get("/season/active", async (req: Request, res: Response) => {
  res.json({ id: null, name: "All Time", isActive: true });
});

// Admin: Create active season
router.post("/admin/season/create", async (req: Request, res: Response) => {
  try {
    // Check admin PIN
    const adminPin = req.headers["x-admin-pin"] as string;
    if (adminPin !== ADMIN_PIN) {
      return res.status(403).json({ error: "Unauthorized: Invalid admin PIN" });
    }

    try {
      // Check if season already exists
      const existing = await getActiveCardClashSeason();
      if (existing) {
        return res.status(400).json({ error: "Active season already exists", existing });
      }
    } catch (e) {
      // No active season found, continue
    }

    // Create new season (monthly based on current month)
    const now = new Date();
    const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    
    // Season runs from 1st to last day of month
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    logger.info({ monthName, startDate, endDate }, "Creating season with values");

    try {
      // Try Drizzle ORM first
      const season = await db
        .insert(cardClashSeasonsTable)
        .values({
          name: `${monthName} Season`,
          startDate,
          endDate,
          isActive: true,
          isLocked: false,
        })
        .returning();

      logger.info({ season: season[0] }, "Season created successfully (Drizzle)");
      return res.json({ success: true, season: season[0], message: `Created active season: ${monthName}` });
    } catch (drizzleError) {
      logger.warn({ err: drizzleError }, "Drizzle insert failed, trying raw SQL");

      // Fallback to raw SQL
      const result = await db.execute(sql`
        INSERT INTO card_clash_seasons (name, start_date, end_date, is_active, is_locked)
        VALUES (${`${monthName} Season`}, ${startDate}, ${endDate}, true, false)
        RETURNING id, name, start_date, end_date, is_active, is_locked, total_matches, created_at, updated_at
      `);

      if (result.rows && result.rows[0]) {
        const row = result.rows[0];
        const season = {
          id: row.id,
          name: row.name,
          startDate: row.start_date,
          endDate: row.end_date,
          isActive: row.is_active,
          isLocked: row.is_locked,
          totalMatches: row.total_matches,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
        logger.info({ season }, "Season created successfully (Raw SQL)");
        return res.json({ success: true, season, message: `Created active season: ${monthName}` });
      }

      throw new Error("Raw SQL insert failed - no result returned");
    }
  } catch (error) {
    logger.error({ err: error, errorMessage: error instanceof Error ? error.message : String(error) }, "Failed to create season");
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to create season",
      details: error instanceof Error ? error.stack : String(error)
    });
  }
});

// Start match
router.post("/match/start", async (req: Request, res: Response) => {
  try {
    const { gameMode, player1Id, player2Id, equippedCards } = req.body;
    
    // Validate gameMode
    if (!gameMode || !["X01", "CRICKET"].includes(gameMode)) {
      return res.status(400).json({ error: "Invalid gameMode - must be X01 or CRICKET" });
    }
    
    // Validate player IDs
    if (!player1Id || !player2Id || typeof player1Id !== "number" || typeof player2Id !== "number") {
      return res.status(400).json({ error: "Invalid player IDs" });
    }
    
    if (player1Id === player2Id) {
      return res.status(400).json({ error: "Cannot play against yourself" });
    }
    
    const match = await startCardClashMatch(gameMode, player1Id, player2Id, equippedCards);
    res.json(match);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Finish match
router.post("/match/finish", async (req: Request, res: Response) => {
  try {
    const { matchId, winnerId, cardsUsedInMatch } = req.body;
    if (!matchId || !winnerId) {
      return res.status(400).json({ error: "matchId and winnerId required" });
    }
    const result = await finishCardClashMatch(matchId, winnerId, cardsUsedInMatch);
    
    // Update challenges for both players
    const { challengeManager } = await import("../services/challenge-manager");
    
    // Get the loser (if available)
    const match = result;
    const loserId = match.player1_id === winnerId ? match.player2_id : match.player1_id;
    
    // Update winner's challenges
    await challengeManager.updateProgressFromGameResult(winnerId, {
      gameMode: "CARD_CLASH",
      won: true,
      cardsUsed: Array.isArray(cardsUsedInMatch) ? cardsUsedInMatch.length : (cardsUsedInMatch || 0),
    });
    
    // Update loser's challenges
    if (loserId) {
      await challengeManager.updateProgressFromGameResult(loserId, {
        gameMode: "CARD_CLASH",
        won: false,
        cardsUsed: Array.isArray(cardsUsedInMatch) ? cardsUsedInMatch.length : (cardsUsedInMatch || 0),
      });
    }
    
    // Check achievements for both players (fire-and-forget)
    checkAndAwardCCAchievements(winnerId).catch(() => {});
    if (loserId) checkAndAwardCCAchievements(loserId).catch(() => {});
    res.json({ success: true, match: result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// All-time standings — aggregated directly from card_clash_matches, no season needed
router.get("/standings", async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT
        p.id AS player_id,
        p.name AS player_name,
        COUNT(CASE WHEN m.winner_id = p.id THEN 1 END)::int AS wins,
        COUNT(CASE WHEN (m.player_1_id = p.id OR m.player_2_id = p.id) AND m.winner_id != p.id THEN 1 END)::int AS losses,
        COUNT(CASE WHEN m.player_1_id = p.id OR m.player_2_id = p.id THEN 1 END)::int AS total_matches,
        COALESCE(SUM(CASE WHEN m.player_1_id = p.id THEN m.player_1_points_earned
                          WHEN m.player_2_id = p.id THEN m.player_2_points_earned
                          ELSE 0 END), 0)::int AS points
      FROM players p
      JOIN card_clash_matches m ON (m.player_1_id = p.id OR m.player_2_id = p.id)
      WHERE m.is_mock = 0
      GROUP BY p.id, p.name
      ORDER BY wins DESC, total_matches DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Legacy: standings by season ID (kept for compatibility)
router.get("/standings/:seasonId", async (req: Request, res: Response) => {
  try {
    const seasonId = parseInt(req.params.seasonId);
    const standings = await getCardClashStandings(seasonId);
    res.json(standings);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Card Clash leaderboard - all-time rankings (no seasons)
router.get("/leaderboard", async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT
        l.player_id,
        p.name AS player_name,
        l.wins,
        l.losses,
        (l.wins + l.losses)::int AS total_matches,
        l.cards_unlocked_count,
        l.updated_at,
        CASE 
          WHEN (l.wins + l.losses) > 0 
          THEN ROUND((l.wins::numeric / (l.wins + l.losses)) * 100, 1)
          ELSE 0
        END AS win_percentage
      FROM card_clash_leaderboard l
      JOIN players p ON l.player_id = p.id
      ORDER BY l.wins DESC, total_matches DESC
    `);
    res.json(result.rows);
  } catch (error) {
    logger.warn({ error }, "Card Clash leaderboard endpoint - table may not exist yet");
    res.json([]); // Return empty leaderboard if table doesn't exist
  }
});

// Mock game: get available players (for selecting opponent)
router.get("/mock-game/players", async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT id, name FROM players WHERE is_active = true ORDER BY name
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Mock game: start a mock match (no real stakes, bot gets random cards)
router.post("/mock-game/start", async (req: Request, res: Response) => {
  try {
    const { player1Id, player2Id, player1Cards, isBotOpponent } = req.body;
    if (!player1Id) return res.status(400).json({ error: "player1Id required" });

    // For bots, pick random cards from catalog
    let botCards: any[] = [];
    if (isBotOpponent) {
      try {
        const allCards = await getAllCardDefinitions();
        const shuffled = [...allCards].sort(() => Math.random() - 0.5);
        botCards = shuffled.slice(0, 4).map((c: any) => ({ cardId: c.id, cardType: c.type === "BUFF" ? "GOOD" : "BAD" }));
      } catch (e) {
        logger.warn({ e }, "Could not load card catalog for bot — bot will have no cards");
      }
    }

    const p1Cards = Array.isArray(player1Cards) ? player1Cards : [];
    // player_2_id is NOT NULL FK — use player1Id as placeholder for bot games
    const p2Id = player2Id || player1Id;

    // season_id is NOT NULL in the original schema — drop the constraint synchronously
    // so the INSERT below can omit it (NULL is allowed after dropping NOT NULL)
    try { await db.execute(sql`ALTER TABLE card_clash_matches ALTER COLUMN season_id DROP NOT NULL`); } catch (_) {}
    try { await db.execute(sql`ALTER TABLE card_clash_matches DROP CONSTRAINT IF EXISTS card_clash_matches_season_id_card_clash_seasons_id_fk`); } catch (_) {}

    // Resolve season_id (may still be NOT NULL in prod even after ALTER attempt)
    let mockSeasonId: number | null = null;
    try {
      const sR = await db.execute(sql`SELECT id FROM card_clash_seasons WHERE is_active = true LIMIT 1`);
      if (sR.rows.length > 0) {
        mockSeasonId = (sR.rows[0] as any).id;
      } else {
        const now = new Date();
        const ins = await db.execute(sql`
          INSERT INTO card_clash_seasons (name, start_date, end_date, is_active)
          VALUES (${`Season ${now.getFullYear()}-${now.getMonth() + 1}`}, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', true)
          RETURNING id
        `);
        mockSeasonId = (ins.rows[0] as any)?.id ?? null;
      }
    } catch (_) {}

    const result = await db.execute(sql`
      INSERT INTO card_clash_matches
        (season_id, game_mode, player_1_id, player_2_id, winner_id,
         player_1_equipped_cards, player_2_equipped_cards, cards_used_in_match)
      VALUES
        (${mockSeasonId}, 'MOCK', ${player1Id}, ${p2Id}, ${player1Id},
         ${JSON.stringify(p1Cards)}::jsonb, ${JSON.stringify(botCards)}::jsonb, '[]'::jsonb)
      RETURNING *
    `);

    res.json({ success: true, match: result.rows[0], botCards, isBotOpponent: !!isBotOpponent });
  } catch (error) {
    logger.error({ error }, "Mock game start failed");
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Get match history
router.get("/matches/:playerId", async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const seasonId = req.query.seasonId ? parseInt(req.query.seasonId as string) : undefined;
    const matches = await getCardClashMatchHistory(playerId, seasonId);
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// === ADMIN ROUTES (all require valid admin PIN) ===

// Seed card definitions (one-time)
router.post("/admin/seed-cards", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    await seedCardDefinitions();
    res.json({ success: true, message: "Cards seeded" });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Seed challenges (daily + weekly)
router.post("/admin/challenges/seed", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    await challengeService.seedDefaultChallenges();
    res.json({ success: true, message: "Challenges seeded (8 daily + 6 weekly)" });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Seed seasonal quests
router.post("/admin/quests/seed", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    await seasonalQuestService.seedDefaultSeasonalQuests();
    res.json({ success: true, message: "Seasonal quests seeded" });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Get all cards
router.get("/admin/cards", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const cards = await getAllCardDefinitions();
    // Always ensure we return an array, even if undefined
    res.json(Array.isArray(cards) ? cards : []);
  } catch (error) {
    logger.error({ error }, "Failed to get all cards");
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Toggle card availability
router.post("/admin/card/toggle", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const { cardId, enabled } = req.body;
    await toggleCardAvailability(cardId, enabled);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Populate gridIndex for all cards (for image extraction from grid sheets)
router.post("/admin/cards/populate-grid-index", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const { cardDefinitionsTable } = await import("@workspace/db");
    
    // Fetch all cards ordered by creation
    const allCards = await db.select().from(cardDefinitionsTable).orderBy(cardDefinitionsTable.createdAt);
    
    let updated = 0;
    
    // Assign gridIndex based on gameMode + cardType + order within that group
    const groupedCards: { [key: string]: any[] } = {};
    
    for (const card of allCards) {
      const groupKey = `${card.gameMode}_${card.cardType}`;
      if (!groupedCards[groupKey]) {
        groupedCards[groupKey] = [];
      }
      groupedCards[groupKey].push(card);
    }
    
    // Update each card with gridIndex
    for (const group of Object.values(groupedCards)) {
      for (let i = 0; i < group.length; i++) {
        const card = group[i];
        // Limit to 20 cards per group (5x4 grid max)
        const gridIndex = i < 20 ? i : i % 20;
        
        await db
          .update(cardDefinitionsTable)
          .set({ gridIndex })
          .where(eq(cardDefinitionsTable.cardId, card.cardId));
        
        updated++;
      }
    }
    
    res.json({ 
      success: true, 
      message: `Updated ${updated} cards with gridIndex`,
      groupedCards: Object.keys(groupedCards).map(key => ({
        group: key,
        count: groupedCards[key].length
      }))
    });
  } catch (error) {
    logger.error({ error }, "Failed to populate gridIndex");
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Give coins to player (admin)
router.post("/admin/coins/give", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const { playerId, amount } = req.body;
    // Ensure player has a currency record first
    await ensurePlayerCurrency(playerId);
    await addCoinsToPlayer(playerId, amount);
    const currency = await getPlayerCurrency(playerId);
    res.json(currency);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Remove coins from player (admin)
router.post("/admin/coins/remove", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const { playerId, amount } = req.body;
    // Ensure player has a currency record first
    await ensurePlayerCurrency(playerId);
    await removeCoinsFromPlayer(playerId, amount);
    const currency = await getPlayerCurrency(playerId);
    res.json(currency);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Give card to player (admin)
router.post("/admin/card/give", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const { playerId, cardId, quantity } = req.body;
    // Ensure player has currency and inventory records
    await ensurePlayerCurrency(playerId);
    await giveCardToPlayer(playerId, cardId, quantity || 1);
    const inventory = await getPlayerInventory(playerId);
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Give all cards to a player (admin — for testing/preview)
router.post("/admin/give-all-cards", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const { playerId } = req.body;
    if (!playerId) return res.status(400).json({ error: "playerId required" });
    await ensurePlayerCurrency(playerId);
    const allCards = await getAllCardDefinitions();
    for (const card of allCards) {
      await giveCardToPlayer(playerId, (card as any).cardId ?? (card as any).id, 1);
    }
    const inventory = await getPlayerInventory(playerId);
    res.json({ success: true, given: allCards.length, inventory });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Remove card from player (admin)
router.post("/admin/card/remove", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const { playerId, cardId, quantity } = req.body;
    // Ensure player has currency and inventory records
    await ensurePlayerCurrency(playerId);
    await removeCardFromPlayer(playerId, cardId, quantity || 1);
    const inventory = await getPlayerInventory(playerId);
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Delete match (admin)
router.post("/admin/match/delete", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const { matchId } = req.body;
    await deleteCardClashMatch(matchId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Reset player card data (admin)
router.post("/admin/player/reset", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const { playerId } = req.body;
    await resetPlayerCardData(playerId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Get feature status (public endpoint - everyone can check)
import { getFeatureStatus, FEATURES } from "../services/feature-flags-service";

router.get("/feature-status", async (req: Request, res: Response) => {
  try {
    // Get player ID from session/auth if available
    const userId = (req as any).user?.playerId;
    const isAdmin = (req as any).user?.isAdmin ?? false;

    // Return all feature statuses
    const [cardShop, coins, cardClash] = await Promise.all([
      getFeatureStatus(FEATURES.CARD_SHOP, isAdmin),
      getFeatureStatus(FEATURES.COINS, isAdmin),
      getFeatureStatus(FEATURES.CARD_CLASH, isAdmin),
    ]);

    res.json({
      cardShop,
      coins,
      cardClash,
      isAdmin,
      userId,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// === DAILY LOGIN ROUTES ===

router.post("/login/daily", async (req: Request, res: Response) => {
  try {
    const { playerId } = req.body;
    if (!playerId) {
      return res.status(400).json({ error: "playerId required" });
    }

    const { cardClashLoginService } = await import("../services/card-clash-login-service");
    const reward = await cardClashLoginService.handleDailyLogin(playerId);

    // Check login-streak achievements (fire-and-forget)
    checkAndAwardCCAchievements(playerId).catch(() => {});
    res.json({ success: true, reward });
  } catch (error) {
    logger.error("Daily login error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/login/streak/:playerId", async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const { cardClashLoginService } = await import("../services/card-clash-login-service");
    const streak = await cardClashLoginService.getStreakInfo(playerId);

    res.json(streak || { currentStreak: 0, longestStreak: 0, lastLoginDate: null });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.post("/admin/login/reset/:playerId", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const { cardClashLoginService } = await import("../services/card-clash-login-service");
    await cardClashLoginService.resetStreak(playerId);

    res.json({ success: true, message: `Login streak reset for player ${playerId}` });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// === CHALLENGE ROUTES ===

router.get("/challenges/daily/:playerId", async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const { challengeService } = await import("../services/challenge-service");
    const challenges = await challengeService.getDailyChallengesForPlayer(playerId);

    res.json({ challenges, period: "daily" });
  } catch (error) {
    logger.error("Get daily challenges error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/challenges/weekly/:playerId", async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const { challengeService } = await import("../services/challenge-service");
    const challenges = await challengeService.getWeeklyChallengesForPlayer(playerId);

    res.json({ challenges, period: "weekly" });
  } catch (error) {
    logger.error("Get weekly challenges error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Reroll a daily challenge
router.post("/challenges/reroll-daily", async (req: Request, res: Response) => {
  try {
    const { playerId, challengeId } = req.body;
    if (!playerId || !challengeId) {
      return res.status(400).json({ error: "playerId and challengeId required" });
    }

    const { challengeManager } = await import("../services/challenge-manager");
    const result = await challengeManager.rerollDaily(playerId, challengeId);
    res.json(result);
  } catch (error) {
    logger.error("Reroll daily error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Reroll a weekly challenge
router.post("/challenges/reroll-weekly", async (req: Request, res: Response) => {
  try {
    const { playerId, challengeId } = req.body;
    if (!playerId || !challengeId) {
      return res.status(400).json({ error: "playerId and challengeId required" });
    }

    const { challengeManager } = await import("../services/challenge-manager");
    const result = await challengeManager.rerollWeekly(playerId, challengeId);
    res.json(result);
  } catch (error) {
    logger.error("Reroll weekly error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.post("/challenges/update-daily", async (req: Request, res: Response) => {
  try {
    const { playerId, challengeKey, incrementBy = 1 } = req.body;
    if (!playerId || !challengeKey) {
      return res.status(400).json({ error: "playerId and challengeKey required" });
    }

    const { challengeService } = await import("../services/challenge-service");
    const result = await challengeService.updateDailyProgress(playerId, challengeKey, incrementBy);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error("Update daily challenge error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.post("/challenges/update-weekly", async (req: Request, res: Response) => {
  try {
    const { playerId, challengeKey, incrementBy = 1 } = req.body;
    if (!playerId || !challengeKey) {
      return res.status(400).json({ error: "playerId and challengeKey required" });
    }

    const { challengeService } = await import("../services/challenge-service");
    const result = await challengeService.updateWeeklyProgress(playerId, challengeKey, incrementBy);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error("Update weekly challenge error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// === SEASONAL QUEST ROUTES ===

router.get("/quests/seasonal/:playerId", async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const { seasonalQuestService } = await import("../services/seasonal-quest-service");
    const quests = await seasonalQuestService.getSeasonalQuestsForPlayer(playerId);

    res.json({ quests, period: "seasonal" });
  } catch (error) {
    logger.error("Get seasonal quests error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.post("/quests/update-seasonal", async (req: Request, res: Response) => {
  try {
    const { playerId, questKey, incrementBy = 1 } = req.body;
    if (!playerId || !questKey) {
      return res.status(400).json({ error: "playerId and questKey required" });
    }

    const { seasonalQuestService } = await import("../services/seasonal-quest-service");
    const result = await seasonalQuestService.updateSeasonalProgress(playerId, questKey, incrementBy);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error("Update seasonal quest error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.post("/admin/quests/seed", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const { seasonalQuestService } = await import("../services/seasonal-quest-service");
    await seasonalQuestService.seedDefaultSeasonalQuests();

    res.json({ success: true, message: "Default seasonal quests seeded" });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// === CARD CLASH ACHIEVEMENTS ===

router.get("/achievements/:playerId", async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const data = await getCCAchievementsForPlayer(playerId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.post("/achievements/check/:playerId", async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const newly = await checkAndAwardCCAchievements(playerId);
    res.json({ newlyAwarded: newly, count: newly.length });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// === PACK INVENTORY (earned from achievements) ===

router.get("/pack-inventory/:playerId", async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const packs = await getPlayerPackInventory(playerId);
    res.json(packs);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.post("/pack-inventory/:inventoryId/open", async (req: Request, res: Response) => {
  try {
    const inventoryId = parseInt(req.params.inventoryId);
    const { playerId } = req.body;
    if (!playerId) return res.status(400).json({ error: "playerId required" });

    // Get the pack type before marking as opened
    const { db: dbConn } = await import("@workspace/db");
    const { sql: sqlFn } = await import("drizzle-orm");
    const packRow = await dbConn.execute(sqlFn`
      SELECT pack_type FROM card_clash_pack_inventory
      WHERE id = ${inventoryId} AND player_id = ${playerId} AND is_opened = FALSE
    `);
    const row = packRow.rows[0] as any;
    if (!row) return res.status(404).json({ error: "Pack not found or already opened" });

    const packType = row.pack_type as "SINGLE" | "FIVE" | "TEN";

    // Mark opened first
    const ok = await markPackOpened(inventoryId, parseInt(playerId));
    if (!ok) return res.status(400).json({ error: "Could not open pack" });

    // Award coins to cover the pack cost, then purchase (so no coin balance needed)
    const PACK_COSTS: Record<string, number> = { SINGLE: 50, FIVE: 200, TEN: 350 };
    await addCoinsToPlayer(parseInt(playerId), PACK_COSTS[packType] ?? 200);
    const result = await purchasePack(parseInt(playerId), packType);

    // Track packs opened + re-check achievements
    incrementPacksOpened(parseInt(playerId), 1).catch(() => {});
    checkAndAwardCCAchievements(parseInt(playerId)).catch(() => {});

    res.json({ success: true, packType, cards: result.cardsGenerated });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// === SELL DUPLICATE CARDS ===

router.post("/sell-card", async (req: Request, res: Response) => {
  try {
    const { playerId, cardId } = req.body;
    if (!playerId || !cardId) return res.status(400).json({ error: "playerId and cardId required" });

    // Check the card rarity for dynamic pricing
    const cardDef = await db.execute(sql`
      SELECT rarity FROM card_definitions WHERE card_id = ${cardId} AND enabled = TRUE LIMIT 1
    `);
    const rarity = (cardDef.rows[0] as any)?.rarity ?? "COMMON";
    const SELL_PRICES: Record<string, number> = { COMMON: 10, RARE: 30, LEGENDARY: 100 };
    const coinsEarned = SELL_PRICES[rarity.toUpperCase()] ?? 10;

    await removeCardFromPlayer(parseInt(playerId), String(cardId), 1);
    await addCoinsToPlayer(parseInt(playerId), coinsEarned);

    res.json({ success: true, coinsEarned, rarity });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});


  // === LAUNCH PREP: CHALLENGE & FULL RESET ROUTES ===

  // Clear challenge progress — all players (omit playerId) or specific player
  router.post("/admin/challenges/clear", verifyAdminPin, async (req: Request, res: Response) => {
    try {
      const { playerId } = req.body;
      if (playerId) {
        const pid = parseInt(String(playerId));
        await db.execute(sql`DELETE FROM player_daily_challenges WHERE player_id = ${pid}`);
        await db.execute(sql`DELETE FROM player_weekly_challenges WHERE player_id = ${pid}`);
        res.json({ success: true, message: `Cleared challenges for player ${pid}` });
      } else {
        await db.execute(sql`DELETE FROM player_daily_challenges`);
        await db.execute(sql`DELETE FROM player_weekly_challenges`);
        res.json({ success: true, message: "Cleared all challenge progress for every player" });
      }
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Nuclear reset — wipes all Card Clash player data, keeps definitions/seasons
  router.post("/admin/full-reset", verifyAdminPin, async (req: Request, res: Response) => {
    try {
      const results: string[] = [];

      const inv = await db.execute(sql`DELETE FROM player_card_inventory`);
      results.push(`player_card_inventory: ${(inv as any).rowCount ?? 0} deleted`);

      const cur = await db.execute(sql`
        UPDATE player_currency
        SET card_points = 200, packs_opened = 0, matches_played = 0, matches_won = 0, matches_lost = 0
      `);
      results.push(`player_currency: ${(cur as any).rowCount ?? 0} reset to 200 coins`);

      const mat = await db.execute(sql`DELETE FROM card_clash_matches`);
      results.push(`card_clash_matches: ${(mat as any).rowCount ?? 0} deleted`);

      const pi = await db.execute(sql`DELETE FROM card_clash_pack_inventory`);
      results.push(`card_clash_pack_inventory: ${(pi as any).rowCount ?? 0} deleted`);

      const ach = await db.execute(sql`DELETE FROM card_clash_achievements_earned`);
      results.push(`card_clash_achievements_earned: ${(ach as any).rowCount ?? 0} deleted`);

      const dc = await db.execute(sql`DELETE FROM player_daily_challenges`);
      results.push(`player_daily_challenges: ${(dc as any).rowCount ?? 0} deleted`);

      const wc = await db.execute(sql`DELETE FROM player_weekly_challenges`);
      results.push(`player_weekly_challenges: ${(wc as any).rowCount ?? 0} deleted`);

      const ls = await db.execute(sql`
        UPDATE player_login_streaks
        SET current_streak = 0, longest_streak = 0, last_login_date = NULL
      `);
      results.push(`player_login_streaks: ${(ls as any).rowCount ?? 0} reset`);

      res.json({ success: true, message: "🚀 Full reset complete — TKDL Card Clash ready for launch!", results });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ========== FEATURED CARD SHOP ==========

  /**
   * GET /api/card-clash/shop/featured
   * Get today's featured cards available for purchase
   */
  router.get("/shop/featured", async (req: Request, res: Response) => {
    try {
      const { getTodaysFeaturedCards } = await import("../services/featured-card-shop-service");
      const featured = await getTodaysFeaturedCards();
      res.json({
        success: true,
        featured,
        message: featured.length > 0 ? "Featured cards loaded" : "No featured cards available",
      });
    } catch (error) {
      logger.error({ error }, "Failed to get featured cards");
      res.status(500).json({ success: false, message: "Failed to load featured cards" });
    }
  });

  /**
   * POST /api/card-clash/shop/featured/:cardId/purchase
   * Purchase a featured card
   * Body: { playerId: number }
   */
  router.post("/shop/featured/:cardId/purchase", async (req: Request, res: Response) => {
    try {
      const { cardId } = req.params;
      const { playerId } = req.body;

      if (!cardId || !playerId) {
        return res.status(400).json({ success: false, message: "Missing cardId or playerId" });
      }

      const { purchaseFeaturedCard } = await import("../services/featured-card-shop-service");
      const result = await purchaseFeaturedCard(Number(playerId), Number(cardId));

      if (result.success) {
        res.json({ success: true, ...result });
      } else {
        res.status(400).json({ success: false, message: result.message });
      }
    } catch (error) {
      logger.error({ error }, "Failed to purchase featured card");
      res.status(500).json({ success: false, message: "Purchase failed" });
    }
  });

  /**
   * POST /api/card-clash/shop/admin/rotate
   * Force rotation of featured cards (admin only)
   * Header: x-admin-pin
   */
  router.post("/shop/admin/rotate", async (req: Request, res: Response) => {
    try {
      const adminPin = req.headers["x-admin-pin"];
      if (adminPin !== process.env.ADMIN_PIN) {
        return res.status(403).json({ success: false, message: "Unauthorized" });
      }

      const { rotateFeatureCards } = await import("../services/featured-card-shop-service");
      const result = await rotateFeatureCards();
      res.json({ success: true, message: "Featured cards rotated", result });
    } catch (error) {
      logger.error({ error }, "Failed to rotate featured cards");
      res.status(500).json({ success: false, message: "Rotation failed" });
    }
  });

  /**
   * GET /api/card-clash/shop/admin/purchase-history
   * Get purchase history for auditing (admin only)
   */
  router.get("/shop/admin/purchase-history", async (req: Request, res: Response) => {
    try {
      const adminPin = req.headers["x-admin-pin"];
      if (adminPin !== process.env.ADMIN_PIN) {
        return res.status(403).json({ success: false, message: "Unauthorized" });
      }

      const limit = Math.min(Number(req.query.limit) || 100, 1000);
      const { getShopPurchaseHistory } = await import("../services/featured-card-shop-service");
      const history = await getShopPurchaseHistory(limit);

      res.json({
        success: true,
        count: history.length,
        history,
      });
    } catch (error) {
      logger.error({ error }, "Failed to get purchase history");
      res.status(500).json({ success: false, message: "Failed to load history" });
    }
  });

  /**
   * GET /api/card-clash/shop/admin/statistics
   * Get shop statistics for auditing (admin only)
   */
  router.get("/shop/admin/statistics", async (req: Request, res: Response) => {
    try {
      const adminPin = req.headers["x-admin-pin"];
      if (adminPin !== process.env.ADMIN_PIN) {
        return res.status(403).json({ success: false, message: "Unauthorized" });
      }

      const { getShopStatistics } = await import("../services/featured-card-shop-service");
      const stats = await getShopStatistics();
      res.json({ success: true, statistics: stats });
    } catch (error) {
      logger.error({ error }, "Failed to get statistics");
      res.status(500).json({ success: false, message: "Failed to load statistics" });
    }
  });

  /**
   * GET /api/card-clash/all-cards
   * Return all cards in the game for practice mode card selection
   */
  router.get("/all-cards", async (req: Request, res: Response) => {
    try {
      const { cardDefinitionsTable } = await import("@workspace/db");
      
      const allCards = await db
        .select()
        .from(cardDefinitionsTable)
        .orderBy(sql`CAST(${cardDefinitionsTable.id} AS INTEGER)`);

      const cards = allCards.map((c: any) => ({
        id: parseInt(c.id),
        name: c.cardName,
        category: c.category || "NEUTRAL",
        rarity: c.rarity || "COMMON",
        effect: c.effect || "",
        cardId: c.cardId,
      }));

      res.json({ success: true, count: cards.length, cards });
    } catch (error) {
      logger.error({ error }, "Failed to get all cards");
      res.status(500).json({ success: false, error: "Failed to load cards" });
    }
  });

  /**
   * GET /api/card-clash/practice/bots
   * Return available bot opponents for practice mode
   */
  router.get("/practice/bots", async (req: Request, res: Response) => {
    try {
      const bots = [
        {
          id: "bot-beginner",
          name: "Shadow Bot",
          difficulty: "BEGINNER",
          description: "Perfect for learning the ropes",
          avatar: "🤖",
          skillLevel: 2,
        },
        {
          id: "bot-intermediate",
          name: "Cyber Pro",
          difficulty: "INTERMEDIATE",
          description: "A solid opponent with strategy",
          avatar: "🔧",
          skillLevel: 5,
        },
        {
          id: "bot-advanced",
          name: "Master Mind",
          difficulty: "ADVANCED",
          description: "Nearly unbeatable AI opponent",
          avatar: "🧠",
          skillLevel: 8,
        },
      ];

      res.json({ success: true, bots });
    } catch (error) {
      logger.error({ error }, "Failed to get practice bots");
      res.status(500).json({ success: false, error: "Failed to load bots" });
    }
  });

  /**
   * POST /api/card-clash/practice/create
   * Create a practice match with equipped cards
   * Returns matchId to load and play
   */
  router.post("/practice/create", async (req: Request, res: Response) => {
    try {
      const { playerId, opponentId, gameMode, selectedCards } = req.body;

      if (!playerId || !opponentId || !gameMode || !selectedCards) {
        return res.status(400).json({
          success: false,
          error: "Missing: playerId, opponentId, gameMode, selectedCards",
        });
      }

      if (!Array.isArray(selectedCards) || selectedCards.length !== 4) {
        return res.status(400).json({
          success: false,
          error: "selectedCards must be array of 4 card IDs",
        });
      }

      if (!["X01", "CRICKET"].includes(gameMode)) {
        return res.status(400).json({
          success: false,
          error: "gameMode must be X01 or CRICKET",
        });
      }

      // Ensure player currency exists
      await ensurePlayerCurrency(playerId);

      // Bot opponents use player_2_id = -1
      const opponent2Id = opponentId.startsWith("bot-") ? -1 : parseInt(opponentId);

      // Create practice match (is_mock=1, player_1_equipped_cards stored)
      const result = await db.execute(sql`
        INSERT INTO card_clash_matches (
          player_1_id,
          player_2_id,
          game_mode,
          is_mock,
          player_1_equipped_cards,
          created_at,
          updated_at
        ) VALUES (
          ${playerId},
          ${opponent2Id},
          ${gameMode},
          1,
          ${JSON.stringify(selectedCards.map(id => ({ cardId: id })))},
          NOW(),
          NOW()
        )
        RETURNING id
      `);

      const matchId = (result.rows?.[0] as any)?.id;
      if (!matchId) {
        return res.status(500).json({ success: false, error: "Failed to create match" });
      }

      logger.info({ playerId, opponentId, gameMode, matchId }, "Practice match created");

      res.json({ success: true, matchId });
    } catch (error) {
      logger.error({ error }, "Failed to create practice match");
      res.status(500).json({ success: false, error: "Failed to create practice match" });
    }
  });

  /**
   * GET /api/card-clash/practice/:matchId
   * Load practice match data for gameplay
   */
  router.get("/practice/:matchId", async (req: Request, res: Response) => {
    try {
      const { matchId } = req.params;
      const { cardClashMatchesTable } = await import("@workspace/db");

      if (!matchId) {
        return res.status(400).json({ success: false, error: "matchId required" });
      }

      const match = await db
        .select()
        .from(cardClashMatchesTable)
        .where(eq(cardClashMatchesTable.id, parseInt(matchId)));

      if (!match || match.length === 0) {
        return res.status(404).json({ success: false, error: "Practice match not found" });
      }

      const m = match[0];

      // Parse equipped cards safely
      const player1Cards = typeof m.player1EquippedCards === "string"
        ? JSON.parse(m.player1EquippedCards)
        : Array.isArray(m.player1EquippedCards)
        ? m.player1EquippedCards
        : [];

      res.json({
        success: true,
        match: {
          id: m.id,
          player1Id: m.player1Id,
          player2Id: m.player2Id,
          gameMode: m.gameMode,
          player1EquippedCards: player1Cards,
          createdAt: m.createdAt,
        },
      });
    } catch (error) {
      logger.error({ error }, "Failed to load practice match");
      res.status(500).json({ success: false, error: "Failed to load practice match" });
    }
  });

export default router;
