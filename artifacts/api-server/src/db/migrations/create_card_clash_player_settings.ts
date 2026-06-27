/**
 * Migration: Create card_clash_player_settings table
 * 
 * Stores per-player Card Clash equipment preferences:
 * - goodCardsPerMatch: Number of good cards to equip (1-5)
 * - badCardsPerMatch: Number of bad cards to equip (1-5)
 */

import { db } from '@workspace/db';
import { sql } from 'drizzle-orm';
import { logger } from '../../lib/logger';

export async function createCardClashPlayerSettingsTable() {
  try {
    // Create table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS card_clash_player_settings (
        player_id INTEGER NOT NULL PRIMARY KEY REFERENCES players(id),
        good_cards_per_match INTEGER NOT NULL DEFAULT 2,
        bad_cards_per_match INTEGER NOT NULL DEFAULT 2,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    logger.info('✅ Created card_clash_player_settings table');
  } catch (err) {
    logger.error({ err }, '❌ Failed to create card_clash_player_settings table');
    throw err;
  }
}
