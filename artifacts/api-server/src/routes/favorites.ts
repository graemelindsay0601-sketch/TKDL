/**
 * Favorites API Routes
 * 
 * Endpoints for managing player card favorites
 * - POST /api/cards/:cardId/favorite - Toggle favorite status
 * - GET /api/player/:playerId/cards/favorites - Get all favorites
 * - PUT /api/cards/:cardId/favorite - Set favorite status explicitly
 */

import { Router, Request, Response } from 'express';

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
    const favorites = await req.app.locals.db('player_cards')
      .where({ player_id: playerId, is_favorite: true })
      .select('*');

    res.json({ favorites, count: favorites.length });
  } catch (err) {
    req.log.error({ err }, 'Failed to get favorites');
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
    const cardId = parseInt(req.params.cardId, 10);

    if (!playerId || isNaN(cardId)) {
      res.status(400).json({ error: 'Invalid player ID or card ID' });
      return;
    }

    // Get current favorite status
    const card = await req.app.locals.db('player_cards')
      .where({ player_id: playerId, id: cardId })
      .first();

    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }

    // Toggle the favorite status
    const newFavoriteStatus = !card.is_favorite;
    await req.app.locals.db('player_cards')
      .where({ player_id: playerId, id: cardId })
      .update({ is_favorite: newFavoriteStatus });

    res.json({
      success: true,
      cardId,
      isFavorite: newFavoriteStatus,
      message: newFavoriteStatus ? 'Card marked as favorite ⭐' : 'Favorite removed'
    });
  } catch (err) {
    req.log.error({ err }, 'Failed to toggle favorite');
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
    const cardId = parseInt(req.params.cardId, 10);

    if (!playerId || isNaN(cardId) || typeof isFavorite !== 'boolean') {
      res.status(400).json({ error: 'Invalid parameters' });
      return;
    }

    const card = await req.app.locals.db('player_cards')
      .where({ player_id: playerId, id: cardId })
      .first();

    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }

    await req.app.locals.db('player_cards')
      .where({ player_id: playerId, id: cardId })
      .update({ is_favorite: isFavorite });

    res.json({
      success: true,
      cardId,
      isFavorite,
      message: `Favorite status set to ${isFavorite}`
    });
  } catch (err) {
    req.log.error({ err }, 'Failed to set favorite');
    res.status(500).json({ error: 'Failed to set favorite' });
  }
});

export default router;
