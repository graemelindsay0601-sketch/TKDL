/**
 * Card Favorites API Routes (Mock Implementation)
 * 
 * NOTE: Card Clash favorites are managed client-side in localStorage/session storage
 * These API endpoints return empty results for compatibility.
 * The actual favorites management happens in the UI (CardEquipmentSelector, CardCollection)
 */

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';

const router = Router();

/**
 * Get player ID from session
 */
function getPlayerId(req: any): number | null {
  return (req.session as any)?.playerId ?? null;
}

// GET /api/card-favorites
// Return player's favorite cards
router.get("/card-favorites", async (req: Request, res: Response): Promise<void> => {
  try {
    const playerId = getPlayerId(req);
    if (!playerId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    // NOTE: Favorites are now managed client-side
    // Return empty array for API compatibility
    res.json([]);
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

    const { cardId, gameMode } = req.body;
    if (!cardId || !gameMode) {
      res.status(400).json({ error: "cardId and gameMode required" });
      return;
    }

    // NOTE: Favorites are now managed client-side
    // Return success for API compatibility
    logger.debug({ playerId, cardId, gameMode }, "Favorite added (client-side)");
    res.json({ success: true, message: "Favorite added" });
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
    if (!cardId) {
      res.status(400).json({ error: "cardId required" });
      return;
    }

    // NOTE: Favorites are now managed client-side
    // Return success for API compatibility
    logger.debug({ playerId, cardId }, "Favorite removed (client-side)");
    res.json({ success: true, message: "Favorite removed" });
  } catch (error) {
    logger.error({ error }, "Failed to remove favorite");
    res.status(500).json({ error: "Failed to remove favorite" });
  }
});

export default router;
