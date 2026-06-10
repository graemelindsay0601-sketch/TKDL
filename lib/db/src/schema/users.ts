import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id:             serial("id").primaryKey(),
  username:       text("username").notNull().unique(),
  passwordHash:   text("password_hash").notNull(),
  playerId:       integer("player_id").notNull(),
  isAdmin:        boolean("is_admin").notNull().default(false),
  lastLoginAt:    timestamp("last_login_at", { withTimezone: true }),
  createdAt:      timestamp("created_at",    { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at",    { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
