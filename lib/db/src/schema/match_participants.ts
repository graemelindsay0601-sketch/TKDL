import { pgTable, serial, integer, text, index, boolean } from "drizzle-orm/pg-core";

export const matchParticipantsTable = pgTable("match_participants", {
  id:         serial("id").primaryKey(),
  matchId:    integer("match_id").notNull(),
  playerId:   integer("player_id").notNull(),
  playerName: text("player_name").notNull(),
  team:       text("team").notNull(),
  position:   integer("position").notNull().default(0),
  // Nullable for legacy rows created before exact rollback data existed.
  pointsDelta:       integer("points_delta"),
  eloDelta:          integer("elo_delta"),
  causedElimination: boolean("caused_elimination"),
}, (t) => [
  index("mp_match_id_idx").on(t.matchId),
  index("mp_player_id_idx").on(t.playerId),
]);

export type MatchParticipant = typeof matchParticipantsTable.$inferSelect;
