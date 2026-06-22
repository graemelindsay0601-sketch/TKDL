import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";

export const playerCurrencyTable = pgTable("player_currency", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().unique().references(() => playersTable.id),
  coinBalance: integer("coin_balance").notNull().default(0),
  lifetimeCoinsEarned: integer("lifetime_coins_earned").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPlayerCurrencySchema = createInsertSchema(playerCurrencyTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlayerCurrency = z.infer<typeof insertPlayerCurrencySchema>;
export type PlayerCurrency = typeof playerCurrencyTable.$inferSelect;
