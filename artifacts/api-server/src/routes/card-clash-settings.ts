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
import { db } from '@workspace/db';
import { sql, eq } from 'drizzle-orm';
import { cardClashPlayerSettingsTable } from '@workspace/db/schema';
import { requireAdminSession } from '../middleware/requireAdminSession';
import { paramStr } from '../lib/http';

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
 * Shared helper: read the global Card Clash settings row, falling back to
 * DEFAULT_SETTINGS if the table/row doesn't exist. Used both by the public
 * GET /settings endpoint and as the fallback for players who haven't set
 * their own per-player equipment preference yet.
 */
async function getGlobalCardClashSettings(): Promise<typeof DEFAULT_SETTINGS> {
  try {
    const { rows: [settings] } = await db.execute(sql`
      SELECT
        equipable_good_cards,
        equipable_bad_cards,
        card_clash_enabled,
        practice_mode_enabled,
        practice_reward_multiplier,
        min_cards_per_type,
        max_cards_per_type
      FROM card_clash_settings
      WHERE id = 1
      LIMIT 1
    `);

    if (settings) {
      return {
        ...DEFAULT_SETTINGS,
        equipable_good_cards: (settings as any).equipable_good_cards,
        equipable_bad_cards: (settings as any).equipable_bad_cards,
        card_clash_enabled: (settings as any).card_clash_enabled,
        practice_mode_enabled: (settings as any).practice_mode_enabled,
        practice_reward_multiplier: (settings as any).practice_reward_multiplier,
        min_cards_per_type: (settings as any).min_cards_per_type,
        max_cards_per_type: (settings as any).max_cards_per_type,
      };
    }
  } catch (dbErr) {
    // Table not available yet — fall back to defaults below
  }
  return DEFAULT_SETTINGS;
}

/**
 * GET /api/card-clash/settings
 * Get current game settings (public)
 */
router.get('/card-clash/settings', async (req: Request, res: Response) => {
  try {
    const settings = await getGlobalCardClashSettings();
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
    (req as any).log?.error({ err }, 'Failed to get settings');
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

/**
 * PUT /api/card-clash/settings
 * Update game settings (admin only)
 */
router.put('/card-clash/settings', requireAdminSession, async (req: Request, res: Response) => {
  try {
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

    // Get existing settings for audit log
    const { rows: [existingSettings] } = await db.execute(sql`
      SELECT equipable_good_cards, equipable_bad_cards FROM card_clash_settings WHERE id = 1
    `);

    const updateData = {
      equipable_good_cards: Math.floor(equipable_good_cards),
      equipable_bad_cards: Math.floor(equipable_bad_cards),
      card_clash_enabled: typeof card_clash_enabled === 'boolean' ? card_clash_enabled : true,
      practice_mode_enabled: typeof practice_mode_enabled === 'boolean' ? practice_mode_enabled : true,
      practice_reward_multiplier: typeof practice_reward_multiplier === 'number' ? practice_reward_multiplier : 0.5,
      updated_at: new Date(),
    };

    if (existingSettings) {
      await db.execute(sql`
        UPDATE card_clash_settings SET
          equipable_good_cards = ${updateData.equipable_good_cards},
          equipable_bad_cards = ${updateData.equipable_bad_cards},
          card_clash_enabled = ${updateData.card_clash_enabled},
          practice_mode_enabled = ${updateData.practice_mode_enabled},
          practice_reward_multiplier = ${updateData.practice_reward_multiplier},
          updated_at = ${updateData.updated_at}
        WHERE id = 1
      `);
    } else {
      await db.execute(sql`
        INSERT INTO card_clash_settings (
          id, equipable_good_cards, equipable_bad_cards, card_clash_enabled,
          practice_mode_enabled, practice_reward_multiplier, updated_at
        ) VALUES (
          1, ${updateData.equipable_good_cards}, ${updateData.equipable_bad_cards},
          ${updateData.card_clash_enabled}, ${updateData.practice_mode_enabled},
          ${updateData.practice_reward_multiplier}, ${updateData.updated_at}
        )
      `);
    }

    // Log change (best-effort, don't fail if audit table doesn't exist)
    try {
      await db.execute(sql`
        INSERT INTO card_clash_settings_audit (
          changed_by, change_type, old_good_cards, new_good_cards,
          old_bad_cards, new_bad_cards, changed_at, notes
        ) VALUES (
          null, 'settings_update',
          ${(existingSettings as any)?.equipable_good_cards || DEFAULT_SETTINGS.equipable_good_cards},
          ${equipable_good_cards},
          ${(existingSettings as any)?.equipable_bad_cards || DEFAULT_SETTINGS.equipable_bad_cards},
          ${equipable_bad_cards},
          ${new Date()},
          ${req.body.notes || null}
        )
      `);
    } catch (auditErr) {
      // Audit log failure shouldn't break the update
      (req as any).log?.warn({ auditErr }, 'Failed to log settings change');
    }

    // Reset all per-player equipment overrides so the new admin default
    // actually takes effect for everyone. Without this, any player who
    // previously saved a preference (e.g. via the gear icon on the equip
    // screen) would keep using their old stored value forever, silently
    // overriding this admin change.
    let playersReset = 0;
    try {
      const deleted = await db.delete(cardClashPlayerSettingsTable).returning({ playerId: cardClashPlayerSettingsTable.playerId });
      playersReset = deleted.length;
    } catch (resetErr) {
      (req as any).log?.warn({ resetErr }, 'Failed to reset per-player equipment overrides');
    }

    res.json({
      success: true,
      settings: updateData,
      playersReset,
      message: `Settings updated: ${equipable_good_cards} GOOD, ${equipable_bad_cards} BAD cards per game${playersReset > 0 ? ` (reset ${playersReset} player override${playersReset === 1 ? '' : 's'})` : ''}`,
    });
  } catch (err) {
    (req as any).log?.error({ err }, 'Failed to update settings');
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * GET /api/card-clash/settings/history
 * Get audit log of setting changes (admin only)
 */
router.get('/card-clash/settings/history', requireAdminSession, async (req: Request, res: Response) => {
  try {
    const history = await db.execute(sql`
      SELECT 
        id, changed_by, changed_at, old_good_cards, new_good_cards,
        old_bad_cards, new_bad_cards, notes
      FROM card_clash_settings_audit
      ORDER BY changed_at DESC
      LIMIT 20
    `);

    res.json({
      history: history.rows.map((entry: any) => ({
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
    (req as any).log?.error({ err }, 'Failed to get settings history');
    res.status(500).json({ error: 'Failed to get settings history' });
  }
});

/**
 * GET /api/card-clash/player/:playerId/equipment-preference
 * Get a player's card equipment preferences
 */
router.get('/card-clash/player/:playerId/equipment-preference', async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(paramStr(req.params.playerId), 10);

    const result = await db
      .select()
      .from(cardClashPlayerSettingsTable)
      .where(eq(cardClashPlayerSettingsTable.playerId, playerId));

    console.log(`[equipment-preference GET] playerId: ${playerId}, result length: ${result.length}, result:`, result);

    if (result.length === 0) {
      // No player-specific override yet — fall back to the admin's global
      // Card Clash settings (equipable_good_cards / equipable_bad_cards)
      // instead of a hardcoded value, so admin changes apply to everyone
      // who hasn't personally customized their own card count.
      const globalSettings = await getGlobalCardClashSettings();
      console.log(`[equipment-preference GET] No player override found, falling back to admin defaults:`, {
        goodCardsPerMatch: globalSettings.equipable_good_cards,
        badCardsPerMatch: globalSettings.equipable_bad_cards,
      });
      res.json({
        playerId,
        goodCardsPerMatch: globalSettings.equipable_good_cards,
        badCardsPerMatch: globalSettings.equipable_bad_cards,
      });
      return;
    }

    const settings = result[0];
    console.log(`[equipment-preference GET] Returning settings:`, { playerId, goodCardsPerMatch: settings.goodCardsPerMatch, badCardsPerMatch: settings.badCardsPerMatch });
    res.json({
      playerId,
      goodCardsPerMatch: settings.goodCardsPerMatch,
      badCardsPerMatch: settings.badCardsPerMatch,
    });
  } catch (err) {
    console.log(`[equipment-preference GET] ERROR:`, err);
    (req as any).log?.error({ err }, 'Failed to get player equipment preference');
    res.status(500).json({ error: 'Failed to get preference' });
  }
});

/**
 * POST /api/card-clash/player/:playerId/equipment-preference
 * Set a player's card equipment preferences
 */
router.post('/card-clash/player/:playerId/equipment-preference', async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(paramStr(req.params.playerId), 10);
    const { goodCardsPerMatch, badCardsPerMatch } = req.body;

    // Validation
    if (
      typeof goodCardsPerMatch !== 'number' ||
      typeof badCardsPerMatch !== 'number'
    ) {
      res.status(400).json({ error: 'goodCardsPerMatch and badCardsPerMatch must be numbers' });
      return;
    }

    if (
      goodCardsPerMatch < 1 || goodCardsPerMatch > 5 ||
      badCardsPerMatch < 1 || badCardsPerMatch > 5
    ) {
      res.status(400).json({ error: 'Card counts must be between 1 and 5' });
      return;
    }

    // Check if exists
    const existing = await db
      .select()
      .from(cardClashPlayerSettingsTable)
      .where(eq(cardClashPlayerSettingsTable.playerId, playerId));

    if (existing.length > 0) {
      // Update
      await db
        .update(cardClashPlayerSettingsTable)
        .set({
          goodCardsPerMatch: Math.floor(goodCardsPerMatch),
          badCardsPerMatch: Math.floor(badCardsPerMatch),
        })
        .where(eq(cardClashPlayerSettingsTable.playerId, playerId));
    } else {
      // Insert
      await db.insert(cardClashPlayerSettingsTable).values({
        playerId: playerId,
        goodCardsPerMatch: Math.floor(goodCardsPerMatch),
        badCardsPerMatch: Math.floor(badCardsPerMatch),
      });
    }

    res.json({
      success: true,
      playerId,
      goodCardsPerMatch: Math.floor(goodCardsPerMatch),
      badCardsPerMatch: Math.floor(badCardsPerMatch),
      message: `Equipment preference saved: ${goodCardsPerMatch} GOOD, ${badCardsPerMatch} BAD cards`,
    });
  } catch (err) {
    (req as any).log?.error({ err }, 'Failed to set player equipment preference');
    res.status(500).json({ error: 'Failed to save preference' });
  }
});



export default router;
