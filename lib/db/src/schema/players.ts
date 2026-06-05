import { pgTable, serial, text, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nickname: text("nickname"),
  avatarInitials: text("avatar_initials").notNull().default(""),
  elo: integer("elo").notNull().default(1000),
  tier: text("tier").notNull().default("Bronze"),
  careerWins: integer("career_wins").notNull().default(0),
  careerLosses: integer("career_losses").notNull().default(0),
  careerGamesPlayed: integer("career_games_played").notNull().default(0),
  careerWinRate: real("career_win_rate").notNull().default(0),
  currentSeasonPoints: integer("current_season_points").notNull().default(0),
  currentSeasonWins: integer("current_season_wins").notNull().default(0),
  currentSeasonLosses: integer("current_season_losses").notNull().default(0),
  longestWinStreak: integer("longest_win_streak").notNull().default(0),
  currentWinStreak: integer("current_win_streak").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  careerWins: true,
  careerLosses: true,
  careerGamesPlayed: true,
  careerWinRate: true,
  currentSeasonPoints: true,
  currentSeasonWins: true,
  currentSeasonLosses: true,
  longestWinStreak: true,
  currentWinStreak: true,
  elo: true,
  tier: true,
});

export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
