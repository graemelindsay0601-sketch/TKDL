/**
 * Card Clash Practice Mode API Routes
 * 
 * Endpoints:
 * - POST /api/card-clash/practice/create - Create practice match
 * - GET /api/card-clash/practice/bots - List bot opponents
 * - POST /api/card-clash/practice/:matchId/complete - End practice match
 * - GET /api/card-clash/practice/history/:playerId - Get practice history
 * 
 * Practice matches:
 * - Don't affect player ranking
 * - Can use ANY cards from collection
 * - Award lower coin rewards (50% of ranked)
 * - Have separate tracking
 */

import { Router, Request, Response } from 'express';

const router = Router();

// Bot opponent definitions
const BOTS = [
  {
    id: 'bot_easy',
    name: 'Training Bot',
    difficulty: 'Easy',
    description: 'Perfect for learning the basics',
    avatar: '🤖',
    skillLevel: 1,
  },
  {
    id: 'bot_medium',
    name: 'Sparring Partner',
    difficulty: 'Medium',
    description: 'Solid opponent for practice',
    avatar: '🎯',
    skillLevel: 5,
  },
  {
    id: 'bot_pro',
    name: 'Pro Challenge',
    difficulty: 'Hard',
    description: 'High-level AI training',
    avatar: '⭐',
    skillLevel: 9,
  },
];

/**
 * GET /api/card-clash/practice/bots
 * List available bot opponents
 */
router.get('/card-clash/practice/bots', (req: Request, res: Response) => {
  res.json({ bots: BOTS });
});

/**
 * POST /api/card-clash/practice/create
 * Create a new practice match
 */
router.post('/card-clash/practice/create', async (req: Request, res: Response) => {
  try {
    const {
      playerId,
      opponentId, // player ID or 'bot_easy', 'bot_medium', 'bot_pro'
      selectedCards, // Array of card IDs (not equipped cards)
      gameType, // 'X01' or 'CRICKET'
    } = req.body;

    // Validation
    if (!playerId || !opponentId || !selectedCards || selectedCards.length !== 4 || !gameType) {
      res.status(400).json({ error: 'Invalid practice match parameters' });
      return;
    }

    // Determine if opponent is a bot
    const isBotOpponent = opponentId.startsWith('bot_');
    const bot = isBotOpponent ? BOTS.find((b) => b.id === opponentId) : null;

    if (isBotOpponent && !bot) {
      res.status(400).json({ error: 'Invalid bot opponent' });
      return;
    }

    // Create practice match
    const match = await req.app.locals.db('card_clash_matches').insert({
      player_1_id: playerId,
      player_2_id: isBotOpponent ? null : parseInt(opponentId, 10), // NULL for bots
      game_type: gameType,
      status: 'active',
      is_practice: true, // Mark as practice
      opponent_type: isBotOpponent ? opponentId : 'player', // Store which bot or 'player'
      reward_multiplier: 0.5, // Practice gets 50% rewards
      created_at: new Date(),
      practice_notes: isBotOpponent ? `Practice vs ${bot.name}` : 'Practice vs Player',
    });

    // Store selected cards for this practice match
    for (const cardId of selectedCards) {
      await req.app.locals.db('card_clash_match_cards').insert({
        match_id: match[0],
        card_id: cardId,
        equipped_by: playerId,
      });
    }

    res.json({
      success: true,
      matchId: match[0],
      opponent: isBotOpponent
        ? { type: 'bot', bot }
        : { type: 'player', playerId: opponentId },
      gameType,
      cardsSelected: selectedCards.length,
      rewardMultiplier: 0.5,
      message: 'Practice match created successfully',
    });
  } catch (err) {
    req.log.error({ err }, 'Failed to create practice match');
    res.status(500).json({ error: 'Failed to create practice match' });
  }
});

/**
 * POST /api/card-clash/practice/:matchId/complete
 * Complete a practice match
 */
router.post('/card-clash/practice/:matchId/complete', async (req: Request, res: Response) => {
  try {
    const matchId = parseInt(req.params.matchId, 10);
    const { winnerId, coinReward, cardsUsed } = req.body;

    if (isNaN(matchId) || !winnerId) {
      res.status(400).json({ error: 'Invalid match ID or winner' });
      return;
    }

    const match = await req.app.locals
      .db('card_clash_matches')
      .where({ id: matchId })
      .first();

    if (!match || !match.is_practice) {
      res.status(404).json({ error: 'Practice match not found' });
      return;
    }

    // Calculate rewards (50% of normal)
    const practiceCoins = Math.floor(coinReward * match.reward_multiplier);

    // Update match result
    await req.app.locals.db('card_clash_matches')
      .where({ id: matchId })
      .update({
        winner_id: winnerId,
        status: 'completed',
        updated_at: new Date(),
        practice_notes: `Practice match completed. ${winnerId === match.player_1_id ? 'Player 1' : 'Player 2'} won.`,
      });

    // Award coins (only to player, not tracked in ranking)
    await req.app.locals.db('player_coins').insert({
      player_id: winnerId,
      amount: practiceCoins,
      source: 'card_clash_practice',
      description: 'Practice match victory',
      created_at: new Date(),
    });

    res.json({
      success: true,
      matchId,
      winner: winnerId,
      coinsAwarded: practiceCoins,
      message: `Practice complete! Earned ${practiceCoins} coins`,
    });
  } catch (err) {
    req.log.error({ err }, 'Failed to complete practice match');
    res.status(500).json({ error: 'Failed to complete practice match' });
  }
});

/**
 * GET /api/card-clash/practice/history/:playerId
 * Get player's practice match history (doesn't affect ranking)
 */
router.get('/card-clash/practice/history/:playerId', async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId, 10);

    if (isNaN(playerId)) {
      res.status(400).json({ error: 'Invalid player ID' });
      return;
    }

    const history = await req.app.locals
      .db('card_clash_matches')
      .where('is_practice', true)
      .where((builder: any) => {
        builder.where('player_1_id', playerId).orWhere('player_2_id', playerId);
      })
      .orderBy('created_at', 'desc')
      .limit(20);

    // Calculate stats
    const stats = {
      totalPractice: history.length,
      wins: history.filter((m: any) => m.winner_id === playerId).length,
      losses: history.filter((m: any) => m.winner_id !== playerId && m.status === 'completed').length,
      winRate: history.length > 0
        ? Math.round((history.filter((m: any) => m.winner_id === playerId).length / history.length) * 100)
        : 0,
    };

    res.json({
      stats,
      history: history.map((m: any) => ({
        id: m.id,
        opponent: m.opponent_type === 'player' ? `Player ${m.player_2_id}` : m.opponent_type,
        gameType: m.game_type,
        result: m.winner_id === playerId ? 'WIN' : 'LOSS',
        date: m.created_at,
        notes: m.practice_notes,
      })),
    });
  } catch (err) {
    req.log.error({ err }, 'Failed to get practice history');
    res.status(500).json({ error: 'Failed to get practice history' });
  }
});

export default router;
