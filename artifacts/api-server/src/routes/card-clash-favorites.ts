/**
 * Card Clash Favorites Routes
 *
 * Per-player, server-persisted favorite cards for the Card Clash equip screen.
 * Replaces the old localStorage-based favorites, which were shared by whichever
 * browser/device the match was played on (so Player 2 would see Player 1's
 * favorites when equipping on the same device).
 *
 * Endpoints:
 * - GET  /api/card-clash/favorites/:playerId?gameMode=X01 - List a player's favorites
 * - POST /api/card-clash/favorites/:playerId - Add a favorite { cardId, cardName, gameMode }
 * - DELETE /api/card-clash/favorites/:playerId/:cardId?gameMode=X01 - Remove a favorite
 */

import { Router, Request, Response } from 'express';
import { db } from '@workspace/db';
import { and, eq } from 'drizzle-orm';
import { cardClashFavoritesTable, type CardClashFavorite } from '@workspace/db/schema';
import { paramStr } from '../lib/http';

const router = Router();
const MAX_FAVORITES_PER_MODE = 20;

function normalizeGameMode(value: unknown): 'X01' | 'CRICKET' {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'CRICKET' ? 'CRICKET' : 'X01';
}

/**
 * GET /api/card-clash/favorites/:playerId
 */
router.get('/card-clash/favorites/:playerId', async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(paramStr(req.params.playerId), 10);
    if (!Number.isFinite(playerId)) {
      res.status(400).json({ error: 'Invalid playerId' });
      return;
    }
    const gameMode = normalizeGameMode(req.query.gameMode);

    const rows = await db
      .select()
      .from(cardClashFavoritesTable)
      .where(
        and(
          eq(cardClashFavoritesTable.playerId, playerId),
          eq(cardClashFavoritesTable.gameMode, gameMode),
        ),
      );

    res.json({
      favorites: rows.map((r: CardClashFavorite) => ({
        id: String(r.id),
        cardId: r.cardId,
        cardName: r.cardName ?? '',
        gameMode: r.gameMode,
        addedAt: r.addedAt.toISOString(),
      })),
    });
  } catch (err) {
    (req as any).log?.error({ err }, 'Failed to load card clash favorites');
    res.status(500).json({ error: 'Failed to load favorites' });
  }
});

/**
 * POST /api/card-clash/favorites/:playerId
 * Body: { cardId: string, cardName?: string, gameMode?: "X01" | "CRICKET" }
 */
router.post('/card-clash/favorites/:playerId', async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(paramStr(req.params.playerId), 10);
    if (!Number.isFinite(playerId)) {
      res.status(400).json({ error: 'Invalid playerId' });
      return;
    }

    const { cardId, cardName } = req.body ?? {};
    if (typeof cardId !== 'string' || !cardId) {
      res.status(400).json({ error: 'cardId is required' });
      return;
    }
    const gameMode = normalizeGameMode(req.body?.gameMode);

    const existing = await db
      .select()
      .from(cardClashFavoritesTable)
      .where(
        and(
          eq(cardClashFavoritesTable.playerId, playerId),
          eq(cardClashFavoritesTable.gameMode, gameMode),
        ),
      );

    if (existing.some((f: CardClashFavorite) => f.cardId === cardId)) {
      res.json({ success: true, alreadyFavorited: true });
      return;
    }

    if (existing.length >= MAX_FAVORITES_PER_MODE) {
      res.status(400).json({ error: `Maximum ${MAX_FAVORITES_PER_MODE} favorites per game mode` });
      return;
    }

    await db.insert(cardClashFavoritesTable).values({
      playerId,
      cardId,
      cardName: typeof cardName === 'string' ? cardName : null,
      gameMode,
    });

    res.json({ success: true });
  } catch (err) {
    (req as any).log?.error({ err }, 'Failed to add card clash favorite');
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

/**
 * DELETE /api/card-clash/favorites/:playerId/:cardId
 */
router.delete('/card-clash/favorites/:playerId/:cardId', async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(paramStr(req.params.playerId), 10);
    if (!Number.isFinite(playerId)) {
      res.status(400).json({ error: 'Invalid playerId' });
      return;
    }
    const cardId = paramStr(req.params.cardId);
    const gameMode = normalizeGameMode(req.query.gameMode);

    await db
      .delete(cardClashFavoritesTable)
      .where(
        and(
          eq(cardClashFavoritesTable.playerId, playerId),
          eq(cardClashFavoritesTable.cardId, cardId),
          eq(cardClashFavoritesTable.gameMode, gameMode),
        ),
      );

    res.json({ success: true });
  } catch (err) {
    (req as any).log?.error({ err }, 'Failed to remove card clash favorite');
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

export default router;
