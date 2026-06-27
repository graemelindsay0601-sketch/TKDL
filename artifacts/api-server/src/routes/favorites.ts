/**
 * Favorites API Routes
 * 
 * Endpoints for managing player card favorites
 * - POST /api/cards/:cardId/favorite - Toggle favorite status
 * - GET /api/player/:playerId/cards/favorites - Get all favorites
 * - PUT /api/cards/:cardId/favorite - Set favorite status explicitly
 */

import { Router, Request, Response } from 'express';
import { db, cardInventoryTable } from '@workspace/db';
import { eq, and } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/player/:playerId/cards/favorites
 * Get all favorite cards for a player
 */
router.get('/player/:playerId/cards/favorites', async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId, 10);
    if (isNaN(playerId)) {
      res.status(400).json({ error: 'Invalid player ID' });
      return;
    }

    // Query all favorite cards for this player
    const favorites = await db
      .select()
      .from(cardInventoryTable)
      .where(and(
        eq(cardInventoryTable.playerId, playerId),
        eq(cardInventoryTable.isFavorite, true)
      ));

    res.json({ favorites, count: favorites.length });
  } catch (err) {
    (req as any).log?.error({ err }, 'Failed to get favorites');
    res.status(500).json({ error: 'Failed to get favorites' });
  }
});

/**
 * POST /api/cards/:cardId/favorite
 * Toggle favorite status for a card
 */
router.post('/cards/:cardId/favorite', async (req: Request, res: Response) => {
  try {
    const { playerId } = req.body;
    const cardId = req.params.cardId;

    if (!playerId || !cardId) {
      res.status(400).json({ error: 'Invalid player ID or card ID' });
      return;
    }

    // Get current favorite status
    const [card] = await db
      .select()
      .from(cardInventoryTable)
      .where(and(
        eq(cardInventoryTable.playerId, playerId),
        eq(cardInventoryTable.cardId, cardId)
      ));

    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }

    // Toggle the favorite status
    const newFavoriteStatus = !card.isFavorite;
    await db
      .update(cardInventoryTable)
      .set({ isFavorite: newFavoriteStatus })
      .where(and(
        eq(cardInventoryTable.playerId, playerId),
        eq(cardInventoryTable.cardId, cardId)
      ));

    res.json({
      success: true,
      cardId,
      isFavorite: newFavoriteStatus,
      message: newFavoriteStatus ? 'Card marked as favorite ⭐' : 'Favorite removed'
    });
  } catch (err) {
    (req as any).log?.error({ err }, 'Failed to toggle favorite');
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

/**
 * PUT /api/cards/:cardId/favorite
 * Set favorite status explicitly
 */
router.put('/cards/:cardId/favorite', async (req: Request, res: Response) => {
  try {
    const { playerId, isFavorite } = req.body;
    const cardId = req.params.cardId;

    if (!playerId || !cardId || typeof isFavorite !== 'boolean') {
      res.status(400).json({ error: 'Invalid parameters' });
      return;
    }

    const [card] = await db
      .select()
      .from(cardInventoryTable)
      .where(and(
        eq(cardInventoryTable.playerId, playerId),
        eq(cardInventoryTable.cardId, cardId)
      ));

    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }

    await db
      .update(cardInventoryTable)
      .set({ isFavorite })
      .where(and(
        eq(cardInventoryTable.playerId, playerId),
        eq(cardInventoryTable.cardId, cardId)
      ));

    res.json({
      success: true,
      cardId,
      isFavorite,
      message: `Favorite status set to ${isFavorite}`
    });
  } catch (err) {
    (req as any).log?.error({ err }, 'Failed to set favorite');
    res.status(500).json({ error: 'Failed to set favorite' });
  }
});

export default router;
