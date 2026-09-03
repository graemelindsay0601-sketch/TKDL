import { pgTable, serial, text, boolean, date, integer, uniqueIndex, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// LEAGUE_TYPES: the 3 independently-run leagues that each get their own
// sequence of season rows. 'singles' is the original/default league — every
// row that existed before league_type was added backfills to 'singles' via
// the column default, so nothing about the singles season history changes.
// Doubles and Shift Wars used to piggyback on whichever singles season
// happened to be active (see db/migrations/add_season_league_type.ts for
// the one-time cutover), which is exactly how they ended up dragged into a
// singles season boundary they never actually played a game in.
export const LEAGUE_TYPES = ["singles", "doubles", "shift_wars"] as const;
export type LeagueType = (typeof LEAGUE_TYPES)[number];

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
  leagueType: text("league_type").notNull().default("singles"),
  /**
   * Set once (and only once) a Season Review special has actually PUBLISHED
   * for this closed season — see db/migrations/add_season_broadcast_reviewed_at.ts
   * and edition-engine.ts's own header on why this exists: the original
   * design derived "does this closed season need a Season Review" from a
   * (previous.dataCutoff, cutoffEnd] window, the same one-shot check
   * story-engine.ts's processLeagueFamily uses for CHAMPION/SEASON_RECAP
   * detection — correct for "did a match just get won," structurally wrong
   * for "has this season been reviewed yet," since the window only ever
   * contains the close event on the very FIRST build after it happens. A
   * real user hit exactly that: regenerating the edition a second time (to
   * preview the new feature) landed outside the window, silently fell back
   * to an ordinary Edition, and reported it as "way too short" with the
   * champion "brought up multiple times" — the ordinary CHAMPION/H2H/FORM
   * rotation about the same dominant player, not the review. This column is
   * a durable, state-based answer instead: null means "still owed a
   * review," a timestamp means "already delivered one," checked directly
   * rather than re-derived from a shrinking time window.
   */
  broadcastReviewedAt: timestamp("broadcast_reviewed_at", { withTimezone: true }),
}, (t) => [
  // At most one active season per league at a time — a partial unique index
  // so Singles/Doubles/Shift Wars can each have their own concurrently-
  // active row without ambiguity for any "find the active season" query.
  uniqueIndex("idx_seasons_one_active_per_league").on(t.leagueType).where(sql`${t.isActive} = true`),
]);

export const insertSeasonSchema = createInsertSchema(seasonsTable).omit({ id: true, totalMatches: true });
export type InsertSeason = z.infer<typeof insertSeasonSchema>;
export type Season = typeof seasonsTable.$inferSelect;
