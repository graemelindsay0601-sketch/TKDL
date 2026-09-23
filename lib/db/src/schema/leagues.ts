import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// The tenant anchor table for multi-league support. Every league-scoped
// table (starting with `settings` — see db/migrations/add_settings_league_id.ts
// in api-server) carries a `league_id` foreign key back to a row here.
//
// This is the first slice of a larger multi-tenant effort: the app was
// originally built for exactly one club (Tesco Kilbirnie Darts League) with
// no tenant concept anywhere, so this table starts out holding exactly one
// seeded row (slug "tkdl") and every existing row across the app is
// backfilled onto it. Most tables (players, matches, community_posts, etc.)
// are NOT yet scoped to a league — that's deliberately out of scope for this
// slice, which only wires up `settings` end-to-end as the proof of the
// pattern. See lib/currentLeague.ts in api-server for how a request resolves
// "which league" today (always this one seeded row, via a fallback — no
// login flow or routing asks yet).
export const leaguesTable = pgTable("leagues", {
  id:        serial("id").primaryKey(),
  slug:      text("slug").notNull().unique(),
  name:      text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type League = typeof leaguesTable.$inferSelect;

// The single league every existing row in the app belongs to today. Not a
// magic constant elsewhere — always resolved from this table by slug (see
// getDefaultLeagueId() in api-server/src/lib/currentLeague.ts) so a future
// second league never has to renumber this one.
export const DEFAULT_LEAGUE_SLUG = "tkdl";
export const DEFAULT_LEAGUE_NAME = "Tesco Kilbirnie Darts League";
