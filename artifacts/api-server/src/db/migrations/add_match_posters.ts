import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export async function addMatchPosters(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS match_posters (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE,
      format TEXT NOT NULL,
      side_a TEXT NOT NULL,
      side_b TEXT NOT NULL,
      kicker TEXT NOT NULL,
      reason TEXT,
      level TEXT NOT NULL DEFAULT 'standard',
      side_a_points INTEGER,
      side_b_points INTEGER,
      status TEXT NOT NULL DEFAULT 'prematch',
      winner_name TEXT,
      match_key TEXT,
      season_id INTEGER,
      season_name TEXT,
      created_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_match_posters_created_at ON match_posters(created_at DESC);
    ALTER TABLE match_posters ADD COLUMN IF NOT EXISTS season_id INTEGER;
    ALTER TABLE match_posters ADD COLUMN IF NOT EXISTS season_name TEXT;
  `);
}
