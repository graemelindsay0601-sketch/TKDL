import { pgTable, integer, timestamp } from "drizzle-orm/pg-core";
import { playersTable } from "./players";

/**
 * Card Clash Leaderboard - all-time standings
 * No seasons, no resets - just persistent win/loss tracking
 */
export const cardClashLeaderboardTable = pgTable("card_clash_leaderboard", {
  playerId: integer("player_id")
    .notNull()
    .unique()
    .references(() => playersTable.id, { onDelete: "cascade" }),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  cardsUnlockedCount: integer("cards_unlocked_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type CardClashLeaderboard = typeof cardClashLeaderboardTable.$inferSelect;
export type InsertCardClashLeaderboard = typeof cardClashLeaderboardTable.$inferInsert;
