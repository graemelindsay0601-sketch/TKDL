import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export async function extendMatchPostersResultMedia(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE match_posters ADD COLUMN IF NOT EXISTS result_ref TEXT;
    ALTER TABLE match_posters ADD COLUMN IF NOT EXISTS stake INTEGER;
    ALTER TABLE match_posters ADD COLUMN IF NOT EXISTS result_type TEXT;
    ALTER TABLE match_posters ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_match_posters_result_ref
      ON match_posters(result_ref) WHERE result_ref IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_match_posters_match_key
      ON match_posters(match_key) WHERE match_key IS NOT NULL;
  `);
}
