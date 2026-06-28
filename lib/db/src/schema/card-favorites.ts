import { pgTable, serial, integer, varchar, timestamp, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { playersTable } from "./players";

/**
 * Card Favorites Table
 * Allows players to favorite cards for quick access in Card Clash
 * - Favorites persist across sessions
 * - Players can see their favorites first when selecting equipment
 * - Max 20 favorites per player
 */
export const cardFavorites = pgTable(
  "card_favorites",
  {
    id: serial("id").primaryKey(),
    player_id: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
    card_id: varchar("card_id", { length: 50 }).notNull(), // Card ID from ALL_CARDS
    card_name: varchar("card_name", { length: 100 }).notNull(), // Card name for quick lookup
    game_mode: varchar("game_mode", { length: 20 }).notNull(), // X01 or CRICKET
    added_at: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => ({
    // Unique constraint: player can only favorite each card once per game mode
    unique_favorite: uniqueIndex("unique_card_favorite").on(
      table.player_id,
      table.card_id,
      table.game_mode
    ),
    // Index for fast lookup by player
    player_idx: uniqueIndex("card_favorites_player_idx").on(table.player_id),
  })
);

export type CardFavorite = typeof cardFavorites.$inferSelect;
export type NewCardFavorite = typeof cardFavorites.$inferInsert;
