import { pgTable, text, timestamp, integer, primaryKey } from "drizzle-orm/pg-core";

// League-scoped as of db/migrations/add_settings_league_id.ts in
// api-server — the first table in the multi-tenant slice. Every existing
// row was backfilled onto the single seeded "tkdl" league (see
// schema/leagues.ts), so today this behaves exactly like the old
// single-tenant table; the composite primary key just makes room for a
// second league to have its own value for the same key.
export const settingsTable = pgTable("settings", {
  leagueId:  integer("league_id").notNull(),
  key:       text("key").notNull(),
  value:     text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.leagueId, t.key] }),
}));

export type Setting = typeof settingsTable.$inferSelect;
