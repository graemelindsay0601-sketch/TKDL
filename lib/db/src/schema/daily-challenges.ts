import { pgTable, serial, integer, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const dailyChallenges = pgTable("daily_challenges", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  challenge_key: text("challenge_key").notNull().unique(), // e.g., "x01_wins_2", "buy_packs_3"
  reward_coins: integer("reward_coins").notNull(),
  reward_pack_tokens: integer("reward_pack_tokens").default(0), // 0 means coins only
  requirement_type: text("requirement_type").notNull(), // "x01_wins", "cricket_wins", "packs_purchased", "coins_earned", etc.
  requirement_value: integer("requirement_value").notNull(), // how many
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const playerDailyChallenges = pgTable("player_daily_challenges", {
  id: serial("id").primaryKey(),
  player_id: integer("player_id").notNull(),
  challenge_id: integer("challenge_id").notNull(),
  progress: integer("progress").notNull().default(0), // how many completed
  is_completed: boolean("is_completed").notNull().default(false),
  completed_at: timestamp("completed_at"),
  date_assigned: timestamp("date_assigned").notNull().defaultNow(), // track which day this was assigned
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});
