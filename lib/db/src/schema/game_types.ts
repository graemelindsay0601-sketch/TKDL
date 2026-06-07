import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const gameTypesTable = pgTable("game_types", {
  id:          serial("id").primaryKey(),
  key:         text("key").notNull().unique(),
  name:        text("name").notNull(),
  engine:      text("engine").notNull(),
  category:    text("category").notNull().default("competitive"),
  description: text("description").default(""),
  config:      text("config").notNull().default("{}"),
  enabled:     boolean("enabled").notNull().default(true),
  sortOrder:   integer("sort_order").notNull().default(0),
  rulesText:   text("rules_text"),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type GameType = typeof gameTypesTable.$inferSelect;
export type InsertGameType = typeof gameTypesTable.$inferInsert;
