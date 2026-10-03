import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export async function addMatchSpotlightOverride(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS match_spotlight_override (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      action TEXT NOT NULL CHECK (action IN ('PIN','DISMISS')),
      payload JSONB,
      expires_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
