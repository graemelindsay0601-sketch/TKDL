import { pgTable, serial, integer, timestamp, date } from "drizzle-orm/pg-core";

export const playerLoginStreaks = pgTable("player_login_streaks", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  currentStreak: integer("current_streak").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
  lastLoginDate: date("last_login_date"),
  totalLogins: integer("total_logins").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
