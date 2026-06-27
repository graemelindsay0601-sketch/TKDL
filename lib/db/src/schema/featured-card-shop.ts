import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { playersTable, cardDefinitionsTable } from "./index";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Featured cards in the daily shop rotation
 * Resets daily with 3 random cards at varying rarities
 */
export const featuredCardShopTable = pgTable("featured_card_shop", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => cardDefinitionsTable.id),
  slotNumber: integer("slot_number").notNull(), // 1, 2, or 3
  priceCoins: integer("price_coins").notNull(),
  rotationDate: timestamp("rotation_date", { withTimezone: true }).notNull(), // Date this rotation started
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

/**
 * Track purchases from featured shop (for analytics/audit)
 */
export const shopPurchaseHistoryTable = pgTable("shop_purchase_history", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  cardId: integer("card_id").notNull().references(() => cardDefinitionsTable.id),
  slotNumber: integer("slot_number").notNull(),
  priceCoins: integer("price_coins").notNull(),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFeaturedCardShopSchema = createInsertSchema(featuredCardShopTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShopPurchaseHistorySchema = createInsertSchema(shopPurchaseHistoryTable).omit({
  id: true,
  purchasedAt: true,
});

export type FeaturedCardShop = typeof featuredCardShopTable.$inferSelect;
export type InsertFeaturedCardShop = z.infer<typeof insertFeaturedCardShopSchema>;
export type ShopPurchaseHistory = typeof shopPurchaseHistoryTable.$inferSelect;
export type InsertShopPurchaseHistory = z.infer<typeof insertShopPurchaseHistorySchema>;
