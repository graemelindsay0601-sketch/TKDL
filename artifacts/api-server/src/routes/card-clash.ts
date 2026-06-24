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
import { db, cardClashMatchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// Admin PIN for protecting card-clash admin routes
const ADMIN_PIN = process.env.ADMIN_PIN ?? "0601";

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
    const currency = await getPlayerCurrency(playerId);
    res.json(currency);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Purchase pack
router.post("/shop/purchase", async (req: Request, res: Response) => {
  try {
    const { playerId, packType } = req.body;

    if (!["SINGLE", "FIVE", "TEN"].includes(packType)) {
      return res.status(400).json({ error: "Invalid pack type" });
    }

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
    const season = await getActiveCardClashSeason();
    res.json(season);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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

// Give coins to player (admin)
router.post("/admin/coins/give", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const { playerId, amount } = req.body;
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

    res.json(streak || { currentStreak: 0, bestStreak: 0, totalLogins: 0, lastLoginDate: null });
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

router.post("/admin/challenges/seed", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const { challengeService } = await import("../services/challenge-service");
    await challengeService.seedDefaultChallenges();

    res.json({ success: true, message: "Default challenges seeded" });
  } catch (error) {
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
