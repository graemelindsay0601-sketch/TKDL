/**
 * Push Notification Service
 * Handles creating, sending, and tracking notifications
 */

import { db } from "@workspace/db";
import { sql, eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";
import { checkBatchingRules, queueNotificationForBatching } from "./batchingService";

export interface NotificationPayload {
  playerId: number;
  type: "match_result" | "rank_change" | "threat_alert" | "coach_tip" | "announcement";
  title: string;
  body: string;
  data?: Record<string, any>;
  // Only meaningful for type "announcement" — mirrors the admin composer's
  // "critical" checkbox (announcements-manager.tsx), which claims to bypass
  // quiet hours/daily batching limits. Threat alerts are always critical
  // regardless of this flag.
  critical?: boolean;
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
    // `message` is a leftover NOT NULL column from the notifications table's
    // original shape (see the write path in communityNotify.ts) that this
    // newer title/body pipeline never populated — every insert here has been
    // failing a not-null constraint violation since this pipeline was
    // written (match-result pushes, rank-change/threat alerts, coach tips,
    // and admin announcements all go through this function). Filling it
    // with `body` satisfies the constraint and matches what GET
    // /notifications already falls back to via COALESCE(body, message) for
    // the older message-shaped rows.
    const { rows: [notification] } = await db.execute(sql`
      INSERT INTO notifications (player_id, type, title, body, message, data)
      VALUES (${payload.playerId}, ${payload.type}, ${payload.title}, ${payload.body}, ${payload.body}, ${JSON.stringify(payload.data || {})})
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

  // Check type-specific preference. notification_preferences' columns are
  // plural (match_results, rank_changes, coach_tips, announcements) while
  // payload.type is singular (match_result, rank_change, coach_tip,
  // announcement) — a bare "+ '_'" transform never matched any of them, so
  // every per-type opt-out toggle has been silently ignored (only the
  // master push_enabled switch above actually worked). threat_alert had no
  // column at all — it was unconditional (see threat_alerts column added in
  // notificationsMigration.ts), the one type players had no way to turn off.
  const TYPE_TO_PREF_COLUMN: Record<string, string> = {
    match_result: "match_results",
    rank_change:  "rank_changes",
    threat_alert: "threat_alerts",
    coach_tip:    "coach_tips",
    announcement: "announcements",
  };
  const typeKey = TYPE_TO_PREF_COLUMN[payload.type];
  if (typeKey && typeKey in prefs && !prefs[typeKey]) return false;

  // Critical notifications always go through. This used to treat every
  // announcement as critical unconditionally, so the admin composer's
  // "critical" checkbox (announcements-manager.tsx) was pure UI theatre —
  // checked or not, every announcement already bypassed quiet hours/daily
  // batching limits the same way. Now only an announcement explicitly
  // flagged critical gets that bypass; an unflagged one is subject to the
  // same batching rules as any other notification type.
  const isCritical = payload.type === "threat_alert" || (payload.type === "announcement" && payload.critical === true);
  
  // Check batching rules
  const batchingResult = await checkBatchingRules({
    playerId: payload.playerId,
    notificationType: payload.type,
    isUrgent: isCritical,
    currentHour: new Date().getHours()
  });

  if (!batchingResult.shouldSend) {
    logger.info({
      playerId: payload.playerId,
      type: payload.type,
      reason: batchingResult.reason
    }, "Notification batched/queued");
    return false;
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
      WHERE player_id = ${playerId}
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
        // If subscription is invalid (410 = Gone), delete it
        if (err.statusCode === 410) {
          await db.execute(sql`
            DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}
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
 * Update notification preferences.
 *
 * This used to build the column list and values by string-concatenating
 * `prefs` straight into raw SQL text (both the column NAME and the value —
 * the one place in the codebase that didn't follow the tagged-template
 * parameterization used everywhere else). Nothing currently calls this
 * function — the reachable route, PATCH /players/:id/notification-prefs in
 * routes/players.ts, has its own properly-parameterized version — but it's
 * real, exploitable SQL injection the moment anything wires user input
 * into `prefs`, so it's fixed to use the same allowlisted, parameterized
 * upsert as the reachable route rather than left as a landmine.
 */
const NOTIFICATION_PREF_KEYS = [
  "push_enabled", "match_results", "rank_changes", "threat_alerts",
  "coach_tips", "announcements", "private_mode",
] as const;

export async function updateNotificationPreferences(
  playerId: number,
  prefs: Partial<Record<(typeof NOTIFICATION_PREF_KEYS)[number], boolean>>
): Promise<void> {
  const p = prefs;
  await db.execute(sql`
    INSERT INTO notification_preferences (player_id, push_enabled, match_results, rank_changes, threat_alerts, coach_tips, announcements, private_mode)
    VALUES (
      ${playerId},
      ${p.push_enabled ?? true}, ${p.match_results ?? true}, ${p.rank_changes ?? true}, ${p.threat_alerts ?? true},
      ${p.coach_tips ?? true}, ${p.announcements ?? true}, ${p.private_mode ?? false}
    )
    ON CONFLICT (player_id) DO UPDATE SET
      push_enabled  = COALESCE(${p.push_enabled ?? null}, notification_preferences.push_enabled),
      match_results = COALESCE(${p.match_results ?? null}, notification_preferences.match_results),
      rank_changes  = COALESCE(${p.rank_changes ?? null}, notification_preferences.rank_changes),
      threat_alerts = COALESCE(${p.threat_alerts ?? null}, notification_preferences.threat_alerts),
      coach_tips    = COALESCE(${p.coach_tips ?? null}, notification_preferences.coach_tips),
      announcements = COALESCE(${p.announcements ?? null}, notification_preferences.announcements),
      private_mode  = COALESCE(${p.private_mode ?? null}, notification_preferences.private_mode),
      updated_at    = NOW()
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
        p256dh = ${subscription.keys.p256dh}
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
  // NULLIF guards against a division-by-zero Postgres error when nothing's
  // been sent in the last 30 days (COUNT(*) = 0) — this was throwing and
  // taking down the whole /admin/notifications/analytics request with it.
  const { rows: [stats] } = await db.execute(sql`
    SELECT
      COUNT(*) as total_sent,
      COUNT(opened_at) as total_opened,
      ROUND(COUNT(opened_at)::numeric / NULLIF(COUNT(*), 0)::numeric * 100, 2) as open_rate,
      COUNT(clicked_at) as total_clicked,
      ROUND(COUNT(clicked_at)::numeric / NULLIF(COUNT(*), 0)::numeric * 100, 2) as click_rate
    FROM notification_analytics
    WHERE sent_at > NOW() - INTERVAL '30 days'
  `);

  return stats;
}

/**
 * Send match result notification to winner and loser
 */
export async function sendMatchResultNotification(
  winnerId: number,
  loserId: number,
  winnerName: string,
  loserName: string,
  stake: number,
  eloChange: number
): Promise<void> {
  try {
    // Winner notification
    await createNotification({
      playerId: winnerId,
      type: "match_result",
      title: `Victory!`,
      body: `You beat ${loserName} • +${eloChange} ELO • ±${stake} pts`,
      data: {
        matchWinnerId: winnerId,
        matchLoserId: loserId,
        eloChange,
        stake,
        result: "win",
      },
    });

    // Loser notification
    await createNotification({
      playerId: loserId,
      type: "match_result",
      title: `Match Loss`,
      body: `Lost to ${winnerName} • -${eloChange} ELO • ±${stake} pts`,
      data: {
        matchWinnerId: winnerId,
        matchLoserId: loserId,
        eloChange,
        stake,
        result: "loss",
      },
    });
  } catch (err) {
    logger.error({ err }, "Failed to send match result notifications");
  }
}

/**
 * Send match result notifications for a Doubles Event match to every player
 * on both teams (2 or 3 a side). Doubles never had any push/notification
 * integration at all — only singles (routes/matches.ts) did — so results
 * here were invisible to anyone not actively watching the standings page.
 * Reuses the "match_result" type so it's governed by the same
 * match-results preference toggle players already have.
 */
export async function sendDoublesMatchResultNotification(
  winnerTeamName: string,
  loserTeamName: string,
  winnerPlayerIds: number[],
  loserPlayerIds: number[],
  stake: number,
  eloChange: number
): Promise<void> {
  try {
    await Promise.all([
      ...winnerPlayerIds.map(playerId => createNotification({
        playerId,
        type: "match_result",
        title: "Victory!",
        body: `${winnerTeamName} beat ${loserTeamName} • +${eloChange} ELO • ±${stake} pts`,
        data: { winnerTeamName, loserTeamName, eloChange, stake, result: "win" },
      })),
      ...loserPlayerIds.map(playerId => createNotification({
        playerId,
        type: "match_result",
        title: "Match Loss",
        body: `${loserTeamName} lost to ${winnerTeamName} • -${eloChange} ELO • ±${stake} pts`,
        data: { winnerTeamName, loserTeamName, eloChange, stake, result: "loss" },
      })),
    ]);
  } catch (err) {
    logger.error({ err }, "Failed to send doubles match result notifications");
  }
}

/**
 * Send match result notifications for a Shift Wars match to every player on
 * both department rosters. Shift Wars is points-only (no ELO ladder — see
 * routes/shift-wars.ts) and had no notification integration at all.
 */
export async function sendShiftWarsMatchResultNotification(
  winnerTeamName: string,
  loserTeamName: string,
  winnerPlayerIds: number[],
  loserPlayerIds: number[],
  stake: number
): Promise<void> {
  try {
    await Promise.all([
      ...winnerPlayerIds.map(playerId => createNotification({
        playerId,
        type: "match_result",
        title: "Shift Wars Victory!",
        body: `${winnerTeamName} beat ${loserTeamName} • ±${stake} pts`,
        data: { winnerTeamName, loserTeamName, stake, result: "win" },
      })),
      ...loserPlayerIds.map(playerId => createNotification({
        playerId,
        type: "match_result",
        title: "Shift Wars Loss",
        body: `${loserTeamName} lost to ${winnerTeamName} • ±${stake} pts`,
        data: { winnerTeamName, loserTeamName, stake, result: "loss" },
      })),
    ]);
  } catch (err) {
    logger.error({ err }, "Failed to send Shift Wars match result notifications");
  }
}

/**
 * Send rank change notifications to affected players
 */
export async function sendRankChangeNotifications(
  affectedPlayers: Array<{ id: number; name: string; newRank: number; oldRank: number }>
): Promise<void> {
  try {
    for (const player of affectedPlayers) {
      const rankChange = player.oldRank - player.newRank; // positive = moved up, negative = moved down

      await createNotification({
        playerId: player.id,
        type: "rank_change",
        title: rankChange > 0 ? `🎉 Rank Up!` : `📍 Rank Changed`,
        body: rankChange > 0
          ? `You moved up to #${player.newRank}`
          : `You dropped to #${player.newRank}`,
        data: {
          newRank: player.newRank,
          oldRank: player.oldRank,
          rankChange,
        },
      });
    }
  } catch (err) {
    logger.error({ err }, "Failed to send rank change notifications");
  }
}

/**
 * Send threat alert if someone gets close to a player's rank
 */
export async function sendThreatAlertNotifications(
  threatData: Array<{ playerId: number; playerName: string; threatenerId: number; threateningPlayerName: string; pointGap: number }>
): Promise<void> {
  try {
    for (const threat of threatData) {
      if (threat.pointGap < 15 && threat.pointGap > 0) {
        await createNotification({
          playerId: threat.playerId,
          type: "threat_alert",
          title: `⚠️ Getting Close`,
          body: `${threat.threateningPlayerName} is ${threat.pointGap}pts away`,
          data: {
            threatSource: threat.threateningPlayerName,
            pointGap: threat.pointGap,
          },
        });
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to send threat alert notifications");
  }
}

/**
 * Create and send an admin announcement to selected players
 */
export async function createAnnouncement(
  adminId: number,
  title: string,
  body: string,
  targetPlayers?: number[] | null,
  critical: boolean = false
): Promise<number> {
  const { rows: [announcement] } = await db.execute(sql`
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

  // Send to each player — one bad row (e.g. a stale player id) used to abort
  // the whole loop via an uncaught throw, silently dropping every
  // notification after it and leaving `sent` stuck at false with no record
  // of how far it got. Isolate each player so one failure doesn't take the
  // rest of the list down with it.
  let failures = 0;
  for (const playerId of playerIds) {
    try {
      await createNotification({
        playerId,
        type: "announcement",
        title,
        body,
        data: { announcementId },
        critical,
      });
    } catch (err) {
      failures++;
      logger.error({ err, playerId, announcementId }, "Failed to notify one player for announcement");
    }
  }
  if (failures > 0) {
    logger.warn({ announcementId, failures, total: playerIds.length }, "Announcement had per-player failures");
  }

  // Mark as sent
  await db.execute(sql`
    UPDATE admin_announcements
    SET sent = true, sent_at = NOW()
    WHERE id = ${announcementId}
  `);

  return announcementId;
}
