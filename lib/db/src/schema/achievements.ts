import { pgTable, serial, text, integer, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const achievementsTable = pgTable("achievements", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("🏆"),
  rarity: text("rarity").notNull().default("Common"),
  category: text("category").notNull().default("Career"),
  hidden: boolean("hidden").notNull().default(false),
  priority: integer("priority").notNull().default(20),
  criteriaType: text("criteria_type").notNull(),
  criteriaValue: integer("criteria_value").notNull().default(1),
  engineType: text("engine_type").notNull().default("STAT_BASED"),
  secondaryCriteria: text("secondary_criteria"),
  secondaryValue: integer("secondary_value"),
  coinReward: integer("coin_reward").notNull().default(0),
  packReward: text("pack_reward"), // 'SINGLE' | 'FIVE' | 'TEN'
});

export const playerAchievementsTable = pgTable("player_achievements", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  achievementId: integer("achievement_id").notNull(),
  // 0 = lifetime/one-time achievement (the vast majority). A real season id
  // marks one unlock of a genuinely repeatable seasonal achievement (Season
  // MVP, Climber, etc.) for that specific season, so the same player can
  // earn it again in a later season instead of it being a once-ever badge.
  seasonId: integer("season_id").notNull().default(0),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("pa_player_id_idx").on(t.playerId),
  index("pa_achievement_id_idx").on(t.achievementId),
  // A player can only unlock a given achievement once per season (season 0
  // for lifetime achievements, meaning "once ever") — this is also relied
  // on (as idx_player_achievements_unique_seasonal, created idempotently at
  // boot in db/migrations/add_achievement_season_column.ts) to make
  // grantIfNotHas's onConflictDoNothing() an atomic guard against
  // double-granting.
  uniqueIndex("pa_player_achievement_unique").on(t.playerId, t.achievementId, t.seasonId),
]);

export const seasonStandingsTable = pgTable("season_standings", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id").notNull(),
  playerId: integer("player_id").notNull(),
  position: integer("position").notNull(),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  points: integer("points").notNull().default(0),
  elo: integer("elo").notNull().default(1000),
  isChampion: boolean("is_champion").notNull().default(false),
}, (t) => [
  index("ss_season_id_idx").on(t.seasonId),
  index("ss_player_id_idx").on(t.playerId),
]);

export const insertAchievementSchema = createInsertSchema(achievementsTable).omit({ id: true });
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type Achievement = typeof achievementsTable.$inferSelect;

export const insertPlayerAchievementSchema = createInsertSchema(playerAchievementsTable).omit({ id: true, unlockedAt: true });
export type InsertPlayerAchievement = z.infer<typeof insertPlayerAchievementSchema>;
export type PlayerAchievement = typeof playerAchievementsTable.$inferSelect;
