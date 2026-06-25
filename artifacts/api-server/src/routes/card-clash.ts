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

// Debug endpoint to check seasons table
router.get("/admin/debug/seasons", async (req: Request, res: Response) => {
  try {
    const adminPin = req.headers["x-admin-pin"] as string;
    if (adminPin !== (process.env.ADMIN_PIN ?? "0601")) {
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
    if (adminPin !== (process.env.ADMIN_PIN ?? "0601")) {
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

// Get active season
router.get("/season/active", async (req: Request, res: Response) => {
  try {
    console.log("[SEASON] Fetching active season...");
    const season = await getActiveCardClashSeason();
    console.log("[SEASON] Got season:", season);
    res.json(season);
  } catch (error) {
    console.error("[SEASON] Error getting season:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Admin: Create active season
router.post("/admin/season/create", async (req: Request, res: Response) => {
  try {
    // Check admin PIN
    const adminPin = req.headers["x-admin-pin"] as string;
    if (adminPin !== (process.env.ADMIN_PIN ?? "0601")) {
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
      cardsUsed: cardsUsedInMatch || 0,
    });
    
    // Update loser's challenges
    if (loserId) {
      await challengeManager.updateProgressFromGameResult(loserId, {
        gameMode: "CARD_CLASH",
        won: false,
        cardsUsed: cardsUsedInMatch || 0,
      });
    }
    
    res.json({ success: true, match: result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Get standings
router.get("/standings/:seasonId", async (req: Request, res: Response) => {
  try {
    const seasonId = parseInt(req.params.seasonId);
    const standings = await getCardClashStandings(seasonId);
    res.json(standings);
  } catch (error) {
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

    res.json({
      success: true,
      reward,
    });
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

export default router;
