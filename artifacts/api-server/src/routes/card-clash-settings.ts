/**
 * Card Clash Settings Routes
 * 
 * Manage game configuration:
 * - Equipable card counts (1-5 GOOD, 1-5 BAD)
 * - Feature toggles
 * - Game parameters
 * 
 * Endpoints:
 * - GET /api/card-clash/settings - Get current settings
 * - PUT /api/card-clash/settings - Update settings (admin only)
 * - GET /api/card-clash/settings/history - Audit log
 */

import { Router, Request, Response } from 'express';

// Default settings
const DEFAULT_SETTINGS = {
  equipable_good_cards: 2,
  equipable_bad_cards: 2,
  card_clash_enabled: true,
  practice_mode_enabled: true,
  practice_reward_multiplier: 0.5,
  min_cards_per_type: 1,
  max_cards_per_type: 5,
  updated_at: new Date(),
  updated_by: null,
};

const router = Router();

/**
 * GET /api/card-clash/settings
 * Get current game settings (public)
 */
router.get('/card-clash/settings', async (req: Request, res: Response) => {
  try {
    // Try to get from settings table, otherwise return defaults
    let settings = await req.app.locals
      .db('card_clash_settings')
      .where({ id: 1 })
      .first();

    if (!settings) {
      settings = DEFAULT_SETTINGS;
    }

    res.json({
      settings: {
        equipable_good_cards: settings.equipable_good_cards,
        equipable_bad_cards: settings.equipable_bad_cards,
        card_clash_enabled: settings.card_clash_enabled,
        practice_mode_enabled: settings.practice_mode_enabled,
        practice_reward_multiplier: settings.practice_reward_multiplier,
        min_cards_per_type: settings.min_cards_per_type,
        max_cards_per_type: settings.max_cards_per_type,
      },
    });
  } catch (err) {
    req.log.error({ err }, 'Failed to get settings');
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

/**
 * PUT /api/card-clash/settings
 * Update game settings (admin only)
 */
router.put('/card-clash/settings', async (req: Request, res: Response) => {
  try {
    // Check admin permission
    const userId = (req as any).user?.id;
    const adminPin = req.body.adminPin || req.headers['x-admin-pin'];

    if (!adminPin || adminPin !== process.env.ADMIN_PIN) {
      res.status(403).json({ error: 'Unauthorized - invalid admin PIN' });
      return;
    }

    const {
      equipable_good_cards,
      equipable_bad_cards,
      card_clash_enabled,
      practice_mode_enabled,
      practice_reward_multiplier,
    } = req.body;

    // Validation
    if (
      typeof equipable_good_cards !== 'number' ||
      typeof equipable_bad_cards !== 'number'
    ) {
      res.status(400).json({ error: 'equipable_good_cards and equipable_bad_cards must be numbers' });
      return;
    }

    if (
      equipable_good_cards < 1 || equipable_good_cards > 5 ||
      equipable_bad_cards < 1 || equipable_bad_cards > 5
    ) {
      res.status(400).json({ error: 'Card counts must be between 1 and 5' });
      return;
    }

    // Update or create settings
    const existingSettings = await req.app.locals
      .db('card_clash_settings')
      .where({ id: 1 })
      .first();

    const updateData = {
      equipable_good_cards: Math.floor(equipable_good_cards),
      equipable_bad_cards: Math.floor(equipable_bad_cards),
      card_clash_enabled: typeof card_clash_enabled === 'boolean' ? card_clash_enabled : true,
      practice_mode_enabled: typeof practice_mode_enabled === 'boolean' ? practice_mode_enabled : true,
      practice_reward_multiplier: typeof practice_reward_multiplier === 'number' ? practice_reward_multiplier : 0.5,
      updated_at: new Date(),
      updated_by: userId,
    };

    if (existingSettings) {
      await req.app.locals
        .db('card_clash_settings')
        .where({ id: 1 })
        .update(updateData);
    } else {
      await req.app.locals.db('card_clash_settings').insert({
        id: 1,
        ...updateData,
      });
    }

    // Log change
    await req.app.locals.db('card_clash_settings_audit').insert({
      changed_by: userId,
      change_type: 'settings_update',
      old_good_cards: existingSettings?.equipable_good_cards || DEFAULT_SETTINGS.equipable_good_cards,
      new_good_cards: equipable_good_cards,
      old_bad_cards: existingSettings?.equipable_bad_cards || DEFAULT_SETTINGS.equipable_bad_cards,
      new_bad_cards: equipable_bad_cards,
      changed_at: new Date(),
      notes: req.body.notes || null,
    }).catch(() => {
      // Audit log failure shouldn't break the update
    });

    res.json({
      success: true,
      settings: updateData,
      message: `Settings updated: ${equipable_good_cards} GOOD, ${equipable_bad_cards} BAD cards per game`,
    });
  } catch (err) {
    req.log.error({ err }, 'Failed to update settings');
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * GET /api/card-clash/settings/history
 * Get audit log of setting changes (admin only)
 */
router.get('/card-clash/settings/history', async (req: Request, res: Response) => {
  try {
    // Check admin permission
    const adminPin = req.headers['x-admin-pin'];

    if (!adminPin || adminPin !== process.env.ADMIN_PIN) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const history = await req.app.locals
      .db('card_clash_settings_audit')
      .orderBy('changed_at', 'desc')
      .limit(20);

    res.json({
      history: history.map((entry: any) => ({
        id: entry.id,
        changed_by: entry.changed_by,
        timestamp: entry.changed_at,
        old_good_cards: entry.old_good_cards,
        new_good_cards: entry.new_good_cards,
        old_bad_cards: entry.old_bad_cards,
        new_bad_cards: entry.new_bad_cards,
        notes: entry.notes,
      })),
    });
  } catch (err) {
    req.log.error({ err }, 'Failed to get settings history');
    res.status(500).json({ error: 'Failed to get settings history' });
  }
});

export default router;
