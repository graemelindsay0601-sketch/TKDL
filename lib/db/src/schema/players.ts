import { pgTable, serial, text, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  elo: integer("elo").notNull().default(1000),
  points: integer("points").notNull().default(25),
  peakPoints: integer("peak_points").notNull().default(25),
  seasonWins: integer("season_wins").notNull().default(0),
  seasonLosses: integer("season_losses").notNull().default(0),
  seasonGamesPlayed: integer("season_games_played").notNull().default(0),
  careerWins: integer("career_wins").notNull().default(0),
  careerLosses: integer("career_losses").notNull().default(0),
  careerGamesPlayed: integer("career_games_played").notNull().default(0),
  careerPoints: integer("career_points").notNull().default(0),
  careerPeakElo: integer("career_peak_elo").notNull().default(1000),
  currentWinStreak: integer("current_win_streak").notNull().default(0),
  longestWinStreak: integer("longest_win_streak").notNull().default(0),
  currentLossStreak: integer("current_loss_streak").notNull().default(0),
  eliminationsCount: integer("eliminations_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  practiceEnabled:  boolean("practice_enabled").notNull().default(true),
  tourEnabled:      boolean("tour_enabled").notNull().default(true),
  m501Enabled:      boolean("m501_enabled").notNull().default(true),
  shadowBotEnabled: boolean("shadow_bot_enabled").notNull().default(true),
  lastFreePackClaimTime: timestamp("last_free_pack_claim_time", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
