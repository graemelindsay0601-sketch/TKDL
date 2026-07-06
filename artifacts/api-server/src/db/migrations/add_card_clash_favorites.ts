import { sql } from 'drizzle-orm';
import { db } from '@workspace/db';
import { logger } from '../../lib/logger';

export async function up() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS card_clash_favorites (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        card_id VARCHAR(50) NOT NULL,
        card_name VARCHAR(100),
        game_mode VARCHAR(20) NOT NULL DEFAULT 'X01',
        added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(player_id, card_id, game_mode)
      );
    `);

    // Create index for faster lookups
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_card_clash_favorites_player 
      ON card_clash_favorites(player_id, game_mode);
    `);
    logger.info('✅ Created card_clash_favorites table');
  } catch (err) {
    logger.error({ err }, '❌ Failed to create card_clash_favorites table');
    throw err;
  }
}

export async function down() {
  await db.execute(sql`DROP TABLE IF EXISTS card_clash_favorites CASCADE;`);
}
