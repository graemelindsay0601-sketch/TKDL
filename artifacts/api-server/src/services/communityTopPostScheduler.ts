/**
 * Off the Oche's weekly "Top of the Board" coin reward.
 *
 * Every hour, checks whether the most recently *completed* ISO week
 * (Monday–Sunday, server local time — see isoWeekStart() below) has had
 * its winner paid yet, and pays them if not.
 * Hourly rather than a single once-a-week cron so a Render sleep/restart
 * gap around the "right" moment doesn't just silently skip a week — if an
 * hourly tick is missed, the very next one still finds the same unpaid
 * week and pays it. Safety against double-paying doesn't come from the
 * schedule being exactly right (it can run as often as it likes) — it
 * comes from checking the currency_transactions ledger itself: this reward
 * always writes reason='community_top_post' with the paid week's
 * getIsoWeekKey() as `detail`, so "has this week already been paid" is a
 * direct, race-safe question to the ledger rather than a separately
 * tracked "last rewarded" flag that could itself drift out of sync.
 *
 * Winner = the approved manual post with the highest (reaction count +
 * comment count) created within that week — same score definition as the
 * client-side "Top of the board" sort and the server-side Wall of Fame
 * query. A week with no post scoring above zero is left unpaid rather than
 * rewarding an untouched post; it's simply never retried once the
 * following week becomes the new "most recently completed" one.
 */

import cron from "node-cron";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";
import { getIsoWeekKey } from "../lib/iso-week";
import { addCoinsToPlayer } from "./card-shop-service";
import { ensurePlayerCurrency } from "../lib/cardTablesMigration";
import { createNotification } from "../lib/communityNotify";

const TOP_POST_REWARD_COINS = 25;

// Midnight (server local time) of the Monday starting the ISO week that
// contains `date`. Deliberately mirrors getIsoWeekNumber/getIsoWeekYear's
// own local-time arithmetic in lib/iso-week.ts (setHours(0,0,0,0), getDay()
// || 7) rather than switching to UTC-specific methods — that guarantees
// every moment in [isoWeekStart(x), isoWeekStart(x) + 7 days) shares the
// exact same getIsoWeekKey() as x, so the boundary used to pick the winner
// always lines up with the key used to record the payment, regardless of
// what timezone the Node process actually runs in.
function isoWeekStart(date: Date): Date {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  const isoDay = d.getDay() || 7; // Mon=1 .. Sun=7
  d.setDate(d.getDate() - isoDay + 1);
  return d;
}

export async function checkAndPayCommunityTopPost(): Promise<{ paid: boolean; weekKey: number; playerId?: number }> {
  // Exactly 7 days back from now always lands on the same weekday in the
  // immediately preceding ISO week, regardless of year boundaries — no
  // separate "week - 1" arithmetic needed (see getIsoWeekKey's own header
  // comment for why that arithmetic is easy to get subtly wrong).
  const lastWeekAnchor = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weekKey = getIsoWeekKey(lastWeekAnchor);
  const weekStart = isoWeekStart(lastWeekAnchor);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const alreadyPaid = await db.execute(sql`
    SELECT 1 FROM currency_transactions
    WHERE reason = 'community_top_post' AND detail = ${String(weekKey)}
    LIMIT 1
  `);
  if (alreadyPaid.rows.length > 0) return { paid: false, weekKey };

  const winnerRows = await db.execute(sql`
    WITH scored AS (
      SELECT cp.id, cp.player_id,
             (COALESCE(r.reaction_count, 0) + COALESCE(c.comment_count, 0))::int AS score
      FROM community_posts cp
      LEFT JOIN (SELECT post_id, COUNT(*) AS reaction_count FROM post_reactions GROUP BY post_id) r ON r.post_id = cp.id
      LEFT JOIN (SELECT post_id, COUNT(*) AS comment_count  FROM post_comments  GROUP BY post_id) c ON c.post_id = cp.id
      WHERE cp.status = 'approved' AND cp.post_type = 'manual'
        AND cp.created_at >= ${weekStart} AND cp.created_at < ${weekEnd}
    )
    SELECT id, player_id, score FROM scored
    WHERE score > 0
    ORDER BY score DESC, id ASC
    LIMIT 1
  `);
  const winner = winnerRows.rows[0] as { id: number; player_id: number; score: number } | undefined;
  if (!winner) return { paid: false, weekKey };

  await ensurePlayerCurrency(winner.player_id);
  await addCoinsToPlayer(winner.player_id, TOP_POST_REWARD_COINS, "community_top_post", String(weekKey));

  void createNotification({
    playerId:   winner.player_id,
    type:       "top_post_reward",
    entityId:   winner.id,
    entityType: "post",
    message:    `🏆 Your post was Top of the Board last week! +${TOP_POST_REWARD_COINS} coins`,
  });

  logger.info({ weekKey, playerId: winner.player_id, score: winner.score }, "Community top-post reward paid");
  return { paid: true, weekKey, playerId: winner.player_id };
}

export function initializeCommunityTopPostScheduler(): void {
  try {
    // Cron pattern: 12 * * * * = every hour, at :12 — an arbitrary offset
    // away from the top of the hour, same reasoning as this codebase's
    // other non-daily schedulers spacing themselves out.
    cron.schedule("12 * * * *", async () => {
      try {
        const result = await checkAndPayCommunityTopPost();
        if (result.paid) {
          logger.info({ weekKey: result.weekKey, playerId: result.playerId }, "Community top-post reward run: paid");
        }
      } catch (err) {
        logger.error({ err }, "Community top-post reward check failed");
      }
    }, {
      runOnInit: false,
    });

    logger.info("Community top-post reward scheduler initialized (hourly at :12)");

    // Manual trigger for testing/backfill, same pattern as
    // rankSnapshotScheduler.ts's TKDL_testRankSnapshot.
    (global as any).TKDL_testCommunityTopPost = checkAndPayCommunityTopPost;
  } catch (err) {
    logger.error({ err }, "Failed to initialize community top-post reward scheduler");
  }
}
