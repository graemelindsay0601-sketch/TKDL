import { db } from "@workspace/db";
import { cardDefinitionsTable, cardInventoryTable, cardPityTable, playerCurrencyTable, cardClashMatchesTable, cardClashSeasonsTable, cardClashStandingsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Initialize all card-related tables if they don't exist
 * This ensures the card definitions and related tables are created on first run
 */
export async function initializeCardTables() {
  try {
    logger.info("Initializing card tables...");

    // Create feature_flags table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS feature_flags (
        id SERIAL PRIMARY KEY,
        feature_name TEXT UNIQUE NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT false,
        admin_test_mode BOOLEAN NOT NULL DEFAULT false,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create card_definitions table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS card_definitions (
        id SERIAL PRIMARY KEY,
        card_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        game_mode TEXT NOT NULL,
        card_type TEXT NOT NULL,
        rarity TEXT NOT NULL,
        effect TEXT NOT NULL,
        image_url TEXT,
        enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create card_inventory table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS card_inventory (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        card_id UUID NOT NULL REFERENCES card_definitions(card_id) ON DELETE CASCADE,
        quantity_owned INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(player_id, card_id)
      )
    `);

    // Create card_pity table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS card_pity (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        pulls_since_legendary INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(player_id)
      )
    `);

    // Create player_currency table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS player_currency (
        id SERIAL PRIMARY KEY,
        player_id INTEGER UNIQUE NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        coin_balance INTEGER NOT NULL DEFAULT 0,
        lifetime_coins_earned INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create card_clash_seasons table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS card_clash_seasons (
        id SERIAL PRIMARY KEY,
        season_number INTEGER NOT NULL UNIQUE,
        start_date TIMESTAMP WITH TIME ZONE NOT NULL,
        end_date TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create card_clash_matches table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS card_clash_matches (
        id SERIAL PRIMARY KEY,
        season_id INTEGER NOT NULL REFERENCES card_clash_seasons(id) ON DELETE CASCADE,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        opponent_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
        game_mode TEXT NOT NULL,
        result TEXT,
        cards_used TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create notifications table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT,
        data JSONB,
        read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create card_clash_standings table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS card_clash_standings (
        id SERIAL PRIMARY KEY,
        season_id INTEGER NOT NULL REFERENCES card_clash_seasons(id) ON DELETE CASCADE,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(season_id, player_id)
      )
    `);

    // Create indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_card_inventory_player ON card_inventory(player_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_card_inventory_card ON card_inventory(card_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_card_pity_player ON card_pity(player_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_player_currency_player ON player_currency(player_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_card_clash_matches_player ON card_clash_matches(player_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_card_clash_matches_season ON card_clash_matches(season_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_card_clash_standings_season ON card_clash_standings(season_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_card_clash_standings_player ON card_clash_standings(player_id)`);

    logger.info("Card tables initialized successfully");
  } catch (error) {
    logger.error({ error }, "Failed to initialize card tables");
    throw error;
  }
}

/**
 * Seed initial currency for a player if they don't have it
 */
export async function ensurePlayerCurrency(playerId: number) {
  try {
    // Check if player already has currency record
    const existing = await db.execute(sql`
      SELECT id FROM player_currency WHERE player_id = ${playerId}
    `);

    if (existing.rows.length === 0) {
      // Create new currency record with 0 starting coins
      await db.execute(sql`
        INSERT INTO player_currency (player_id, coin_balance, lifetime_coins_earned) 
        VALUES (${playerId}, 0, 0)
        ON CONFLICT (player_id) DO NOTHING
      `);
    }
  } catch (error) {
    logger.error({ error, playerId }, "Failed to ensure player currency");
    // Don't throw - this is not critical for app startup
  }
}

/**
 * Initialize default feature flags if they don't exist
 */
export async function initializeFeatureFlags() {
  try {
    logger.info("Initializing feature flags...");

    const flags = [
      { featureName: "card_shop", description: "Card Shop - Pack purchases and card collection" },
      { featureName: "coins", description: "Coin earning system - Rewards for matches and challenges" },
      { featureName: "card_clash", description: "Card Clash game mode with card collecting, packs, and seasons" },
    ];

    for (const flag of flags) {
      await db.execute(sql`
        INSERT INTO feature_flags (feature_name, enabled, admin_test_mode, description)
        VALUES (${flag.featureName}, false, false, ${flag.description})
        ON CONFLICT (feature_name) DO NOTHING
      `);
    }

    logger.info("Feature flags initialized successfully");
  } catch (error) {
    logger.error({ error }, "Failed to initialize feature flags");
    // Don't throw - this is not critical
  }
}
