import { pgTable, integer, timestamp } from "drizzle-orm/pg-core";
import { playersTable } from "./players";

export const cardClashPlayerSettingsTable = pgTable("card_clash_player_settings", {
  playerId: integer("player_id").notNull().primaryKey().references(() => playersTable.id),
  goodCardsPerMatch: integer("good_cards_per_match").notNull().default(2),
  badCardsPerMatch: integer("bad_cards_per_match").notNull().default(2),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type CardClashPlayerSettings = typeof cardClashPlayerSettingsTable.$inferSelect;
