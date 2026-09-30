import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Render keeps RENDER_GIT_COMMIT stable when it suspends and later wakes the
 * same deployment. A new push receives a new key and therefore performs the
 * complete idempotent schema/seed pass once. Ordinary sleep/wake cycles only
 * perform the cheap lookup below.
 */
export function deploymentBootstrapKey(): string | null {
  if (process.env.NODE_ENV !== "production") return null;
  return process.env.RENDER_GIT_COMMIT?.trim() || process.env.TKDL_BOOTSTRAP_VERSION?.trim() || null;
}

export async function ensureBootstrapLedger(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS app_bootstrap_versions (
      version_key TEXT PRIMARY KEY,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function isBootstrapComplete(versionKey: string): Promise<boolean> {
  const result = await db.execute(sql`SELECT 1 FROM app_bootstrap_versions WHERE version_key = ${versionKey} LIMIT 1`);
  return result.rows.length > 0;
}

export async function markBootstrapComplete(versionKey: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO app_bootstrap_versions (version_key) VALUES (${versionKey})
    ON CONFLICT (version_key) DO NOTHING
  `);
}

/**
 * Unlike app_bootstrap_versions (one row per Render deploy), this ledger is
 * permanent. A named schema migration that has succeeded once against this
 * database never needs to repeat after every later push.
 */
export async function ensureSchemaMigrationLedger(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS app_schema_migrations (
      migration_key TEXT PRIMARY KEY,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function loadCompletedSchemaMigrations(): Promise<Set<string>> {
  const result = await db.execute(sql`SELECT migration_key FROM app_schema_migrations`);
  return new Set((result.rows as { migration_key: string }[]).map(row => row.migration_key));
}

export async function markSchemaMigrationComplete(migrationKey: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO app_schema_migrations (migration_key) VALUES (${migrationKey})
    ON CONFLICT (migration_key) DO NOTHING
  `);
}
