import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { DEFAULT_LEAGUE_SLUG, DEFAULT_LEAGUE_NAME } from "@workspace/db/schema";
import { logger } from "../../lib/logger";

/**
 * Multi-tenant support, first slice: the `leagues` table itself. See
 * schema/leagues.ts for the reasoning — this app has had no tenant concept
 * at all until now, so this migration creates the table and seeds exactly
 * one row for the club that already exists ("tkdl"), giving every later
 * league-scoped migration a real id to backfill existing rows onto.
 *
 * Must run before any migration that adds a `league_id` column elsewhere
 * (see add_settings_league_id.ts) — registered first in app.ts's init().
 */
export async function addLeaguesTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS leagues (
        id SERIAL PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      INSERT INTO leagues (slug, name) VALUES (${DEFAULT_LEAGUE_SLUG}, ${DEFAULT_LEAGUE_NAME})
      ON CONFLICT (slug) DO NOTHING
    `);
    logger.info("leagues table ready (default league seeded)");
  } catch (err) {
    logger.error({ err }, "Failed to create/seed leagues table");
    throw err;
  }
}
