import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const weeklyChallenges = pgTable("weekly_challenges", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  challenge_key: text("challenge_key").notNull().unique(), // e.g., "x01_wins_5", "matches_10"
  reward_coins: integer("reward_coins").notNull(),
  reward_pack_tokens: integer("reward_pack_tokens").default(0), // 0 means coins only
  requirement_type: text("requirement_type").notNull(), // "total_wins", "total_matches", "card_clash_wins", etc.
  requirement_value: integer("requirement_value").notNull(), // how many
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const playerWeeklyChallenges = pgTable("player_weekly_challenges", {
  id: serial("id").primaryKey(),
  player_id: integer("player_id").notNull(),
  challenge_id: integer("challenge_id").notNull(),
  challenge_key: text("challenge_key").notNull(), // denormalized for easier querying
  progress: integer("progress").notNull().default(0), // how many completed
  is_completed: boolean("is_completed").notNull().default(false),
  completed_at: timestamp("completed_at"),
  week_number: integer("week_number").notNull(), // ISO week number (1-53) — NOT unique across years on its own, see week_year
  week_year: integer("week_year"), // ISO week-year pairing with week_number (see lib/iso-week.ts's getIsoWeekYear) — nullable for rows written before this column existed; add_weekly_challenge_year.ts backfills it
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});
