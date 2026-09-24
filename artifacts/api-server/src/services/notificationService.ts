/**
 * Push Notification Service
 * Handles creating, sending, and tracking notifications
 */

import { db } from "@workspace/db";
import { sql, eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";
import { checkBatchingRules, queueNotificationForBatching } from "./batchingService";

// The "community" types (dm_received through auto_post_fired) used to run
// through a second, parallel createNotification() in lib/communityNotify.ts
// — its own DB write (a different notifications-table column shape), its
// own push-send implementation, its own preferences lookup. Two systems
// that happened to share a table, not one. communityNotify.ts's
// createNotification is now a thin wrapper around this one instead — see
// its header — so every notification in the app, of every type, now goes
// through exactly one insert, one preference check, and one push send.
export interface NotificationPayload {
  playerId: number;
  type:
    | "match_result" | "rank_change" | "threat_alert" | "coach_tip" | "announcement"
    | "dm_received" | "achievement_unlocked"
    | "post_approved" | "post_liked" | "post_commented" | "auto_post_fired";
  title: string;
  body: string;
  data?: Record<string, any>;
  // Only meaningful for type "announcement" — mirrors the admin composer's
  // "critical" checkbox (announcements-manager.tsx), which claims to bypass
  // quiet hours/daily batching limits. Threat alerts are always critical
  // regardless of this flag.
  critical?: boolean;
  // Who/what this notification is about — optional, only ever set by the
  // former communityNotify.ts call sites (a DM, a like, a comment, an
  // achievement). Written straight to the notifications table's actor_id/
  // entity_id/entity_type columns so GET /notifications' actor_name join
  // keeps working for these types exactly as it did before.
  actorId?: number | null;
  entityId?: number | null;
  entityType?: string | null;
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
      INSERT INTO notifications (player_id, type, title, body, message, data, actor_id, entity_id, entity_type)
      VALUES (
        ${payload.playerId}, ${payload.type}, ${payload.title}, ${payload.body}, ${payload.body}, ${JSON.stringify(payload.data || {})},
        ${payload.actorId ?? null}, ${payload.entityId ?? null}, ${payload.entityType ?? null}
      )
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
    // Merged in from communityNotify.ts's own (now-removed) copy of this
    // map — see this file's header comment.
    dm_received:          "direct_messages",
    achievement_unlocked: "achievements",
    post_approved:        "community_activity",
    post_liked:            "community_activity",
    post_commented:        "community_activity",
    auto_post_fired:       "community_activity",
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
 * Fire one real notification straight at a single player's own device and
 * report back exactly what happened, instead of the fire-and-forget +
 * logger.error pattern the rest of this file uses (fine for background
 * triggers nobody's watching, useless for "is this actually working").
 * Walks the same checks createNotification()/sendPushNotification() do
 * internally, but surfaces which one failed rather than swallowing it.
 */
export async function sendTestNotification(playerId: number): Promise<{
  ok: boolean;
  reason?: "vapid_not_configured" | "push_disabled" | "not_subscribed" | "send_failed";
  detail?: string;
  sentTo?: number;
}> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return {
      ok: false,
      reason: "vapid_not_configured",
      detail: "The server has no VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY set, so push notifications can't be delivered by anyone yet. Run \"pnpm run generate-vapid-keys\" in artifacts/api-server, add the two printed lines to your .env, and restart the server.",
    };
  }

  const prefs = await getNotificationPreferences(playerId);
  if (prefs && prefs.push_enabled === false) {
    return {
      ok: false,
      reason: "push_disabled",
      detail: "Push notifications are turned off in your own preferences — turn on \"All Notifications\" below, then try the test again.",
    };
  }

  const subs = await db.execute(sql`
    SELECT endpoint, auth, p256dh FROM push_subscriptions WHERE player_id = ${playerId}
  `);
  const rows = subs.rows as any[];
  if (rows.length === 0) {
    return {
      ok: false,
      reason: "not_subscribed",
      detail: "You don't have an active push subscription on this device — tap \"Enable\" above first, then try the test again.",
    };
  }

  // Write a real row so it also shows up in the in-app notification list,
  // same as any other notification — the test should exercise the actual
  // pipeline, not a side path.
  const { rows: [notification] } = await db.execute(sql`
    INSERT INTO notifications (player_id, type, title, body, message, data)
    VALUES (${playerId}, 'announcement', 'Test notification', 'If you can see this, push notifications are working.', 'If you can see this, push notifications are working.', ${JSON.stringify({ test: true })})
    RETURNING id
  `);
  const notificationId = (notification as any).id;

  const webPush = await import("web-push");
  let sentTo = 0;
  let lastError: string | undefined;
  for (const sub of rows) {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
        JSON.stringify({
          title: "Test notification",
          body: "If you can see this, push notifications are working.",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          data: { notificationId, test: true },
        })
      );
      sentTo++;
      await db.execute(sql`UPDATE push_subscriptions SET last_used = NOW() WHERE endpoint = ${sub.endpoint}`);
      await db.execute(sql`
        INSERT INTO notification_analytics (notification_id, player_id, sent_at)
        VALUES (${notificationId}, ${playerId}, NOW())
      `);
    } catch (err: any) {
      // 410 = the push service says this subscription is gone for good.
      // 403 = the push service rejected our VAPID auth for this specific
      // subscription — confirmed live: "the VAPID credentials in the
      // authorization header do not correspond to the credentials used to
      // create the subscriptions" (FCM) / "BadJwtToken" (Apple). That means
      // this exact subscription was created under a DIFFERENT VAPID key
      // than the one this server has configured now — a subscription is
      // cryptographically bound to the key active when the browser called
      // pushManager.subscribe(), so it can never succeed against today's
      // key no matter how many times we retry it. Just as dead as a 410,
      // for a different reason — prune it the same way, so it stops
      // silently eating every future test instead of ever getting fixed by
      // the player resubscribing (which creates a new row, not repairing
      // this one).
      if (err.statusCode === 410 || err.statusCode === 403) {
        await db.execute(sql`DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}`);
      }
      lastError = err?.body || err?.message || String(err);
      logger.error({ err }, "Test notification failed to send");
    }
  }

  if (sentTo === 0) {
    return {
      ok: false,
      reason: "send_failed",
      detail: lastError ?? "The push service rejected the notification for an unknown reason — check the server logs.",
      sentTo: 0,
    };
  }
  return { ok: true, sentTo };
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
        // 410 Gone, or 403 = this subscription's key doesn't match our
        // current VAPID keys — permanently dead either way. See the
        // matching comment in sendTestNotification for the full story.
        if (err.statusCode === 410 || err.statusCode === 403) {
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
 * Send match result notifications for a Team Match (team_501) to every
 * player on both sides (up to 6 a side). Team Matches had rank-change
 * alerts (sendRankChangeNotifications, wired in routes/team-matches.ts) but
 * — unlike Singles, Doubles and Shift Wars — no actual win/loss
 * notification: a player only found out their team match result happened
 * at all if their leaderboard position happened to move because of it.
 * Reuses "match_result" like every other game mode, so it's covered by the
 * same Match Results preference toggle players already have — no new
 * toggle needed for players to control this.
 */
export async function sendTeamMatchResultNotification(
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
        title: "Team Match Victory!",
        body: `${winnerTeamName} beat ${loserTeamName} • +${eloChange} ELO • ±${stake} pts`,
        data: { winnerTeamName, loserTeamName, eloChange, stake, result: "win" },
      })),
      ...loserPlayerIds.map(playerId => createNotification({
        playerId,
        type: "match_result",
        title: "Team Match Loss",
        body: `${loserTeamName} lost to ${winnerTeamName} • -${eloChange} ELO • ±${stake} pts`,
        data: { winnerTeamName, loserTeamName, eloChange, stake, result: "loss" },
      })),
    ]);
  } catch (err) {
    logger.error({ err }, "Failed to send team match result notifications");
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
 * Ping every other opted-in, active player when a match finishes anywhere
 * in the league — not just the players/teams who were actually in it.
 * Reuses the "match_result" type and createNotification's existing
 * per-player preference + batching/quiet-hours checks, so turning off
 * "Match Results" in your own settings opts you out of both your own
 * match alerts and everyone else's, the same as before this existed.
 */
export async function sendMatchResultBroadcast(
  excludePlayerIds: number[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    const rest = await db.execute(sql`
      SELECT id FROM players
      WHERE is_active = true
        AND id <> ALL(ARRAY[${sql.join(excludePlayerIds.map(id => sql`${id}`), sql`, `)}]::int[])
    `);
    for (const p of rest.rows as any[]) {
      void createNotification({
        playerId: p.id,
        type: "match_result",
        title,
        body,
        data: { ...data, broadcast: true },
      });
    }
  } catch (err) {
    logger.error({ err }, "Failed to send match result broadcast");
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
