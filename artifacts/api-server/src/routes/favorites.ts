/**
 * Card Favorites API Routes
 * 
 * Persists Card Clash favorite cards to database
 * - Max 20 favorites per game mode per player
 * - Unique constraint per card per game mode
 */

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and } from 'drizzle-orm';
import { cardClashFavoritesTable } from '@tkdl/db';
import { db } from '../db';

const router = Router();

/**
 * Get player ID from session
 */
function getPlayerId(req: any): number | null {
  return (req.session as any)?.playerId ?? null;
}

// GET /api/card-favorites
// Return player's favorite cards for a game mode
router.get("/card-favorites", async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = getPlayerId(req);
    if (!playerId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const gameMode = (req.query.gameMode as string) || 'X01';

    const favorites = await db
      .select()
      .from(cardClashFavoritesTable)
      .where(
        and(
          eq(cardClashFavoritesTable.playerId, playerId),
          eq(cardClashFavoritesTable.gameMode, gameMode)
        )
      );

    res.json({ favorites });
  } catch (error) {
    logger.error({ error }, "Failed to get card favorites");
    res.status(500).json({ error: "Failed to retrieve favorites" });
  }
});

// POST /api/card-favorites
// Add a card to favorites
router.post("/card-favorites", async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = getPlayerId(req);
    if (!playerId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { cardId, cardName, gameMode } = req.body;
    if (!cardId || !gameMode) {
      res.status(400).json({ error: "cardId and gameMode required" });
      return;
    }

    // Check if already favorited
    const existing = await db
      .select()
      .from(cardClashFavoritesTable)
      .where(
        and(
          eq(cardClashFavoritesTable.playerId, playerId),
          eq(cardClashFavoritesTable.cardId, cardId),
          eq(cardClashFavoritesTable.gameMode, gameMode)
        )
      );

    if (existing.length > 0) {
      res.status(409).json({ error: "Already favorited" });
      return;
    }

    // Check count limit (max 20 per game mode)
    const count = await db
      .select()
      .from(cardClashFavoritesTable)
      .where(
        and(
          eq(cardClashFavoritesTable.playerId, playerId),
          eq(cardClashFavoritesTable.gameMode, gameMode)
        )
      );

    if (count.length >= 20) {
      res.status(400).json({ error: "Maximum 20 favorites per game mode" });
      return;
    }

    // Insert favorite
    await db.insert(cardClashFavoritesTable).values({
      playerId,
      cardId,
      cardName,
      gameMode,
    });

    logger.debug({ playerId, cardId, gameMode }, "Favorite added");
    res.json({ ok: true, message: "Favorite added" });
  } catch (error) {
    logger.error({ error }, "Failed to add favorite");
    res.status(500).json({ error: "Failed to add favorite" });
  }
});

// DELETE /api/card-favorites/:cardId
// Remove a card from favorites
router.delete("/card-favorites/:cardId", async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = getPlayerId(req);
    if (!playerId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { cardId } = req.params;
    const gameMode = (req.query.gameMode as string) || 'X01';

    if (!cardId) {
      res.status(400).json({ error: "cardId required" });
      return;
    }

    const result = await db
      .delete(cardClashFavoritesTable)
      .where(
        and(
          eq(cardClashFavoritesTable.playerId, playerId),
          eq(cardClashFavoritesTable.cardId, cardId),
          eq(cardClashFavoritesTable.gameMode, gameMode)
        )
      );

    logger.debug({ playerId, cardId, gameMode }, "Favorite removed");
    res.json({ ok: true, message: "Favorite removed" });
  } catch (error) {
    logger.error({ error }, "Failed to remove favorite");
    res.status(500).json({ error: "Failed to remove favorite" });
  }
});

// DELETE /api/card-favorites
// Clear all favorites for a game mode
router.delete("/card-favorites", async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = getPlayerId(req);
    if (!playerId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const gameMode = (req.query.gameMode as string) || 'X01';

    await db
      .delete(cardClashFavoritesTable)
      .where(
        and(
          eq(cardClashFavoritesTable.playerId, playerId),
          eq(cardClashFavoritesTable.gameMode, gameMode)
        )
      );

    logger.debug({ playerId, gameMode }, "All favorites cleared");
    res.json({ ok: true, message: "All favorites cleared" });
  } catch (error) {
    logger.error({ error }, "Failed to clear favorites");
    res.status(500).json({ error: "Failed to clear favorites" });
  }
});

export default router;
