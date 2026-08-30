import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id").notNull(),
  winnerId: integer("winner_id").notNull(),
  loserId: integer("loser_id").notNull(),
  winnerName: text("winner_name").notNull(),
  loserName: text("loser_name").notNull(),
  stake: integer("stake").notNull().default(0),
  eloChange: integer("elo_change").notNull().default(16),
  gameType: text("game_type").notNull().default("501"),
  notes: text("notes"),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull().defaultNow(),
  winnerDarts:             integer("winner_darts"),
  winner100s:              integer("winner_100s"),
  winner140s:              integer("winner_140s"),
  winner170s:              integer("winner_170s"),
  winner180s:              integer("winner_180s"),
  winnerCheckoutAttempts:  integer("winner_checkout_attempts"),
  winnerCheckoutHits:      integer("winner_checkout_hits"),
  loserDarts:              integer("loser_darts"),
  loser100s:               integer("loser_100s"),
  loser140s:               integer("loser_140s"),
  loser170s:               integer("loser_170s"),
  loser180s:               integer("loser_180s"),
  loserCheckoutAttempts:   integer("loser_checkout_attempts"),
  loserCheckoutHits:       integer("loser_checkout_hits"),
}, (t) => [
  index("matches_season_id_idx").on(t.seasonId),
  index("matches_winner_id_idx").on(t.winnerId),
  index("matches_loser_id_idx").on(t.loserId),
  index("matches_played_at_idx").on(t.playedAt),
]);

export const insertMatchSchema = createInsertSchema(matchesTable).omit({
  id: true,
  playedAt: true,
  winnerName: true,
  loserName: true,
  eloChange: true,
  seasonId: true,
});

export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;
