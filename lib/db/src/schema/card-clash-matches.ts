import { pgTable, serial, integer, text, json, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";

/**
 * Card Clash Matches - Standalone game mode (no seasons)
 * Tracks individual matches between players with equipped cards and results
 */
export const cardClashMatchesTable = pgTable("card_clash_matches", {
  id: serial("id").primaryKey(),
  matchId: uuid("match_id").notNull().unique().defaultRandom(),
  seasonId: integer("season_id").references(() => cardClashSeasonsTable.id), // Nullable - Card Clash is standalone
  gameMode: text("game_mode").notNull(), // X01, CRICKET
  player1Id: integer("player_1_id").notNull().references(() => playersTable.id),
  player2Id: integer("player_2_id").notNull().references(() => playersTable.id),
  winnerId: integer("winner_id").references(() => playersTable.id), // Nullable - set when match finishes
  player1EquippedCards: json("player_1_equipped_cards").notNull().default([]), // [{ cardId, cardType }]
  player2EquippedCards: json("player_2_equipped_cards").notNull().default([]),
  cardsUsedInMatch: json("cards_used_in_match").notNull().default([]), // [{ cardId, usedBy, turn }]
  player1PointsEarned: integer("player_1_points_earned").notNull().default(0),
  player2PointsEarned: integer("player_2_points_earned").notNull().default(0),
  isMock: integer("is_mock").notNull().default(0), // 1 = mock game, 0 = real match
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCardClashMatchesSchema = createInsertSchema(cardClashMatchesTable).omit({
  id: true,
  matchId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCardClashMatches = z.infer<typeof insertCardClashMatchesSchema>;
export type CardClashMatches = typeof cardClashMatchesTable.$inferSelect;
