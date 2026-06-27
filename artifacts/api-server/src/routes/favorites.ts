/**
 * Favorites API Routes
 * 
 * Endpoints for managing player card favorites
 * - POST /api/cards/:cardId/favorite - Toggle favorite status
 * - GET /api/player/:playerId/cards/favorites - Get all favorites
 * - PUT /api/cards/:cardId/favorite - Set favorite status explicitly
 */

import { Router, Request, Response } from 'express';
import { db, cardInventoryTable, cardDefinitionsTable } from '@workspace/db';
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
 * cardId is the numeric ID from CardData (e.g., 101, 102)
 */
router.post('/cards/:cardId/favorite', async (req: Request, res: Response) => {
  try {
    const { playerId } = req.body;
    const cardNumId = parseInt(req.params.cardId, 10);

    console.log(`[POST /favorite] cardId: ${cardNumId}, playerId: ${playerId}`);

    if (!playerId || isNaN(cardNumId)) {
      res.status(400).json({ error: 'Invalid player ID or card ID' });
      return;
    }

    // First, get the UUID for this card from card_definitions using the numeric ID
    const [cardDef] = await db
      .select({ cardId: cardDefinitionsTable.cardId })
      .from(cardDefinitionsTable)
      .where(eq(cardDefinitionsTable.id, cardNumId));

    if (!cardDef) {
      console.log(`[POST /favorite] Card definition not found for id ${cardNumId}`);
      res.status(404).json({ error: 'Card not found in definitions' });
      return;
    }

    // Get current favorite status using the UUID
    const [card] = await db
      .select()
      .from(cardInventoryTable)
      .where(and(
        eq(cardInventoryTable.playerId, playerId),
        eq(cardInventoryTable.cardId, cardDef.cardId)
      ));

    if (!card) {
      console.log(`[POST /favorite] Card not in inventory for player ${playerId}, cardDef.cardId: ${cardDef.cardId}`);
      res.status(404).json({ error: 'Card not found in inventory' });
      return;
    }

    // Toggle the favorite status
    const newFavoriteStatus = !card.isFavorite;
    console.log(`[POST /favorite] Updating favorite status to ${newFavoriteStatus} for card ${cardNumId}, player ${playerId}`);
    await db
      .update(cardInventoryTable)
      .set({ isFavorite: newFavoriteStatus })
      .where(and(
        eq(cardInventoryTable.playerId, playerId),
        eq(cardInventoryTable.cardId, cardDef.cardId)
      ));

    console.log(`[POST /favorite] Success! New status: ${newFavoriteStatus}`);
    res.json({
      success: true,
      cardId: cardNumId,
      isFavorite: newFavoriteStatus,
      message: newFavoriteStatus ? 'Card marked as favorite ⭐' : 'Favorite removed'
    });
  } catch (err) {
    console.error(`[POST /favorite] ERROR:`, err);
    (req as any).log?.error({ err }, 'Failed to toggle favorite');
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

/**
 * PUT /api/cards/:cardId/favorite
 * Set favorite status explicitly
 * cardId is the numeric ID from CardData
 */
router.put('/cards/:cardId/favorite', async (req: Request, res: Response) => {
  try {
    const { playerId, isFavorite } = req.body;
    const cardNumId = parseInt(req.params.cardId, 10);

    if (!playerId || isNaN(cardNumId) || typeof isFavorite !== 'boolean') {
      res.status(400).json({ error: 'Invalid parameters' });
      return;
    }

    // First, get the UUID for this card from card_definitions using the numeric ID
    const [cardDef] = await db
      .select({ cardId: cardDefinitionsTable.cardId })
      .from(cardDefinitionsTable)
      .where(eq(cardDefinitionsTable.id, cardNumId));

    if (!cardDef) {
      res.status(404).json({ error: 'Card not found in definitions' });
      return;
    }

    const [card] = await db
      .select()
      .from(cardInventoryTable)
      .where(and(
        eq(cardInventoryTable.playerId, playerId),
        eq(cardInventoryTable.cardId, cardDef.cardId)
      ));

    if (!card) {
      res.status(404).json({ error: 'Card not found in inventory' });
      return;
    }

    await db
      .update(cardInventoryTable)
      .set({ isFavorite })
      .where(and(
        eq(cardInventoryTable.playerId, playerId),
        eq(cardInventoryTable.cardId, cardDef.cardId)
      ));

    res.json({
      success: true,
      cardId: cardNumId,
      isFavorite,
      message: `Favorite status set to ${isFavorite}`
    });
  } catch (err) {
    (req as any).log?.error({ err }, 'Failed to set favorite');
    res.status(500).json({ error: 'Failed to set favorite' });
  }
});

export default router;
