import { db } from "@workspace/db";
import { achievementsTable, playerAchievementsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import { createNotification } from "./communityNotify";
import { addCoinsToPlayer } from "../services/card-shop-service";
import { ensurePlayerCurrency } from "./cardTablesMigration";

/**
 * Single, race-safe achievement-granting path for every system that stores
 * unlocks in the shared `achievementsTable`/`playerAchievementsTable` pair
 * (core/Career, Practice, Master501, Format-and-Meme — everything seeded
 * from `ACHIEVEMENT_DEFINITIONS`).
 *
 * Before this existed, Master501 and Practice each carried their own
 * near-identical copy of this function — a plain SELECT-then-INSERT with no
 * conflict guard, so two rapid-fire session completions could both pass the
 * "do I already have this" check and both insert, double-granting the
 * achievement and double-paying its coin/pack reward. Only the original
 * core copy (now this one) was actually race-safe. There's one grant path
 * now, and it's the safe one.
 *
 * @param seasonId 0 (default) for a lifetime/one-time achievement — the vast
 *   majority. Pass the real season id for a `repeatable: true` seasonal
 *   achievement (Season MVP, Climber, etc.) so it can be earned again in a
 *   later season instead of only ever once per player.
 */
export async function grantIfNotHas(playerId: number, key: string, seasonId = 0): Promise<boolean> {
  const [ach] = await db.select().from(achievementsTable).where(eq(achievementsTable.key, key));
  if (!ach) return false;

  const [existing] = await db.select({ id: playerAchievementsTable.id })
    .from(playerAchievementsTable)
    .where(and(
      eq(playerAchievementsTable.playerId, playerId),
      eq(playerAchievementsTable.achievementId, ach.id),
      eq(playerAchievementsTable.seasonId, seasonId)
    ));
  if (existing) return false;

  // The SELECT above is just a fast-path early exit — it can't stop two
  // concurrent calls for the same player+achievement+season both passing
  // it. The insert itself is the real guard: onConflictDoNothing (backed by
  // the idx_player_achievements_unique_seasonal index) makes the grant
  // atomic, so at most one of two racing calls actually inserts a row and
  // only that one goes on to award rewards/notify.
  const [inserted] = await db.insert(playerAchievementsTable)
    .values({ playerId, achievementId: ach.id, seasonId })
    .onConflictDoNothing()
    .returning({ id: playerAchievementsTable.id });
  if (!inserted) return false;

  logger.info({ playerId, key }, "Achievement unlocked");
  await awardAchievementRewards(playerId, ach.coinReward, ach.packReward, key);

  void createNotification({
    playerId,
    type:       "achievement_unlocked",
    entityId:   ach.id,
    entityType: "achievement",
    message:    `${ach.icon ?? "🏆"} Achievement unlocked: ${ach.name}`,
  });
  return true;
}

/**
 * Awards an achievement's coin/pack reward, reading the amounts straight off
 * the achievementsTable row (kept in sync with ACHIEVEMENT_DEFINITIONS by
 * seedAchievements()) rather than a second, separately-maintained lookup —
 * there was previously a whole second copy of every reward amount in
 * achievement-rewards.ts (an auto-generated leftover from an earlier,
 * abandoned pass) that could silently drift from the real definitions.
 *
 * Coins go through addCoinsToPlayer, the app's one atomic increment-in-place
 * currency update (the old core implementation instead did its own
 * read-then-write on playerCurrencyTable, which had exactly the same kind of
 * race a concurrent reward could hit). A pack reward is inserted as a real,
 * ready-to-open pack row in card_clash_pack_inventory — the same table (and
 * the same shape) a purchased pack becomes, and the same thing Master501 and
 * Practice's achievements already granted — rather than crediting the
 * separate spendable "pack token" balance the old core implementation used,
 * which needed an extra purchase step before it became an actual pack.
 */
export async function awardAchievementRewards(
  playerId: number,
  coinReward: number | null,
  packReward: string | null,
  achievementKey: string,
): Promise<void> {
  try {
    if (coinReward && coinReward > 0) {
      await ensurePlayerCurrency(playerId);
      await addCoinsToPlayer(playerId, coinReward);
    }
    if (packReward) {
      await db.execute(sql`
        INSERT INTO card_clash_pack_inventory (player_id, pack_type, earned_reason)
        VALUES (${playerId}, ${packReward}, ${"ACHIEVEMENT:" + achievementKey})
      `);
    }
    if (coinReward || packReward) {
      logger.info({ playerId, achievementKey, coins: coinReward, pack: packReward }, "Achievement reward granted");
    }
  } catch (err) {
    logger.error({ playerId, achievementKey, err }, "Failed to award achievement rewards");
  }
}
