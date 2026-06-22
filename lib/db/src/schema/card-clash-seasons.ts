import { pgTable, serial, text, boolean, date, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cardClashSeasonsTable = pgTable("card_clash_seasons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // "June 2026 / July 2026"
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isLocked: boolean("is_locked").notNull().default(false), // Prevent changes after season ends
  totalMatches: integer("total_matches").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCardClashSeasonSchema = createInsertSchema(cardClashSeasonsTable).omit({
  id: true,
  totalMatches: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCardClashSeason = z.infer<typeof insertCardClashSeasonSchema>;
export type CardClashSeason = typeof cardClashSeasonsTable.$inferSelect;
