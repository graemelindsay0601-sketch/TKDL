import { db } from "@workspace/db";
import { achievementsTable, playerAchievementsTable, playersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

export const ACHIEVEMENT_DEFINITIONS = [
  { key: "first_win", name: "First Blood", description: "Win your very first match", icon: "target", rarity: "common", threshold: 1 },
  { key: "wins_5", name: "Getting Started", description: "Win 5 matches", icon: "zap", rarity: "common", threshold: 5 },
  { key: "wins_10", name: "On a Roll", description: "Win 10 matches", icon: "trending-up", rarity: "common", threshold: 10 },
  { key: "wins_25", name: "Seasoned Player", description: "Win 25 matches", icon: "star", rarity: "rare", threshold: 25 },
  { key: "wins_50", name: "Half Century", description: "Win 50 matches", icon: "award", rarity: "rare", threshold: 50 },
  { key: "wins_100", name: "Century Club", description: "Win 100 matches", icon: "crown", rarity: "epic", threshold: 100 },
  { key: "streak_3", name: "Hat Trick", description: "Win 3 matches in a row", icon: "flame", rarity: "common", threshold: 3 },
  { key: "streak_5", name: "On Fire", description: "Win 5 matches in a row", icon: "flame", rarity: "rare", threshold: 5 },
  { key: "streak_10", name: "Unstoppable", description: "Win 10 matches in a row", icon: "lightning", rarity: "epic", threshold: 10 },
  { key: "elo_1100", name: "Silver Standard", description: "Reach 1100 Elo", icon: "medal", rarity: "common", threshold: 1100 },
  { key: "elo_1250", name: "Golden Age", description: "Reach 1250 Elo", icon: "medal", rarity: "rare", threshold: 1250 },
  { key: "elo_1400", name: "Diamond League", description: "Reach 1400 Elo", icon: "gem", rarity: "epic", threshold: 1400 },
  { key: "elo_1600", name: "Untouchable", description: "Reach 1600 Elo", icon: "gem", rarity: "legendary", threshold: 1600 },
  { key: "champion", name: "Season Champion", description: "Finish first in a season", icon: "trophy", rarity: "legendary", threshold: null },
  { key: "games_played_50", name: "Committed", description: "Play 50 matches total", icon: "calendar", rarity: "rare", threshold: 50 },
];

export async function seedAchievements() {
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    const existing = await db.select().from(achievementsTable).where(eq(achievementsTable.key, def.key));
    if (existing.length === 0) {
      await db.insert(achievementsTable).values(def);
    }
  }
}

async function grantIfNotHas(playerId: number, key: string) {
  const [ach] = await db.select().from(achievementsTable).where(eq(achievementsTable.key, key));
  if (!ach) return;
  const existing = await db.select().from(playerAchievementsTable).where(
    and(eq(playerAchievementsTable.playerId, playerId), eq(playerAchievementsTable.achievementId, ach.id))
  );
  if (existing.length === 0) {
    await db.insert(playerAchievementsTable).values({ playerId, achievementId: ach.id });
    logger.info({ playerId, key }, "Achievement unlocked");
  }
}

export async function checkAndGrantAchievements(playerId: number, isWin: boolean) {
  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
  if (!player) return;

  if (isWin) {
    if (player.careerWins >= 1)   await grantIfNotHas(playerId, "first_win");
    if (player.careerWins >= 5)   await grantIfNotHas(playerId, "wins_5");
    if (player.careerWins >= 10)  await grantIfNotHas(playerId, "wins_10");
    if (player.careerWins >= 25)  await grantIfNotHas(playerId, "wins_25");
    if (player.careerWins >= 50)  await grantIfNotHas(playerId, "wins_50");
    if (player.careerWins >= 100) await grantIfNotHas(playerId, "wins_100");
    if (player.currentWinStreak >= 3)  await grantIfNotHas(playerId, "streak_3");
    if (player.currentWinStreak >= 5)  await grantIfNotHas(playerId, "streak_5");
    if (player.currentWinStreak >= 10) await grantIfNotHas(playerId, "streak_10");
  }

  if (player.careerGamesPlayed >= 50) await grantIfNotHas(playerId, "games_played_50");
  if (player.elo >= 1100) await grantIfNotHas(playerId, "elo_1100");
  if (player.elo >= 1250) await grantIfNotHas(playerId, "elo_1250");
  if (player.elo >= 1400) await grantIfNotHas(playerId, "elo_1400");
  if (player.elo >= 1600) await grantIfNotHas(playerId, "elo_1600");
}
