import { sql } from "drizzle-orm";
import type { Database } from "./index";

/**
 * Migration: Create featured card shop tables
 * Adds tables for daily rotating featured cards and purchase tracking
 */
export async function migrateFeatureCardShop(db: Database) {
  console.log("[MIGRATION] Creating featured card shop tables...");

  try {
    // Create featured_card_shop table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS featured_card_shop (
        id SERIAL PRIMARY KEY,
        card_id INTEGER NOT NULL REFERENCES card_definitions(id),
        slot_number INTEGER NOT NULL,
        price_coins INTEGER NOT NULL,
        rotation_date TIMESTAMP WITH TIME ZONE NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index on rotation_date for efficient queries
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_featured_card_shop_rotation_date
      ON featured_card_shop(rotation_date)
    `);

    // Create index on is_active
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_featured_card_shop_is_active
      ON featured_card_shop(is_active)
    `);

    // Create shop_purchase_history table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS shop_purchase_history (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL REFERENCES players(id),
        card_id INTEGER NOT NULL REFERENCES card_definitions(id),
        slot_number INTEGER NOT NULL,
        price_coins INTEGER NOT NULL,
        purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for purchase history
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_shop_purchase_history_player_id
      ON shop_purchase_history(player_id)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_shop_purchase_history_purchased_at
      ON shop_purchase_history(purchased_at)
    `);

    console.log("[MIGRATION] ✅ Featured card shop tables created successfully");
  } catch (error) {
    console.error("[MIGRATION] ❌ Failed to create featured card shop tables:", error);
    throw error;
  }
}
