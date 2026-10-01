/**
 * Notification Batching & Quiet Hours - Phase 7
 * Implements smart notification delivery:
 * - Player-selected daily cap (unlimited by default)
 * - Quiet hours: 11pm-8am (no non-critical notifications)
 * - Critical notifications bypass all rules
 * - Batching window: group similar notifications together
 */

import { db } from "@workspace/db";
import { sql, and, eq, gte } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface QueuedPushMessage {
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface NotificationBatchConfig {
  playerId: number;
  notificationType: string;
  isUrgent: boolean; // Critical notifications bypass batching
  currentHour: number;
  // 0 means unlimited. This is a per-player preference rather than a
  // league-wide hard cap, so players can choose how busy their phone is.
  maxDailyNotifications?: number;
}

export interface BatchingResult {
  shouldSend: boolean;
  reason: string;
  batchingDelay?: number; // ms to delay if batched
}

const QUIET_HOURS_START = 23; // 11 PM
const QUIET_HOURS_END = 8;   // 8 AM
const LEAGUE_TIME_ZONE = "Europe/London";

type LondonDateParts = { year: number; month: number; day: number; hour: number };

function getLondonDateParts(date: Date): LondonDateParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LEAGUE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(part => part.type === type)?.value ?? 0);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour") };
}

/** Convert a Europe/London wall-clock time to its real UTC instant. */
function londonWallTimeToDate(year: number, month: number, day: number, hour: number): Date {
  const targetWallTime = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
  let timestamp = targetWallTime;
  // One correction normally suffices; a second keeps this reliable across
  // the GMT/BST boundary where the London offset changes.
  for (let i = 0; i < 2; i++) {
    const actual = getLondonDateParts(new Date(timestamp));
    const actualWallTime = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, 0, 0, 0);
    timestamp += targetWallTime - actualWallTime;
  }
  return new Date(timestamp);
}

function nextLondonMorning(now: Date, forceTomorrow: boolean): Date {
  const london = getLondonDateParts(now);
  const calendar = new Date(Date.UTC(london.year, london.month - 1, london.day + (forceTomorrow ? 1 : 0)));
  return londonWallTimeToDate(
    calendar.getUTCFullYear(),
    calendar.getUTCMonth() + 1,
    calendar.getUTCDate(),
    QUIET_HOURS_END,
  );
}

/**
 * Check if current time is within quiet hours
 */
export function isInQuietHours(hour: number): boolean {
  // 11 PM (23) to 8 AM (8) crosses midnight
  if (QUIET_HOURS_START > QUIET_HOURS_END) {
    return hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END;
  }
  return hour >= QUIET_HOURS_START && hour < QUIET_HOURS_END;
}

/**
 * Count pushes actually delivered to the player today. Counting rows in
 * `notifications` was wrong for two reasons: inbox-only notifications were
 * treated as pushes, and the new notification had already been inserted by
 * the time this check ran, so it counted itself before it was sent.
 */
export async function countTodayNotifications(
  playerId: number
): Promise<number> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(DISTINCT notification_id) as count
      FROM notification_analytics
      WHERE player_id = ${playerId}
      AND (sent_at AT TIME ZONE 'Europe/London')::date =
          (NOW() AT TIME ZONE 'Europe/London')::date
    `);

    return parseInt((result.rows[0] as any).count || 0);
  } catch (error) {
    logger.error({ playerId, error }, "Error counting daily notifications");
    return 0;
  }
}

/**
 * Check if notification can be sent based on batching rules
 */
export async function checkBatchingRules(
  config: NotificationBatchConfig
): Promise<BatchingResult> {
  // Critical notifications always go through
  if (config.isUrgent) {
    return {
      shouldSend: true,
      reason: "Critical notification - bypasses batching rules"
    };
  }

  // Check quiet hours
  if (isInQuietHours(config.currentHour)) {
    return {
      shouldSend: false,
      reason: `Quiet hours active (${QUIET_HOURS_START}:00 - ${QUIET_HOURS_END}:00). Notification will be sent at ${QUIET_HOURS_END}:00.`,
      batchingDelay: calculateDelayToQuietHourEnd(config.currentHour)
    };
  }

  // Check the player's chosen daily limit. Missing/zero means unlimited,
  // which is also the default for existing players after the migration.
  const dailyLimit = config.maxDailyNotifications ?? 0;
  const sentToday = dailyLimit > 0
    ? await countTodayNotifications(config.playerId)
    : 0;
  if (dailyLimit > 0 && sentToday >= dailyLimit) {
    return {
      shouldSend: false,
      reason: `Your daily notification limit (${dailyLimit}) has been reached. Will be queued for tomorrow.`,
      batchingDelay: calculateDelayToNextQuietHourEnd()
    };
  }

  return {
    shouldSend: true,
    reason: "Notification can be sent immediately"
  };
}

/**
 * Calculate delay until quiet hours end (in ms)
 */
function calculateDelayToQuietHourEnd(currentHour: number): number {
  const now = new Date();
  const target = nextLondonMorning(now, currentHour >= QUIET_HOURS_END);
  return Math.max(0, target.getTime() - now.getTime());
}

/**
 * Calculate delay to next 8 AM
 */
function calculateDelayToNextQuietHourEnd(): number {
  const now = new Date();
  const target = nextLondonMorning(now, true);
  return Math.max(0, target.getTime() - now.getTime());
}

/**
 * Queue notification for later delivery (batching).
 *
 * This used to only log the delay and drop it — nothing ever actually
 * delivered a batched/quiet-hours-deferred push later, so any notification
 * that hit quiet hours or the daily cap silently never reached the device
 * (the in-app notifications-table row was always written before this ran,
 * so it wasn't lost — only the push). Now persists a row so
 * pushBatchScheduler.ts's periodic flush (flushDuePushNotifications() in
 * notificationService.ts) can actually deliver it once send_after arrives.
 */
export async function queueNotificationForBatching(
  playerId: number,
  notificationId: number,
  delayMs: number,
  message: QueuedPushMessage
): Promise<number> {
  const sendAfter = new Date(Date.now() + Math.max(0, delayMs));

  try {
    const result = await db.execute(sql`
      INSERT INTO pending_push_notifications (player_id, notification_id, title, body, data, send_after)
      VALUES (${playerId}, ${notificationId}, ${message.title}, ${message.body}, ${JSON.stringify(message.data || {})}, ${sendAfter})
      ON CONFLICT (notification_id) DO UPDATE SET
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        data = EXCLUDED.data,
        send_after = LEAST(pending_push_notifications.send_after, EXCLUDED.send_after)
      RETURNING id
    `);

    logger.info({
      playerId,
      notificationId,
      delayMinutes: Math.round(delayMs / 60000)
    }, "Notification queued for batching");
    return Number((result.rows[0] as any).id);
  } catch (error) {
    logger.error({ error }, "Error queueing notification for batching");
    throw error;
  }
}

/**
 * Get next available send window for a player
 */
export async function getNextSendWindow(
  playerId: number,
  maxDailyNotifications: number = 0
): Promise<{ hour: number; timestamp: Date }> {
  const now = new Date();
  const checkHour = getLondonDateParts(now).hour;

  // If in quiet hours, next window is at 8 AM
  if (isInQuietHours(checkHour)) {
    const nextWindow = nextLondonMorning(now, checkHour >= QUIET_HOURS_END);
    return { hour: QUIET_HOURS_END, timestamp: nextWindow };
  }

  // Check if daily limit reached
  const sentToday = maxDailyNotifications > 0
    ? await countTodayNotifications(playerId)
    : 0;
  if (maxDailyNotifications > 0 && sentToday >= maxDailyNotifications) {
    const nextWindow = nextLondonMorning(now, true);
    return { hour: QUIET_HOURS_END, timestamp: nextWindow };
  }

  // Can send now
  return { hour: checkHour, timestamp: now };
}

/**
 * Get batching statistics for admin panel
 */
export async function getBatchingStats(): Promise<{
  totalQueued: number;
  inQuietHours: number;
  exceededDailyLimit: number;
}> {
  try {
    // Count recent notifications (created in last hour - potential queuing indicators)
    const result = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM notifications
      WHERE created_at >= NOW() - INTERVAL '1 hour'
    `);

    return {
      totalQueued: parseInt((result.rows[0] as any).total || 0),
      inQuietHours: 0, // Would need separate tracking table
      exceededDailyLimit: 0 // Would need separate tracking table
    };
  } catch (error) {
    logger.error({ error }, "Error getting batching stats");
    return {
      totalQueued: 0,
      inQuietHours: 0,
      exceededDailyLimit: 0
    };
  }
}

/**
 * Format batching information for user-facing messages
 */
export function formatBatchingMessage(result: BatchingResult): string {
  if (result.shouldSend) {
    return "✅ Notification sent immediately";
  }

  if (result.batchingDelay) {
    const hours = Math.round(result.batchingDelay / 3600000);
    const minutes = Math.round((result.batchingDelay % 3600000) / 60000);

    let timeStr = "";
    if (hours > 0) {
      timeStr = `${hours}h ${minutes}m`;
    } else {
      timeStr = `${minutes}m`;
    }

    return `⏰ ${result.reason} (in ${timeStr})`;
  }

  return `⏳ ${result.reason}`;
}
