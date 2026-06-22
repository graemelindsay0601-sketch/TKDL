/**
 * Coach Tips Scheduler - Phase 6
 * Generates personalized coach tips every Sunday at 12:00 PM
 * Based on player performance from the past week
 */

import cron from "node-cron";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { createNotification } from "./notificationService";

interface CoachTip {
  playerId: number;
  title: string;
  body: string;
  type: "coach_tip";
}

/**
 * Generate personalized coach tips for a player based on their weekly performance
 */
async function generateCoachTips(playerId: number): Promise<CoachTip | null> {
  try {
    // Get player's stats for the past 7 days
    const stats = await db.execute(sql`
      SELECT 
        AVG(average) as avg_average,
        AVG(checkout_percentage) as avg_checkout,
        AVG(treble_percentage) as avg_treble,
        COUNT(*) as matches_played,
        MAX(average) as best_average,
        MIN(average) as worst_average
      FROM matches
      WHERE player_id = ${playerId}
      AND created_at > NOW() - INTERVAL '7 days'
    `);

    const row = (stats.rows[0] as any);
    
    if (!row || row.matches_played === 0) {
      return null; // No matches this week
    }

    const avgAverage = parseFloat(row.avg_average || 0);
    const avgCheckout = parseFloat(row.avg_checkout || 0);
    const avgTreble = parseFloat(row.avg_treble || 0);

    // Generate contextual tips
    const tips: string[] = [];
    const recommendations: string[] = [];

    // Checkout tips
    if (avgCheckout < 20) {
      tips.push("🎯 Your checkout percentage this week was " + avgCheckout.toFixed(1) + "%");
      recommendations.push("Focus on finishing - practice your double outs consistently");
    } else if (avgCheckout < 30) {
      tips.push("💪 Checkout at " + avgCheckout.toFixed(1) + "% - getting better!");
      recommendations.push("You're improving - keep building consistency on your doubles");
    }

    // Treble tips
    if (avgTreble < 22) {
      tips.push("📊 Treble accuracy at " + avgTreble.toFixed(1) + "%");
      recommendations.push("Build treble zone accuracy with focused practice");
    }

    // Scoring tips
    if (avgAverage < 30) {
      recommendations.push("Work on scoring patterns - aim for higher-value areas early in your round");
    } else if (avgAverage > 50) {
      recommendations.push("Excellent scoring this week! Maintain your rhythm and focus");
    }

    // Consistency tips
    const consistency = row.best_average - row.worst_average;
    if (consistency > 30) {
      recommendations.push("Your form has been variable - find what works and repeat it");
    }

    // Build the message
    const title = "🎯 Your Weekly Coach Tip";
    const body = 
      (tips.length > 0 ? tips[0] : "Great effort this week!") + "\n\n" +
      recommendations[0];

    return {
      playerId,
      title,
      body,
      type: "coach_tip"
    };
  } catch (error) {
    logger.error("Error generating coach tips", { playerId, error });
    return null;
  }
}

/**
 * Send coach tips to all active players
 */
async function sendWeeklyCoachTips(): Promise<void> {
  try {
    logger.info("Starting weekly coach tips generation...");

    // Get all active players
    const players = await db.execute(sql`
      SELECT DISTINCT player_id 
      FROM matches 
      WHERE created_at > NOW() - INTERVAL '30 days'
      ORDER BY player_id
    `);

    let sent = 0;
    let skipped = 0;

    for (const playerRow of players.rows) {
      const playerId = (playerRow as any).player_id;

      // Check if player has opted in to coach tips
      const prefs = await db.execute(sql`
        SELECT coach_tips FROM notification_preferences WHERE player_id = ${playerId}
      `);

      const hasOptIn = (prefs.rows[0] as any)?.coach_tips !== false;

      if (!hasOptIn) {
        skipped++;
        continue;
      }

      // Generate tip
      const tip = await generateCoachTips(playerId);
      if (!tip) {
        skipped++;
        continue;
      }

      // Send as notification
      try {
        await createNotification({
          playerId,
          type: "coach_tip",
          title: tip.title,
          body: tip.body,
          data: {
            scheduledType: "weekly_coach_tip",
            sentAt: new Date().toISOString()
          }
        });
        sent++;
      } catch (error) {
        logger.error("Failed to send coach tip", { playerId, error });
      }
    }

    logger.info(`Weekly coach tips sent: ${sent} sent, ${skipped} skipped`);
  } catch (error) {
    logger.error("Error in sendWeeklyCoachTips", { error });
  }
}

/**
 * Initialize the coach tips scheduler
 * Runs every Sunday at 12:00 PM
 */
export function initializeCoachTipsScheduler(): void {
  try {
    // Cron pattern: 0 12 * * 0 = Every Sunday at 12:00 PM UTC
    const job = cron.schedule("0 12 * * 0", sendWeeklyCoachTips, {
      runOnInit: false // Don't run immediately
    });

    logger.info("Coach tips scheduler initialized (Sundays at 12:00 PM UTC)");

    // Expose for testing
    (global as any).TKDL_testCoachTips = sendWeeklyCoachTips;
  } catch (error) {
    logger.error("Failed to initialize coach tips scheduler", { error });
  }
}
