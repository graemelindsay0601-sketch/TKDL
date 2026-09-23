import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";

// Two cosmetic slots today: a colour/gradient treatment for a player's
// displayed name (rendered wherever their name shows large — their own
// account page and their player-detail page, as seen by anyone else), and
// the icon shown in the avatar square on their own account page. Both spend
// from the same shared coin balance (player_currency.card_points) that
// match wins, achievements etc. already earn app-wide — this is a new
// place to spend that balance, alongside the existing Card Clash pack
// shop, not a second currency.
export const COSMETIC_CATEGORIES = ["NAME_STYLE", "PROFILE_ICON"] as const;
export type CosmeticCategory = (typeof COSMETIC_CATEGORIES)[number];

export const cosmeticDefinitionsTable = pgTable("cosmetic_definitions", {
  id: text("id").primaryKey(), // stable slug, e.g. "name-inferno"
  category: text("category").notNull(), // NAME_STYLE | PROFILE_ICON
  name: text("name").notNull(),
  rarity: text("rarity").notNull().default("COMMON"), // COMMON, RARE, EPIC, LEGENDARY — same vocabulary as the titles system
  price: integer("price").notNull(),
  // NAME_STYLE payload — a solid colour, or a CSS gradient string (used for
  // a gradient-text treatment), plus an optional glow colour.
  color: text("color"),
  gradient: text("gradient"),
  glow: text("glow"),
  // PROFILE_ICON payload — a key into a small whitelisted lucide-icon map
  // on the frontend. Never raw markup or a URL from this table.
  iconKey: text("icon_key"),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playerCosmeticsTable = pgTable("player_cosmetics", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  cosmeticId: text("cosmetic_id").notNull().references(() => cosmeticDefinitionsTable.id),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCosmeticDefinitionSchema = createInsertSchema(cosmeticDefinitionsTable).omit({
  createdAt: true,
});
export const insertPlayerCosmeticSchema = createInsertSchema(playerCosmeticsTable).omit({
  id: true,
  purchasedAt: true,
});

export type InsertCosmeticDefinition = z.infer<typeof insertCosmeticDefinitionSchema>;
export type CosmeticDefinition = typeof cosmeticDefinitionsTable.$inferSelect;
export type InsertPlayerCosmetic = z.infer<typeof insertPlayerCosmeticSchema>;
export type PlayerCosmetic = typeof playerCosmeticsTable.$inferSelect;
