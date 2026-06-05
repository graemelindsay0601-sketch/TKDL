import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const achievementsTable = pgTable("achievements", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("trophy"),
  rarity: text("rarity").notNull().default("common"),
  threshold: integer("threshold"),
});

export const playerAchievementsTable = pgTable("player_achievements", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  achievementId: integer("achievement_id").notNull(),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const seasonStandingsTable = pgTable("season_standings", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id").notNull(),
  playerId: integer("player_id").notNull(),
  position: integer("position").notNull(),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  points: integer("points").notNull().default(0),
  isChampion: integer("is_champion").notNull().default(0),
});

export const insertAchievementSchema = createInsertSchema(achievementsTable).omit({ id: true });
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type Achievement = typeof achievementsTable.$inferSelect;

export const insertPlayerAchievementSchema = createInsertSchema(playerAchievementsTable).omit({ id: true, unlockedAt: true });
export type InsertPlayerAchievement = z.infer<typeof insertPlayerAchievementSchema>;
export type PlayerAchievement = typeof playerAchievementsTable.$inferSelect;
