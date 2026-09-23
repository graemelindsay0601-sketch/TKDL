import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { getDefaultLeagueId } from "../../lib/currentLeague";
import { logger } from "../../lib/logger";

/**
 * Multi-tenant support, second slice: scope the `settings` table (feature
 * flags like community_enabled, live_scorer_enabled, messaging_enabled,
 * etc.) to a league. This was the clearest example of a singleton
 * assumption baked into the schema — one global row per key, meaning a
 * second league could never have its own independent flag values.
 *
 * Backfills every pre-existing row onto the single seeded "tkdl" league
 * (see add_leagues_table.ts, which must run first — registered before this
 * one in app.ts's init()), then widens the primary key from `(key)` to
 * `(league_id, key)`. A column DEFAULT of the default league's id is set
 * too, so any INSERT that doesn't yet specify league_id (there were several
 * — see lib/settingsService.ts's call-site notes) still lands correctly
 * scoped rather than failing outright; callers should still be migrated to
 * pass it explicitly where they need ON CONFLICT to target the right row.
 */
export async function addSettingsLeagueId(): Promise<void> {
  try {
    const defaultLeagueId = await getDefaultLeagueId();
    // Postgres DDL doesn't support bind parameters at all (confirmed against
    // a real DB while building this migration — `CREATE TABLE ... DEFAULT
    // $1` fails at the wire-protocol level with "prepared statement requires
    // 0" params, not a TypeScript-catchable error). defaultLeagueId is our
    // own internally-generated integer id (never user input), so inlining
    // it via sql.raw is safe here — this is exactly the case sql.raw exists
    // for, same reasoning as the repeated-bind-param workaround in
    // routes/messages.ts.
    const defaultLeagueIdLiteral = sql.raw(String(defaultLeagueId));

    // Fresh DB — no settings table yet: create it directly in final shape.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS settings (
        league_id INTEGER NOT NULL DEFAULT ${defaultLeagueIdLiteral},
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (league_id, key)
      )
    `);

    // Existing DB from before this migration — old table has `key` as the
    // sole PK and no league_id column. Bring it up to the same shape.
    await db.execute(sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS league_id INTEGER`);
    await db.execute(sql`UPDATE settings SET league_id = ${defaultLeagueId} WHERE league_id IS NULL`);
    await db.execute(sql`ALTER TABLE settings ALTER COLUMN league_id SET NOT NULL`);
    await db.execute(sql`ALTER TABLE settings ALTER COLUMN league_id SET DEFAULT ${defaultLeagueIdLiteral}`);

    // Postgres has no `ADD CONSTRAINT IF NOT EXISTS`, so check first (same
    // "check, then act only if needed" convention as add_season_league_type.ts)
    // rather than relying on catching a duplicate-object error.
    const [pk] = (await db.execute(sql`
      SELECT COUNT(*)::int AS col_count
      FROM information_schema.key_column_usage
      WHERE table_name = 'settings'
        AND constraint_name = (
          SELECT constraint_name FROM information_schema.table_constraints
          WHERE table_name = 'settings' AND constraint_type = 'PRIMARY KEY'
        )
    `)).rows as { col_count: number }[];

    if (!pk || pk.col_count < 2) {
      await db.execute(sql`ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey`);
      await db.execute(sql`ALTER TABLE settings ADD CONSTRAINT settings_pkey PRIMARY KEY (league_id, key)`);
      logger.info("settings primary key widened to (league_id, key)");
    }

    logger.info({ defaultLeagueId }, "settings table is league-scoped");
  } catch (err) {
    logger.error({ err }, "Failed to league-scope settings table");
    throw err;
  }
}
