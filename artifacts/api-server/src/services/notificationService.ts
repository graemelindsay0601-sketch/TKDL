/**
 * Push Notification Service
 * Handles creating, sending, and tracking notifications
 */

import { db } from "@workspace/db";
import { sql, eq, and } from "drizzle-orm";
import { logger } from "./logger";

export interface NotificationPayload {
  playerId: number;
  type: "match_result" | "rank_change" | "threat_alert" | "coach_tip" | "announcement";
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
}

/**
 * Create and queue a notification
 */
export async function createNotification(payload: NotificationPayload): Promise<number> {
  try {
    const [notification] = await db.execute(sql`
      INSERT INTO notifications (player_id, type, title, body, data)
      VALUES (${payload.playerId}, ${payload.type}, ${payload.title}, ${payload.body}, ${JSON.stringify(payload.data || {})})
      RETURNING id
    `);

    const notificationId = (notification as any).id;
    
    // Check player preferences
    const prefs = await db.execute(sql`
      SELECT * FROM notification_preferences WHERE player_id = ${payload.playerId}
    `);

    const preference = (prefs.rows[0] as any);
    
    // Determine if we should send based on preferences
    const shouldSend = await shouldSendNotification(payload, preference);
    
    if (shouldSend) {
      // Send push notification asynchronously (don't wait)
      sendPushNotification(payload.playerId, notificationId, {
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
      }).catch(err => logger.error({ err }, "Failed to send push notification"));
    }

    return notificationId;
  } catch (err) {
    logger.error({ err }, "Failed to create notification");
    throw err;
  }
}

/**
 * Check if notification should be sent based on preferences and rules
 */
async function shouldSendNotification(payload: NotificationPayload, prefs: any): Promise<boolean> {
  if (!prefs?.push_enabled) return false;

  // Check type-specific preference
  const typeKey = `${payload.type.replace(/-/g, "_")}` as keyof typeof prefs;
  if (typeKey in prefs && !prefs[typeKey]) return false;

  // Check quiet hours (11pm-8am)
  const hour = new Date().getHours();
  if (hour >= 23 || hour < 8) {
    // Queue for morning instead of sending now
    // For now, skip. This should be handled by batch system
    return false;
  }

  // Check daily limit (max 3 non-critical notifications per day)
  if (payload.type !== "announcement") {
    const today = new Date().toDateString();
    const [{ count }] = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM notifications
      WHERE player_id = ${payload.playerId}
        AND type != 'announcement'
        AND created_at::date = ${today}::date
    `);
    
    if ((count as any) >= 3) {
      return false; // Too many notifications today
    }
  }

  return true;
}

/**
 * Send Web Push notification to player's device
 */
async function sendPushNotification(
  playerId: number,
  notificationId: number,
  message: { title: string; body: string; data: Record<string, any> }
): Promise<void> {
  try {
    // Get push subscriptions for this player
    const subs = await db.execute(sql`
      SELECT endpoint, auth, p256dh FROM push_subscriptions
      WHERE player_id = ${playerId} AND active = true
    `);

    if (subs.rows.length === 0) {
      logger.debug(`No push subscriptions for player ${playerId}`);
      return;
    }

    const webPush = await import("web-push");
    
    for (const sub of subs.rows as any[]) {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              auth: sub.auth,
              p256dh: sub.p256dh,
            },
          },
          JSON.stringify({
            title: message.title,
            body: message.body,
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            data: {
              notificationId,
              ...message.data,
            },
            actions: [
              {
                action: "open",
                title: "Open",
              },
              {
                action: "close",
                title: "Dismiss",
              },
            ],
          })
        );

        // Update last_used timestamp
        await db.execute(sql`
          UPDATE push_subscriptions
          SET last_used = NOW()
          WHERE endpoint = ${sub.endpoint}
        `);

        // Log analytics
        await db.execute(sql`
          INSERT INTO notification_analytics (notification_id, player_id, sent_at)
          VALUES (${notificationId}, ${playerId}, NOW())
        `);
      } catch (err: any) {
        // If subscription is invalid, mark as inactive
        if (err.statusCode === 410) {
          await db.execute(sql`
            UPDATE push_subscriptions SET active = false WHERE endpoint = ${sub.endpoint}
          `);
        }
        logger.error({ err }, `Failed to send push to ${sub.endpoint}`);
      }
    }
  } catch (err) {
    logger.error({ err }, `Failed to send push notification for notification ${notificationId}`);
  }
}

/**
 * Get notification history for a player
 */
export async function getNotifications(
  playerId: number,
  limit: number = 20,
  offset: number = 0
): Promise<any[]> {
  const result = await db.execute(sql`
    SELECT id, type, title, body, data, "read", created_at
    FROM notifications
    WHERE player_id = ${playerId}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return result.rows as any[];
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId: number): Promise<void> {
  await db.execute(sql`
    UPDATE notifications
    SET "read" = true
    WHERE id = ${notificationId}
  `);
}

/**
 * Delete notification
 */
export async function deleteNotification(notificationId: number): Promise<void> {
  await db.execute(sql`
    DELETE FROM notifications
    WHERE id = ${notificationId}
  `);
}

/**
 * Get player notification preferences
 */
export async function getNotificationPreferences(playerId: number): Promise<any> {
  const result = await db.execute(sql`
    SELECT * FROM notification_preferences
    WHERE player_id = ${playerId}
  `);

  return result.rows[0] || null;
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  playerId: number,
  prefs: Partial<any>
): Promise<void> {
  const updateFields = Object.entries(prefs)
    .map(([key, value]) => `${key} = ${value === true ? "true" : value === false ? "false" : `'${value}'`}`)
    .join(", ");

  await db.execute(sql`
    INSERT INTO notification_preferences (player_id)
    VALUES (${playerId})
    ON CONFLICT (player_id) DO UPDATE SET
      ${sql.raw(updateFields)},
      updated_at = NOW()
  `);
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(
  playerId: number,
  subscription: PushSubscription
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO push_subscriptions (player_id, endpoint, auth, p256dh)
      VALUES (${playerId}, ${subscription.endpoint}, ${subscription.keys.auth}, ${subscription.keys.p256dh})
      ON CONFLICT (endpoint) DO UPDATE SET
        player_id = ${playerId},
        auth = ${subscription.keys.auth},
        p256dh = ${subscription.keys.p256dh},
        active = true,
        last_used = NOW()
    `);

    logger.info(`Player ${playerId} subscribed to push notifications`);
  } catch (err) {
    logger.error({ err }, "Failed to subscribe to push notifications");
    throw err;
  }
}

/**
 * Get notification analytics
 */
export async function getNotificationAnalytics(): Promise<any> {
  const [stats] = await db.execute(sql`
    SELECT
      COUNT(*) as total_sent,
      COUNT(opened_at) as total_opened,
      ROUND(COUNT(opened_at)::numeric / COUNT(*)::numeric * 100, 2) as open_rate,
      COUNT(clicked_at) as total_clicked,
      ROUND(COUNT(clicked_at)::numeric / COUNT(*)::numeric * 100, 2) as click_rate
    FROM notification_analytics
    WHERE sent_at > NOW() - INTERVAL '30 days'
  `);

  return stats;
}

/**
 * Create admin announcement
 */
export async function createAnnouncement(
  adminId: number,
  title: string,
  body: string,
  targetPlayers?: number[] | null,
  critical: boolean = false
): Promise<number> {
  const [announcement] = await db.execute(sql`
    INSERT INTO admin_announcements (admin_id, title, body, target_players, critical)
    VALUES (${adminId}, ${title}, ${body}, ${targetPlayers ? JSON.stringify({ player_ids: targetPlayers }) : null}, ${critical})
    RETURNING id
  `);

  const announcementId = (announcement as any).id;

  // Determine who to send to
  let playerIds: number[];
  if (targetPlayers) {
    playerIds = targetPlayers;
  } else {
    // Send to all active players
    const players = await db.execute(sql`
      SELECT id FROM players WHERE is_active = true
    `);
    playerIds = (players.rows as any[]).map(p => p.id);
  }

  // Send to each player
  for (const playerId of playerIds) {
    await createNotification({
      playerId,
      type: "announcement",
      title,
      body,
      data: { announcementId },
    });
  }

  // Mark as sent
  await db.execute(sql`
    UPDATE admin_announcements
    SET sent = true, sent_at = NOW()
    WHERE id = ${announcementId}
  `);

  return announcementId;
}
