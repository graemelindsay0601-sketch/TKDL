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
