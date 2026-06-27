/**
 * Migration: Add is_favorite column to player_card_inventory table
 * 
 * This enables players to mark cards as favorites, which will be sorted
 * to the top of the equip screen and collection views.
 */

import { db, sql } from '@workspace/db';
import { logger } from '../../lib/logger';

export async function addFavoritesColumn() {
  try {
    // Add is_favorite boolean column with default false if it doesn't exist
    await db.execute(sql`
      ALTER TABLE player_card_inventory
      ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false
    `);
    logger.info('✅ Added is_favorite column to player_card_inventory');
  } catch (err) {
    logger.error({ err }, '❌ Failed to add is_favorite column');
    throw err;
  }
}
