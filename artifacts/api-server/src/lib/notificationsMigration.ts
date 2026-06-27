/**
 * Push Notifications Database Migration
 * Run this during app initialization to set up notification tables
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

export async function seedNotificationTables() {
  try {
    // Notification preferences table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
        push_enabled BOOLEAN DEFAULT true,
        match_results BOOLEAN DEFAULT true,
        rank_changes BOOLEAN DEFAULT true,
        coach_tips BOOLEAN DEFAULT true,
        announcements BOOLEAN DEFAULT true,
        private_mode BOOLEAN DEFAULT false,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Notifications table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        data JSONB,
        "read" BOOLEAN DEFAULT false,
        clicked BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Add player_id column if it doesn't exist (migration for old tables)
    try {
      await db.execute(sql`
        ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS player_id INTEGER NOT NULL DEFAULT 0 REFERENCES players(id) ON DELETE CASCADE
      `);
    } catch (e) {
      logger.debug("player_id column already exists or migration failed");
    }

    // Web push subscriptions
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        auth TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_used TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Notification batches (for grouping multiple changes)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notification_batches (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        notifications JSONB,
        sent BOOLEAN DEFAULT false,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Notification analytics
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notification_analytics (
        id SERIAL PRIMARY KEY,
        notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        sent_at TIMESTAMPTZ DEFAULT NOW(),
        opened_at TIMESTAMPTZ,
        clicked_at TIMESTAMPTZ,
        clicked_link TEXT,
        logged_in_within_1hr BOOLEAN DEFAULT false,
        logged_in_within_24hr BOOLEAN DEFAULT false
      )
    `);

    // Admin announcements
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_announcements (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER NOT NULL REFERENCES players(id),
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        target_players JSONB,
        critical BOOLEAN DEFAULT false,
        sent BOOLEAN DEFAULT false,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create indexes for performance (non-blocking if they fail)
    try {
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notifications_player_id ON notifications(player_id)`);
    } catch (e) {
      logger.warn("Could not create idx_notifications_player_id - column may not exist");
    }
    
    try {
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC)`);
    } catch (e) {
      logger.warn("Could not create idx_notifications_created_at");
    }
    
    try {
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_push_subscriptions_player_id ON push_subscriptions(player_id)`);
    } catch (e) {
      logger.warn("Could not create idx_push_subscriptions_player_id");
    }
    
    try {
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notification_analytics_player_id ON notification_analytics(player_id)`);
    } catch (e) {
      logger.warn("Could not create idx_notification_analytics_player_id");
    }
    
    try {
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_admin_announcements_sent ON admin_announcements(sent)`);
    } catch (e) {
      logger.warn("Could not create idx_admin_announcements_sent");
    }

    logger.info("Notification tables seeded successfully");
  } catch (err) {
    logger.error({ err }, "Failed to seed notification tables");
    throw err;
  }
}

// Initialize default preferences for existing players
export async function initializeNotificationPreferences() {
  try {
    await db.execute(sql`
      INSERT INTO notification_preferences (player_id)
      SELECT id FROM players
      WHERE id NOT IN (SELECT player_id FROM notification_preferences)
      ON CONFLICT (player_id) DO NOTHING
    `);
    logger.info("Initialized notification preferences for all players");
  } catch (err) {
    logger.error({ err }, "Failed to initialize notification preferences");
  }
}
