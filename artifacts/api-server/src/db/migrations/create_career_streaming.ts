import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../../career/database.ts";

/** Streaming: your channel and each stream (a booked night, its challenger, the running tally and chat). Every startup; checks first. */
export async function ensureStreaming(tx: CareerExecutor): Promise<void> {
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_stream_channels (
    career_save_id uuid PRIMARY KEY REFERENCES career_saves(id) ON DELETE CASCADE,
    handle text NOT NULL, followers integer NOT NULL DEFAULT 0 CHECK(followers >= 0), created_at timestamptz NOT NULL DEFAULT NOW())`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_streams (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    id uuid NOT NULL, season integer NOT NULL, week integer NOT NULL, day integer NOT NULL,
    status text NOT NULL CHECK(status IN ('LIVE','ENDED')),
    challenger jsonb NOT NULL, first_thrower integer NOT NULL, tally jsonb NOT NULL, chat jsonb NOT NULL DEFAULT '[]'::jsonb,
    processed_visits integer NOT NULL DEFAULT 0, result text CHECK(result IN ('WON','LOST')),
    income_pence bigint, followers_gained integer, created_at timestamptz NOT NULL DEFAULT NOW(), ended_at timestamptz,
    PRIMARY KEY(career_save_id,id))`);
  // The dart log so far, so a stream picks up where it left off after a refresh.
  await tx.execute(sql`ALTER TABLE career_streams ADD COLUMN IF NOT EXISTS darts jsonb NOT NULL DEFAULT '[]'::jsonb`);
  await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_streams_night_idx ON career_streams(career_save_id, season, day)`);
}
