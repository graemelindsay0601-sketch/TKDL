import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

// The Poster Library's redesigned graphic (see tkdl/src/lib/match-poster-art.ts)
// shows the game type ("501", "Cricket", ...) in its header line. Until now
// that value only ever lived inside the free-text `reason` column (baked in
// by matchPosterService's upsertResultPoster as "501 · 10 points at stake"),
// with no column of its own to read it back out of cleanly.
export async function addMatchPostersGameType(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE match_posters ADD COLUMN IF NOT EXISTS game_type TEXT;
  `);
}
