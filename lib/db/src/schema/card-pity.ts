import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";

export const cardPityTable = pgTable("card_pity_system", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().unique().references(() => playersTable.id),
  pullsSinceLegendary: integer("pulls_since_legendary").notNull().default(0),
  lastLegendaryPullId: integer("last_legendary_pull_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCardPitySchema = createInsertSchema(cardPityTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCardPity = z.infer<typeof insertCardPitySchema>;
export type CardPity = typeof cardPityTable.$inferSelect;
