import { pgTable, serial, integer, uuid, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";
import { cardDefinitionsTable } from "./card-definitions";

export const cardInventoryTable = pgTable("player_card_inventory", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  cardId: uuid("card_id").notNull().references(() => cardDefinitionsTable.cardId),
  quantity: integer("quantity").notNull().default(1),
  isFavorite: boolean("is_favorite").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCardInventorySchema = createInsertSchema(cardInventoryTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCardInventory = z.infer<typeof insertCardInventorySchema>;
export type CardInventory = typeof cardInventoryTable.$inferSelect;
