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
  // Phase 2: subscribers who renew monthly (and the last month paid), and brand deals.
  await tx.execute(sql`ALTER TABLE career_stream_channels ADD COLUMN IF NOT EXISTS subscribers integer NOT NULL DEFAULT 0`);
  await tx.execute(sql`ALTER TABLE career_stream_channels ADD COLUMN IF NOT EXISTS renewed_through text`);
  // Optional creator-studio investments; old channels start with the basic setup.
  await tx.execute(sql`ALTER TABLE career_stream_channels ADD COLUMN IF NOT EXISTS studio_level integer NOT NULL DEFAULT 0`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_stream_deals (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    id uuid NOT NULL, season integer NOT NULL, offered_week integer NOT NULL, expires_week integer NOT NULL,
    brand_key text NOT NULL, brand_name text NOT NULL, per_stream_pence bigint NOT NULL CHECK(per_stream_pence > 0),
    streams_total integer NOT NULL, streams_done integer NOT NULL DEFAULT 0,
    status text NOT NULL CHECK(status IN ('OFFERED','ACTIVE','COMPLETED','DECLINED','EXPIRED')),
    created_at timestamptz NOT NULL DEFAULT NOW(), PRIMARY KEY(career_save_id,id))`);
  // Stream formats: which one, King of the Oche's round and the challengers beaten, a drill's spec, and the end-of-stream poll.
  await tx.execute(sql`ALTER TABLE career_streams ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'CHALLENGER'`);
  await tx.execute(sql`ALTER TABLE career_streams ADD COLUMN IF NOT EXISTS round integer NOT NULL DEFAULT 0`);
  await tx.execute(sql`ALTER TABLE career_streams ADD COLUMN IF NOT EXISTS rounds jsonb NOT NULL DEFAULT '[]'::jsonb`);
  await tx.execute(sql`ALTER TABLE career_streams ADD COLUMN IF NOT EXISTS drill jsonb`);
  await tx.execute(sql`ALTER TABLE career_streams ADD COLUMN IF NOT EXISTS poll jsonb`);
  // Chat's pick for the next stream, and this month's sub goal.
  await tx.execute(sql`ALTER TABLE career_stream_channels ADD COLUMN IF NOT EXISTS poll_pick text`);
  await tx.execute(sql`ALTER TABLE career_stream_channels ADD COLUMN IF NOT EXISTS sub_goal jsonb`);
  // Clips: each stream's best moment, which may go viral at the end of the week.
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_stream_clips (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    id uuid NOT NULL, stream_id uuid NOT NULL, season integer NOT NULL, week integer NOT NULL, kind text NOT NULL, title text NOT NULL, peak integer NOT NULL,
    status text NOT NULL CHECK(status IN ('NEW','VIRAL','SETTLED')), views integer NOT NULL DEFAULT 0, followers_gained integer NOT NULL DEFAULT 0, fans_gained integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT NOW(), PRIMARY KEY(career_save_id,id))`);
  // A real match streamed from an event: which match, and its own format.
  await tx.execute(sql`ALTER TABLE career_streams ADD COLUMN IF NOT EXISTS match_id uuid`);
  await tx.execute(sql`ALTER TABLE career_streams ADD COLUMN IF NOT EXISTS match_format jsonb`);
  await tx.execute(sql`ALTER TABLE career_streams ADD COLUMN IF NOT EXISTS sponsor_campaign_id uuid`);
  await tx.execute(sql`ALTER TABLE career_streams ADD COLUMN IF NOT EXISTS sponsor_campaign jsonb`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_stream_campaigns (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    id uuid NOT NULL, season integer NOT NULL, offered_week integer NOT NULL, expires_week integer NOT NULL,
    sponsor_key text NOT NULL, sponsor_name text NOT NULL, required_format text NOT NULL,
    brief text NOT NULL, reward_pence bigint NOT NULL CHECK(reward_pence > 0),
    status text NOT NULL CHECK(status IN ('OFFERED','ACTIVE','IN_PROGRESS','COMPLETED','DECLINED','EXPIRED')),
    stream_id uuid, created_at timestamptz NOT NULL DEFAULT NOW(), PRIMARY KEY(career_save_id,id))`);
  await tx.execute(sql`ALTER TABLE career_stream_campaigns ADD COLUMN IF NOT EXISTS series_key text`);
  await tx.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS career_stream_campaign_one_open
    ON career_stream_campaigns(career_save_id) WHERE status IN ('OFFERED','ACTIVE','IN_PROGRESS')`);
  await tx.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS career_streams_match_idx ON career_streams(career_save_id, match_id) WHERE match_id IS NOT NULL`);
  await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_streams_night_idx ON career_streams(career_save_id, season, day)`);
  // Optional creator season series: one selected channel identity and up to four episode records.
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_stream_creator_series (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    season integer NOT NULL, series_key text NOT NULL CHECK(series_key IN ('HEADLINER','SKILL_LAB','CLUBHOUSE')),
    started_week integer NOT NULL, created_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY(career_save_id, season))`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_stream_creator_episodes (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    season integer NOT NULL, episode integer NOT NULL CHECK(episode BETWEEN 1 AND 4), stream_id uuid NOT NULL,
    week integer NOT NULL, format text NOT NULL, follower_bonus integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY(career_save_id, season, episode), UNIQUE(career_save_id, stream_id))`);
}
