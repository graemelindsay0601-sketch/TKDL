import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const seasonalQuests = pgTable("seasonal_quests", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  quest_key: text("quest_key").notNull().unique(), // e.g., "season_clash_wins_20", "league_dominator"
  reward_coins: integer("reward_coins").notNull(),
  reward_pack_tokens: integer("reward_pack_tokens").default(0), // pack tokens as alternative reward
  requirement_type: text("requirement_type").notNull(), // "card_clash_wins", "total_wins", "coin_earned", etc.
  requirement_value: integer("requirement_value").notNull(), // how many
  is_active: boolean("is_active").notNull().default(true),
  tier: integer("tier").notNull().default(1), // 1-3 for progression (optional)
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const playerSeasonalQuests = pgTable("player_seasonal_quests", {
  id: serial("id").primaryKey(),
  player_id: integer("player_id").notNull(),
  season_id: integer("season_id").notNull(), // which season this quest is for
  quest_id: integer("quest_id").notNull(),
  quest_key: text("quest_key").notNull(), // denormalized
  progress: integer("progress").notNull().default(0), // how many completed
  is_completed: boolean("is_completed").notNull().default(false),
  completed_at: timestamp("completed_at"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});
