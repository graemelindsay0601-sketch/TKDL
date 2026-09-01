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
    // Get player's stats for the past 7 days (both wins and losses).
    // This used to only read the winner_* columns, so every stat here
    // (checkout %, darts/turn, 180s) silently dropped to 0/null for any
    // match the player lost — a player who went 1-4 for the week got a tip
    // built from just their one win instead of all 5 matches. The parallel
    // loser_* columns (loser_checkout_hits/attempts, loser_darts,
    // loser_180s) already exist and are populated — practice.ts's
    // shadow-bot-stats route reads them the same way — so pull from
    // whichever side of the match this player was on.
    const stats = await db.execute(sql`
      SELECT
        COUNT(CASE WHEN winner_id = ${playerId} THEN 1 END) as wins,
        COUNT(CASE WHEN loser_id = ${playerId} THEN 1 END) as losses,

        -- Checkout stats (winner or loser side, whichever this player was)
        AVG(CASE
              WHEN winner_id = ${playerId} AND winner_checkout_attempts > 0
                THEN (winner_checkout_hits::float / winner_checkout_attempts * 100)
              WHEN loser_id = ${playerId} AND loser_checkout_attempts > 0
                THEN (loser_checkout_hits::float / loser_checkout_attempts * 100)
            END) as avg_checkout_pct,

        -- Darts per turn (lower is better)
        AVG(CASE
              WHEN winner_id = ${playerId} AND winner_darts > 0 THEN (winner_darts::float / 3)
              WHEN loser_id = ${playerId} AND loser_darts > 0 THEN (loser_darts::float / 3)
            END) as avg_darts_per_turn,

        -- 180s per match
        AVG(CASE
              WHEN winner_id = ${playerId} THEN winner_180s
              WHEN loser_id = ${playerId} THEN loser_180s
            END) as avg_180s
      FROM matches
      WHERE (winner_id = ${playerId} OR loser_id = ${playerId})
      AND played_at > NOW() - INTERVAL '7 days'
    `);

    const row = (stats.rows[0] as any);
    
    if (!row) {
      return null; // No matches this week
    }

    const wins = parseInt(row.wins || 0);
    const losses = parseInt(row.losses || 0);
    const totalMatches = wins + losses;

    if (totalMatches === 0) {
      return null; // No matches this week
    }

    const checkoutPct = parseFloat(row.avg_checkout_pct || 0);
    const dartsPerTurn = parseFloat(row.avg_darts_per_turn || 0);
    const avg180s = parseFloat(row.avg_180s || 0);
    const winRate = (wins / totalMatches * 100);

    // Generate contextual tips
    const tips: string[] = [];
    const recommendations: string[] = [];

    // Checkout tips
    if (checkoutPct < 20 && checkoutPct > 0) {
      tips.push("🎯 Checkout success at " + checkoutPct.toFixed(1) + "%");
      recommendations.push("Focus on finishing - practice your double outs");
    } else if (checkoutPct > 0 && checkoutPct < 30) {
      tips.push("💪 Checkout at " + checkoutPct.toFixed(1) + "% - good progress!");
      recommendations.push("Keep improving your doubles consistency");
    } else if (checkoutPct > 40) {
      tips.push("⭐ Excellent checkout technique at " + checkoutPct.toFixed(1) + "%!");
      recommendations.push("Your finishing is sharp - maintain this form");
    }

    // Scoring efficiency (darts per turn)
    if (dartsPerTurn > 0) {
      if (dartsPerTurn > 2.8) {
        recommendations.push("Try to be more aggressive early in your round - aim for trebles");
      } else if (dartsPerTurn < 2.3) {
        recommendations.push("Excellent scoring efficiency - you're hitting high-value areas");
      }
    }

    // 180s frequency
    if (avg180s > 0) {
      tips.push("🎯 Average " + avg180s.toFixed(1) + " maximum scores per match");
      if (avg180s < 0.5) {
        recommendations.push("Try to consistently hit the treble 20 area");
      }
    }

    // Win rate
    tips.push(`📊 Win rate: ${winRate.toFixed(0)}% (${wins}W-${losses}L this week)`);
    if (winRate < 40) {
      recommendations.push("Review your recent losses - identify patterns in what's not working");
    } else if (winRate > 70) {
      recommendations.push("Great form this week! Keep this momentum going");
    }

    // Build the message
    const title = "🎯 Your Weekly Coach Tip";
    const body = 
      (tips.length > 0 ? tips.slice(0, 2).join("\n") : "Great effort this week!") + "\n\n" +
      recommendations[0];

    return {
      playerId,
      title,
      body,
      type: "coach_tip"
    };
  } catch (error) {
    logger.error({ playerId, error }, "Error generating coach tips");
    return null;
  }
}

/**
 * Send coach tips to all active players
 */
async function sendWeeklyCoachTips(): Promise<void> {
  try {
    logger.info("Starting weekly coach tips generation...");

    // Get all active players (who have played in last 30 days)
    const players = await db.execute(sql`
      SELECT DISTINCT player_id FROM (
        SELECT winner_id as player_id FROM matches WHERE played_at > NOW() - INTERVAL '30 days'
        UNION
        SELECT loser_id as player_id FROM matches WHERE played_at > NOW() - INTERVAL '30 days'
      ) active_players
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
        logger.error({ playerId, error }, "Failed to send coach tip");
      }
    }

    logger.info(`Weekly coach tips sent: ${sent} sent, ${skipped} skipped`);
  } catch (error) {
    logger.error({ error }, "Error in sendWeeklyCoachTips");
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
    logger.error({ error }, "Failed to initialize coach tips scheduler");
  }
}
