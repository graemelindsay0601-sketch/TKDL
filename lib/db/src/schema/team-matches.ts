import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const teamMatchesTable = pgTable("team_matches", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id").notNull(),
  gameType: text("game_type").notNull().default("501"),
  stakePerPerson: integer("stake_per_person").notNull().default(0),
  teamSize: integer("team_size").notNull().default(2),
  notes: text("notes"),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamMatchParticipantsTable = pgTable("team_match_participants", {
  id: serial("id").primaryKey(),
  teamMatchId: integer("team_match_id").notNull(),
  playerId: integer("player_id").notNull(),
  playerName: text("player_name").notNull(),
  team: integer("team").notNull(),
  eloChange: integer("elo_change").notNull().default(0),
  pointsChange: integer("points_change").notNull().default(0),
});

export type TeamMatch = typeof teamMatchesTable.$inferSelect;
export type TeamMatchParticipant = typeof teamMatchParticipantsTable.$inferSelect;
