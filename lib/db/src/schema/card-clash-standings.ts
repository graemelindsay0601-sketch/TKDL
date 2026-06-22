import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";
import { cardClashSeasonsTable } from "./card-clash-seasons";

export const cardClashStandingsTable = pgTable("card_clash_standings", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id").notNull().references(() => cardClashSeasonsTable.id),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  cardPoints: integer("card_points").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  cardsOwnedCount: integer("cards_owned_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCardClashStandingsSchema = createInsertSchema(cardClashStandingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCardClashStandings = z.infer<typeof insertCardClashStandingsSchema>;
export type CardClashStandings = typeof cardClashStandingsTable.$inferSelect;
