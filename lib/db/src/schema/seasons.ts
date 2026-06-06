import { pgTable, serial, text, boolean, date, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const seasonsTable = pgTable("seasons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }),
  isActive: boolean("is_active").notNull().default(true),
  championId: integer("champion_id"),
  championName: text("champion_name"),
  totalMatches: integer("total_matches").notNull().default(0),
  format: text("format").notNull().default("wager"),
  playoffPending: boolean("playoff_pending").notNull().default(false),
  notes: text("notes"),
});

export const insertSeasonSchema = createInsertSchema(seasonsTable).omit({ id: true, totalMatches: true });
export type InsertSeason = z.infer<typeof insertSeasonSchema>;
export type Season = typeof seasonsTable.$inferSelect;
