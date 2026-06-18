import { pgTable, serial, integer, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const practiceSessionsTable = pgTable("practice_sessions", {
  id:                  serial("id").primaryKey(),
  player1Id:           integer("player1_id"),
  player2Id:           integer("player2_id"),
  gameTypeKey:         text("game_type_key").notNull(),
  gameTypeName:        text("game_type_name").notNull(),
  winnerIdx:           integer("winner_idx"),
  detail:              text("detail"),
  dartsThrown:         integer("darts_thrown"),
  durationSeconds:     integer("duration_seconds"),
  sessionData:         jsonb("session_data"),
  createdAt:           timestamp("created_at", { withTimezone: true }).defaultNow(),
  p1Darts:             integer("p1_darts"),
  p1Score:             integer("p1_score"),
  p1_180s:             integer("p1_180s").default(0),
  p1CheckoutAttempts:  integer("p1_checkout_attempts").default(0),
  p1CheckoutHits:      integer("p1_checkout_hits").default(0),
  p2Darts:             integer("p2_darts"),
  p2Score:             integer("p2_score"),
  p2_180s:             integer("p2_180s").default(0),
  p2CheckoutAttempts:  integer("p2_checkout_attempts").default(0),
  p2CheckoutHits:      integer("p2_checkout_hits").default(0),
}, (t) => [
  index("ps_player1_id_idx").on(t.player1Id),
  index("ps_player2_id_idx").on(t.player2Id),
  index("ps_created_at_idx").on(t.createdAt),
]);

export type PracticeSession = typeof practiceSessionsTable.$inferSelect;
export type InsertPracticeSession = typeof practiceSessionsTable.$inferInsert;
