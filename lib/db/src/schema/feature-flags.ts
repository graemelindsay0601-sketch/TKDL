import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const featureFlagsTable = pgTable("feature_flags", {
  id: serial("id").primaryKey(),
  featureName: text("feature_name").notNull().unique(), // card_shop, coins, card_clash
  enabled: boolean("enabled").notNull().default(false), // Live for everyone
  adminTestMode: boolean("admin_test_mode").notNull().default(false), // Accessible to admin only (overrides enabled=false)
  description: text("description"), // Human readable description
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFeatureFlagSchema = createInsertSchema(featureFlagsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;
export type FeatureFlag = typeof featureFlagsTable.$inferSelect;
