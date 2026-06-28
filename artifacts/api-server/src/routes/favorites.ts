/**
 * Card Favorites API Routes
 * Complete implementation for Card Clash quick card selection
 * 
 * Features:
 * - Session-based authentication
 * - Game mode specific (X01 vs CRICKET)
 * - Max 20 favorites per game mode
 * - Persistent across sessions
 * - Proper error handling and validation
 */

import { Router, Request, Response } from 'express';
import { db } from '@workspace/db';
import { cardFavorites } from '@workspace/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '../lib/logger';

const router = Router();

// ────────────────────────────────────────────────────────────────────────
// MIDDLEWARE & HELPERS
// ────────────────────────────────────────────────────────────────────────

/**
 * Get player ID from session
 */
function getPlayerId(req: any): number | null {
  return (req.session as any)?.playerId ?? null;
}

/**
 * Require authentication - returns player ID or sends 401
 */
function requireAuth(req: Request, res: Response): number | false {
  const playerId = getPlayerId(req);
  if (!playerId) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  return playerId;
}

/**
 * Validate game mode
 */
function isValidGameMode(mode: any): mode is "X01" | "CRICKET" {
  return mode === "X01" || mode === "CRICKET";
}

// ────────────────────────────────────────────────────────────────────────
// ENDPOINTS
// ────────────────────────────────────────────────────────────────────────

/**
 * GET /api/card-favorites
 * Get all favorite cards for current player
 * 
 * Query params:
 *   gameMode: "X01" | "CRICKET" (default: X01)
 */
router.get("/card-favorites", async (req: Request, res: Response): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  const gameMode = (req.query.gameMode as string) || "X01";

  if (!isValidGameMode(gameMode)) {
    res.status(400).json({ error: "Invalid game mode" });
    return;
  }

  try {
    const favorites = await db
      .select({
        id: cardFavorites.id,
        cardId: cardFavorites.card_id,
        cardName: cardFavorites.card_name,
        gameMode: cardFavorites.game_mode,
        addedAt: cardFavorites.added_at,
      })
      .from(cardFavorites)
      .where(
        and(
          eq(cardFavorites.player_id, playerId),
          eq(cardFavorites.game_mode, gameMode)
        )
      )
      .orderBy(cardFavorites.added_at);

    logger.info(
      { playerId, gameMode, count: favorites.length },
      "Favorites retrieved"
    );

    res.json({
      ok: true,
      favorites,
      count: favorites.length,
    });
  } catch (err: any) {
    logger.error({ err, playerId, gameMode }, "Failed to get favorites");
    res.status(500).json({ error: "Failed to retrieve favorites" });
  }
});

/**
 * POST /api/card-favorites
 * Add a card to favorites
 * 
 * Body:
 *   cardId: string (required)
 *   cardName: string (required)
 *   gameMode: "X01" | "CRICKET" (required)
 */
router.post("/card-favorites", async (req: Request, res: Response): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  const FavoriteSchema = z.object({
    cardId: z.string().min(1).max(50),
    cardName: z.string().min(1).max(100),
    gameMode: z.enum(["X01", "CRICKET"]),
  });

  const parsed = FavoriteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ 
      error: "Invalid input",
      details: parsed.error.message 
    });
    return;
  }

  try {
    const { cardId, cardName, gameMode } = parsed.data;

    // Check max 20 favorites per game mode
    const existing = await db
      .select({ count: cardFavorites.id })
      .from(cardFavorites)
      .where(
        and(
          eq(cardFavorites.player_id, playerId),
          eq(cardFavorites.game_mode, gameMode)
        )
      );

    if (existing.length >= 20) {
      res.status(400).json({
        error: "Maximum 20 favorites per game mode. Remove one before adding another.",
        limit: 20,
        current: existing.length,
      });
      return;
    }

    // Try to insert (will fail silently if duplicate due to unique constraint)
    const result = await db
      .insert(cardFavorites)
      .values({
        player_id: playerId,
        card_id: cardId,
        card_name: cardName,
        game_mode: gameMode,
      })
      .onConflictDoNothing()
      .returning();

    if (result.length === 0) {
      // Already exists
      res.status(409).json({
        error: "Card already in favorites",
        cardId,
        gameMode,
      });
      return;
    }

    logger.info(
      { playerId, cardId, cardName, gameMode },
      "Card added to favorites"
    );

    res.json({
      ok: true,
      favorite: {
        id: result[0].id,
        cardId: result[0].card_id,
        cardName: result[0].card_name,
        gameMode: result[0].game_mode,
        addedAt: result[0].added_at,
      },
    });
  } catch (err: any) {
    logger.error({ err, playerId, body: req.body }, "Failed to add favorite");
    res.status(500).json({ error: "Failed to add favorite" });
  }
});

/**
 * DELETE /api/card-favorites/:cardId
 * Remove a card from favorites
 * 
 * Query params:
 *   gameMode: "X01" | "CRICKET" (default: X01)
 */
router.delete("/card-favorites/:cardId", async (req: Request, res: Response): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  const gameMode = (req.query.gameMode as string) || "X01";
  const cardId = req.params.cardId;

  if (!isValidGameMode(gameMode)) {
    res.status(400).json({ error: "Invalid game mode" });
    return;
  }

  try {
    const result = await db
      .delete(cardFavorites)
      .where(
        and(
          eq(cardFavorites.player_id, playerId),
          eq(cardFavorites.card_id, cardId),
          eq(cardFavorites.game_mode, gameMode)
        )
      )
      .returning();

    if (result.length === 0) {
      res.status(404).json({
        error: "Favorite not found",
        cardId,
        gameMode,
      });
      return;
    }

    logger.info(
      { playerId, cardId, gameMode },
      "Card removed from favorites"
    );

    res.json({ ok: true, removed: cardId });
  } catch (err: any) {
    logger.error({ err, playerId, cardId, gameMode }, "Failed to remove favorite");
    res.status(500).json({ error: "Failed to remove favorite" });
  }
});

/**
 * DELETE /api/card-favorites
 * Clear all favorites for a game mode
 * 
 * Query params:
 *   gameMode: "X01" | "CRICKET" (default: X01)
 */
router.delete("/card-favorites", async (req: Request, res: Response): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  const gameMode = (req.query.gameMode as string) || "X01";

  if (!isValidGameMode(gameMode)) {
    res.status(400).json({ error: "Invalid game mode" });
    return;
  }

  try {
    const result = await db
      .delete(cardFavorites)
      .where(
        and(
          eq(cardFavorites.player_id, playerId),
          eq(cardFavorites.game_mode, gameMode)
        )
      )
      .returning();

    logger.info(
      { playerId, gameMode, cleared: result.length },
      "All favorites cleared"
    );

    res.json({
      ok: true,
      cleared: result.length,
      gameMode,
    });
  } catch (err: any) {
    logger.error({ err, playerId, gameMode }, "Failed to clear favorites");
    res.status(500).json({ error: "Failed to clear favorites" });
  }
});

/**
 * Inventory Favorites - Legacy support
 * Kept for backwards compatibility with existing card inventory system
 */

/**
 * GET /api/player/:playerId/cards/favorites
 * Get all favorite cards for a player (from inventory)
 */
router.get("/player/:playerId/cards/favorites", async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId, 10);
    if (isNaN(playerId)) {
      res.status(400).json({ error: "Invalid player ID" });
      return;
    }

    // Return empty - Card Clash uses dedicated favorites table
    res.json({ favorites: [], count: 0 });
  } catch (err) {
    logger.error({ err }, "Failed to get inventory favorites");
    res.status(500).json({ error: "Failed to get favorites" });
  }
});

/**
 * POST /api/cards/:cardId/favorite
 * Toggle favorite status for a card (legacy - kept for compatibility)
 */
router.post("/cards/:cardId/favorite", async (req: Request, res: Response) => {
  res.status(501).json({
    error: "This endpoint is deprecated. Use POST /api/card-favorites instead.",
  });
});

/**
 * PUT /api/cards/:cardId/favorite
 * Set favorite status explicitly (legacy - kept for compatibility)
 */
router.put("/cards/:cardId/favorite", async (req: Request, res: Response) => {
  res.status(501).json({
    error: "This endpoint is deprecated. Use POST /api/card-favorites instead.",
  });
});

export default router;
