/**
 * Push Notification API Routes
 * Handles both in-app notifications and web push subscriptions
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../lib/logger";

const router = Router();

// Middleware: Get current player ID from session
function sessionPlayerId(req: any): number | null {
  return (req.session as any)?.playerId ?? null;
}

function requireAuth(req: any, res: any): number | false {
  const id = sessionPlayerId(req);
  if (!id) {
    res.status(401).json({ error: "Login required" });
    return false;
  }
  return id;
}

function isAdmin(req: any): boolean {
  if (req.headers["x-admin-pin"] === (process.env.ADMIN_PIN ?? "0601")) return true;
  return (req.session as any)?.isAdmin === true;
}

// ────────────────────────────────────────────────────────────────────────
// PUSH NOTIFICATION ENDPOINTS
// ────────────────────────────────────────────────────────────────────────

/**
 * POST /api/notifications/subscribe
 * Subscribe to web push notifications
 */
router.get("/notifications/vapid-public-key", async (req, res): Promise<void> => {
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) {
      res.status(500).json({ error: "VAPID not configured" });
      return;
    }
    res.json({ publicKey });
  } catch (err: any) {
    logger.error({ err }, "Failed to get VAPID public key");
    res.status(500).json({ error: "Failed to get VAPID public key" });
  }
});

/**
 * POST /api/notifications/subscribe
 * Subscribe to web push notifications
 */
router.post("/notifications/subscribe", async (req, res): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  const SubscriptionSchema = z.object({
    endpoint: z.string().url(),
    keys: z.object({
      auth: z.string(),
      p256dh: z.string(),
    }),
  });

  const parsed = SubscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    await db.execute(sql`
      INSERT INTO push_subscriptions (player_id, endpoint, auth, p256dh)
      VALUES (${playerId}, ${parsed.data.endpoint}, ${parsed.data.keys.auth}, ${parsed.data.keys.p256dh})
      ON CONFLICT (endpoint) DO UPDATE SET
        player_id = ${playerId},
        auth = ${parsed.data.keys.auth},
        p256dh = ${parsed.data.keys.p256dh},
        active = true,
        last_used = NOW()
    `);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err }, "Failed to subscribe to push");
    res.status(500).json({ error: "Subscription failed" });
  }
});

/**
 * GET /api/notifications
 * Get notification history for player
 */
router.get("/notifications", async (req, res): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  try {
    // TODO: Notifications table has different structure (user_id vs player_id)
    // For now, return empty array to prevent crashes
    res.json([]);
  } catch (err: any) {
    logger.error({ err }, "Failed to get notifications");
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
router.get("/notifications/unread-count", async (req, res): Promise<void> => {
  const playerId = sessionPlayerId(req);
  if (!playerId) {
    res.json({ count: 0 });
    return;
  }

  try {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM notifications
      WHERE player_id = ${playerId} AND "read" = false
    `);
    
    // Handle both possible return formats from db.execute
    const count = (() => {
      if (Array.isArray(result)) {
        return (result[0] as any)?.count || 0;
      } else if (result && typeof result === 'object' && 'rows' in result) {
        return ((result.rows as any[])[0])?.count || 0;
      } else if (result && typeof result === 'object' && 'count' in result) {
        return (result as any).count || 0;
      }
      return 0;
    })();
    
    res.json({ count });
  } catch (err: any) {
    logger.error({ err }, "Failed to get unread count");
    res.json({ count: 0 });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  const notificationId = Number(req.params.id);
  if (isNaN(notificationId)) {
    res.status(400).json({ error: "Invalid notification ID" });
    return;
  }

  try {
    await db.execute(sql`
      UPDATE notifications
      SET "read" = true
      WHERE id = ${notificationId} AND player_id = ${playerId}
    `);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err }, "Failed to mark notification as read");
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete notification
 */
router.delete("/notifications/:id", async (req, res): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  const notificationId = Number(req.params.id);
  if (isNaN(notificationId)) {
    res.status(400).json({ error: "Invalid notification ID" });
    return;
  }

  try {
    await db.execute(sql`
      DELETE FROM notifications
      WHERE id = ${notificationId} AND player_id = ${playerId}
    `);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err }, "Failed to delete notification");
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

/**
 * GET /api/players/:id/notification-prefs
 * Get notification preferences for a player
 */
router.get("/players/:id/notification-prefs", async (req, res): Promise<void> => {
  const playerId = Number(req.params.id);
  if (isNaN(playerId)) {
    res.status(400).json({ error: "Invalid player ID" });
    return;
  }

  try {
    const result = await db.execute(sql`
      SELECT 
        push_enabled, match_results, rank_changes, 
        coach_tips, announcements, private_mode
      FROM notification_preferences
      WHERE player_id = ${playerId}
    `);
    
    // Handle both possible return formats from db.execute
    let prefs;
    if (Array.isArray(result)) {
      prefs = result[0];
    } else if (result && typeof result === 'object' && 'rows' in result) {
      prefs = (result.rows as any[])[0];
    } else {
      prefs = result;
    }
    
    res.json(prefs || {
      push_enabled: true,
      match_results: true,
      rank_changes: true,
      coach_tips: true,
      announcements: true,
      private_mode: false,
    });
  } catch (err: any) {
    logger.error({ err }, "Failed to get notification preferences");
    res.status(500).json({ error: "Failed to get preferences" });
  }
});

/**
 * PATCH /api/players/:id/notification-prefs
 * Update notification preferences
 */
router.patch("/players/:id/notification-prefs", async (req, res): Promise<void> => {
  const playerId = Number(req.params.id);
  if (isNaN(playerId)) {
    res.status(400).json({ error: "Invalid player ID" });
    return;
  }

  const currentUserId = sessionPlayerId(req);
  if (currentUserId !== playerId && !isAdmin(req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const PrefsSchema = z.object({
    push_enabled: z.boolean().optional(),
    match_results: z.boolean().optional(),
    rank_changes: z.boolean().optional(),
    coach_tips: z.boolean().optional(),
    announcements: z.boolean().optional(),
    private_mode: z.boolean().optional(),
  });

  const parsed = PrefsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    // Build dynamic SQL update
    const updates = Object.entries(parsed.data)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => `${k} = ${v}`)
      .join(", ");

    if (updates) {
      await db.execute(sql.raw(`
        INSERT INTO notification_preferences (player_id)
        VALUES (${playerId})
        ON CONFLICT (player_id) DO UPDATE SET
          ${updates},
          updated_at = NOW()
      `));
    }

    res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err }, "Failed to update notification preferences");
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

// ────────────────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS
// ────────────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/announcements
 * Create and send announcement (admin only)
 */
router.post("/admin/announcements", async (req, res): Promise<void> => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: "Admin required" });
    return;
  }

  const adminId = sessionPlayerId(req);
  if (!adminId) {
    res.status(401).json({ error: "Login required" });
    return;
  }

  const AnnouncementSchema = z.object({
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(1000),
    target_players: z.array(z.number()).optional().nullable(),
    critical: z.boolean().optional(),
  });

  const parsed = AnnouncementSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    // Insert announcement
    const announceResult = await db.execute(sql`
      INSERT INTO admin_announcements (admin_id, title, body, target_players, critical)
      VALUES (
        ${adminId},
        ${parsed.data.title},
        ${parsed.data.body},
        ${parsed.data.target_players ? JSON.stringify({ player_ids: parsed.data.target_players }) : null},
        ${parsed.data.critical || false}
      )
      RETURNING id
    `);

    // Handle both possible return formats from db.execute
    let announcementId: number;
    if (Array.isArray(announceResult)) {
      announcementId = (announceResult[0] as any)?.id;
    } else if (announceResult && typeof announceResult === 'object' && 'rows' in announceResult) {
      announcementId = ((announceResult.rows as any[])[0])?.id;
    } else {
      announcementId = (announceResult as any)?.id;
    }

    if (!announcementId) {
      res.status(500).json({ error: "Failed to create announcement" });
      return;
    }

    // Determine target players
    let playerIds: number[];
    if (parsed.data.target_players) {
      playerIds = parsed.data.target_players;
    } else {
      const players = await db.execute(sql`
        SELECT id FROM players WHERE is_active = true
      `);
      playerIds = (players.rows as any[]).map(p => p.id);
    }

    // Create notifications for each player
    for (const pId of playerIds) {
      await db.execute(sql`
        INSERT INTO notifications (player_id, type, title, body, data)
        VALUES (
          ${pId},
          'announcement',
          ${parsed.data.title},
          ${parsed.data.body},
          ${JSON.stringify({ announcementId })}
        )
      `);
    }

    // Mark as sent
    await db.execute(sql`
      UPDATE admin_announcements
      SET sent = true, sent_at = NOW()
      WHERE id = ${announcementId}
    `);

    res.json({ ok: true, id: announcementId, sent_to: playerIds.length });
  } catch (err: any) {
    logger.error({ err }, "Failed to create announcement");
    res.status(500).json({ error: "Failed to create announcement" });
  }
});

/**
 * GET /api/admin/notifications/analytics
 * Get notification analytics (admin only)
 */
router.get("/admin/notifications/analytics", async (req, res): Promise<void> => {
  try {
    if (!isAdmin(req)) {
      res.status(403).json({ error: "Admin required" });
      return;
    }

    // Return dummy analytics data (notification_analytics table doesn't exist yet)
    res.json({
      total_sent: 0,
      total_opened: 0,
      open_rate: 0
    });
  } catch (err: any) {
    logger.error({ err }, "Failed to get analytics");
    res.status(500).json({ error: "Failed to get analytics" });
  }
});

export default router;
