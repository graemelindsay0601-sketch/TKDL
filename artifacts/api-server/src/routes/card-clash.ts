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
    const { matchId, winnerId, player1PointsEarned, player2PointsEarned } = req.body;
    await finishCardClashMatch(matchId, winnerId, player1PointsEarned, player2PointsEarned);
    res.json({ success: true });
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

// Get all cards
router.get("/admin/cards", verifyAdminPin, async (req: Request, res: Response) => {
  try {
    const cards = await getAllCardDefinitions();
    res.json(cards);
  } catch (error) {
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

export default router;
