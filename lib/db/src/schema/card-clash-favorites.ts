import { pgTable, serial, varchar, integer, timestamp } from 'drizzle-orm/pg-core';
import { playersTable } from './players';

export const cardClashFavoritesTable = pgTable('card_clash_favorites', {
  id: serial('id').primaryKey(),
  playerId: integer('player_id').notNull().references(() => playersTable.id, { onDelete: 'cascade' }),
  cardId: varchar('card_id', { length: 50 }).notNull(),
  cardName: varchar('card_name', { length: 100 }),
  gameMode: varchar('game_mode', { length: 20 }).notNull().default('X01'),
  addedAt: timestamp('added_at').notNull().defaultNow(),
}, (table) => ({
  // Unique constraint: one favorite per card per game mode per player
  unique: () => [table.playerId, table.cardId, table.gameMode],
  // Index for faster lookups
  playerGameModeIdx: () => [table.playerId, table.gameMode],
}));

export type CardClashFavorite = typeof cardClashFavoritesTable.$inferSelect;
export type NewCardClashFavorite = typeof cardClashFavoritesTable.$inferInsert;
