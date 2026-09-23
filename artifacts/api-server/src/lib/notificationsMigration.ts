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
        threat_alerts BOOLEAN DEFAULT true,
        coach_tips BOOLEAN DEFAULT true,
        announcements BOOLEAN DEFAULT true,
        private_mode BOOLEAN DEFAULT false,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // threat_alerts on an existing (already-created) table — see the
    // ADD COLUMN IF NOT EXISTS pattern used for the notifications table
    // below. Threat alerts ("X is closing in on your rank") used to be
    // unconditional — sent on every close singles match regardless of any
    // preference, the one type players had no way to turn off — because
    // this column didn't exist for the per-type check in
    // notificationService.ts's shouldSendNotification() to key off.
    await db.execute(sql`
      ALTER TABLE notification_preferences
        ADD COLUMN IF NOT EXISTS threat_alerts BOOLEAN DEFAULT true
    `);

    // direct_messages — DM notifications (routes/messages.ts) went through
    // communityNotify.ts's createNotification(), which gated EVERY type it
    // handles (including dm_received) behind the league-wide
    // "notifications_enabled" setting, which defaults to false and is only
    // reachable via a hidden admin debug route or the Feature Flags page.
    // Effectively no one has ever gotten a DM push. This column lets DMs
    // use the same reliable per-player opt-out pattern match results
    // already have, instead of that all-or-nothing league switch — see the
    // dm_received special-case in communityNotify.ts's createNotification().
    await db.execute(sql`
      ALTER TABLE notification_preferences
        ADD COLUMN IF NOT EXISTS direct_messages BOOLEAN DEFAULT true
    `);

    // achievements / community_activity — same fix as direct_messages
    // above, extended to the rest of communityNotify.ts's types.
    // achievement_unlocked, and the post_approved/post_liked/post_commented/
    // auto_post_fired group, were ALSO silently dropped for everyone by the
    // same always-off "notifications_enabled" league switch — this wasn't
    // a DM-specific problem, it affected every type that pipeline handles.
    // See TYPE_TO_PREF_COLUMN in communityNotify.ts.
    await db.execute(sql`
      ALTER TABLE notification_preferences
        ADD COLUMN IF NOT EXISTS achievements BOOLEAN DEFAULT true
    `);
    await db.execute(sql`
      ALTER TABLE notification_preferences
        ADD COLUMN IF NOT EXISTS community_activity BOOLEAN DEFAULT true
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

    // The notifications table grew a second write path (a plain "actor did
    // something to an entity" shape used by e.g. the admin test-comms route
    // and social/DM notifications) alongside the original title/body/data
    // shape, and GET /notifications reads both together with COALESCE — but
    // the columns that second shape needs were never actually added to the
    // table, so both that write path and the read route have been failing
    // with "column does not exist" since whenever this was written. Backfill
    // them idempotently; title/body relax to nullable since a message-style
    // row supplies `message` instead of them.
    try {
      await db.execute(sql`
        ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS actor_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS entity_id INTEGER,
        ADD COLUMN IF NOT EXISTS entity_type TEXT,
        ADD COLUMN IF NOT EXISTS message TEXT,
        ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ
      `);
      await db.execute(sql`ALTER TABLE notifications ALTER COLUMN title DROP NOT NULL`);
      await db.execute(sql`ALTER TABLE notifications ALTER COLUMN body DROP NOT NULL`);
      logger.info("Notifications table actor/entity/message columns ready");
    } catch (e) {
      logger.error({ err: e }, "Failed to add actor/entity/message columns to notifications");
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
