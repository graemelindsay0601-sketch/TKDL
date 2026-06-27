import { db } from '@workspace/db';
import { sql } from 'drizzle-orm';

/**
 * Migration: Add coin and pack rewards to achievements table
 * Allows all achievements to grant coins and packs on unlock
 */
export async function addAchievementRewards() {
  try {
    console.log('[MIGRATION] Adding coin_reward and pack_reward columns to achievements table...');
    
    await db.execute(sql`
      ALTER TABLE achievements 
      ADD COLUMN IF NOT EXISTS coin_reward INTEGER NOT NULL DEFAULT 0
    `);
    
    await db.execute(sql`
      ALTER TABLE achievements 
      ADD COLUMN IF NOT EXISTS pack_reward TEXT
    `);
    
    console.log('[MIGRATION] Achievement rewards columns added successfully');
    return true;
  } catch (err) {
    console.error('[MIGRATION ERROR] Failed to add achievement rewards columns:', err);
    throw err;
  }
}
