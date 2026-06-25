import { pgTable, serial, text, integer, uuid, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cardDefinitionsTable = pgTable("card_definitions", {
  id: serial("id").primaryKey(),
  cardId: uuid("card_id").notNull().unique().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  gameMode: text("game_mode").notNull(), // X01, CRICKET, WILDCARD
  cardType: text("card_type").notNull(), // GOOD, BAD
  rarity: text("rarity").notNull(), // COMMON, RARE, LEGENDARY
  effect: text("effect").notNull(), // Detailed effect text
  imageUrl: text("image_url"), // AI-generated image URL
  gridIndex: integer("grid_index"), // 0-19 position in grid for image extraction
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCardDefinitionSchema = createInsertSchema(cardDefinitionsTable).omit({
  id: true,
  cardId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCardDefinition = z.infer<typeof insertCardDefinitionSchema>;
export type CardDefinition = typeof cardDefinitionsTable.$inferSelect;
