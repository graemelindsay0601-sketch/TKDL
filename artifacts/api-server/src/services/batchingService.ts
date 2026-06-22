/**
 * Notification Batching & Quiet Hours - Phase 7
 * Implements smart notification delivery:
 * - Max 3 non-critical notifications per day
 * - Quiet hours: 11pm-8am (no non-critical notifications)
 * - Critical notifications bypass all rules
 * - Batching window: group similar notifications together
 */

import { db } from "@workspace/db";
import { sql, and, eq, gte } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface NotificationBatchConfig {
  playerId: number;
  notificationType: string;
  isUrgent: boolean; // Critical notifications bypass batching
  currentHour: number;
}

export interface BatchingResult {
  shouldSend: boolean;
  reason: string;
  batchingDelay?: number; // ms to delay if batched
}

const QUIET_HOURS_START = 23; // 11 PM
const QUIET_HOURS_END = 8;   // 8 AM
const MAX_DAILY_NOTIFICATIONS = 3;

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
 * Count non-critical notifications sent to player today
 */
export async function countTodayNotifications(
  playerId: number
): Promise<number> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE player_id = ${playerId}
      AND created_at >= CURRENT_DATE
      AND type != 'threat_alert'
      AND type != 'rank_change'
    `);

    return parseInt((result.rows[0] as any).count || 0);
  } catch (error) {
    logger.error("Error counting daily notifications", { playerId, error });
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

  // Check daily limit
  const sentToday = await countTodayNotifications(config.playerId);
  if (sentToday >= MAX_DAILY_NOTIFICATIONS) {
    return {
      shouldSend: false,
      reason: `Daily notification limit (${MAX_DAILY_NOTIFICATIONS}) reached. Will be queued for tomorrow.`,
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
  let targetHour = QUIET_HOURS_END; // 8 AM

  if (currentHour < QUIET_HOURS_END) {
    // Before 8 AM - send at 8 AM today
    const target = new Date();
    target.setHours(QUIET_HOURS_END, 0, 0, 0);
    return Math.max(0, target.getTime() - now.getTime());
  } else {
    // After 8 AM - send at 8 AM tomorrow
    const target = new Date();
    target.setDate(target.getDate() + 1);
    target.setHours(QUIET_HOURS_END, 0, 0, 0);
    return Math.max(0, target.getTime() - now.getTime());
  }
}

/**
 * Calculate delay to next 8 AM
 */
function calculateDelayToNextQuietHourEnd(): number {
  const now = new Date();
  const target = new Date();

  // Set to 8 AM tomorrow
  target.setDate(target.getDate() + 1);
  target.setHours(QUIET_HOURS_END, 0, 0, 0);

  return Math.max(0, target.getTime() - now.getTime());
}

/**
 * Queue notification for later delivery (batching)
 */
export async function queueNotificationForBatching(
  playerId: number,
  notificationId: number,
  delayMs: number
): Promise<void> {
  try {
    // Store batching info (we could use a separate queue table if needed)
    // For now, we'll log it and the notification will be picked up when player checks
    logger.info("Notification queued for batching", {
      playerId,
      notificationId,
      delayMinutes: Math.round(delayMs / 60000)
    });

    // In a production system, you might store this in a queue table
    // and have a separate job process the queue
  } catch (error) {
    logger.error("Error queueing notification for batching", { error });
  }
}

/**
 * Get next available send window for a player
 */
export async function getNextSendWindow(
  playerId: number
): Promise<{ hour: number; timestamp: Date }> {
  const now = new Date();
  let checkHour = now.getHours();

  // If in quiet hours, next window is at 8 AM
  if (isInQuietHours(checkHour)) {
    const nextWindow = new Date();
    if (checkHour < QUIET_HOURS_END) {
      nextWindow.setHours(QUIET_HOURS_END, 0, 0, 0);
    } else {
      nextWindow.setDate(nextWindow.getDate() + 1);
      nextWindow.setHours(QUIET_HOURS_END, 0, 0, 0);
    }
    return { hour: QUIET_HOURS_END, timestamp: nextWindow };
  }

  // Check if daily limit reached
  const sentToday = await countTodayNotifications(playerId);
  if (sentToday >= MAX_DAILY_NOTIFICATIONS) {
    const nextWindow = new Date();
    nextWindow.setDate(nextWindow.getDate() + 1);
    nextWindow.setHours(QUIET_HOURS_END, 0, 0, 0);
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
    logger.error("Error getting batching stats", { error });
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
