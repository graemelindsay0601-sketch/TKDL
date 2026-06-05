import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id").notNull(),
  winnerId: integer("winner_id").notNull(),
  loserId: integer("loser_id").notNull(),
  winnerName: text("winner_name").notNull(),
  loserName: text("loser_name").notNull(),
  pointsAwarded: integer("points_awarded").notNull().default(3),
  eloChange: integer("elo_change").notNull().default(20),
  notes: text("notes"),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMatchSchema = createInsertSchema(matchesTable).omit({
  id: true,
  playedAt: true,
  winnerName: true,
  loserName: true,
  pointsAwarded: true,
  eloChange: true,
  seasonId: true,
});

export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;
