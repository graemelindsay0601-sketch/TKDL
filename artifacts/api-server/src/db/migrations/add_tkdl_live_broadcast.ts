import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Migration: the four TKDL LIVE broadcast tables (handover doc section
 * 13) — broadcast_editions, broadcast_stories, broadcast_prediction_
 * snapshots, broadcast_memory. Idempotent CREATE TABLE IF NOT EXISTS, same
 * pattern as every other hand-rolled-SQL table in this app (see
 * add_season_league_type.ts, cardTablesMigration.ts) rather than a formal
 * drizzle-kit migration. Deliberately does not touch matches/standings
 * tables — every broadcast table here is either broadcast-only state or a
 * stored snapshot of a prediction that was already computed once.
 */
// Each statement runs in its own try/catch (rather than one wrapper around
// the whole function) so, e.g., a hiccup creating broadcast_memory can't
// also prevent broadcast_editions/broadcast_stories/broadcast_prediction_
// snapshots — three independent tables — from being created. Matches this
// codebase's established per-statement migration convention (see
// add_performance_indexes.ts).
async function runStep(description: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logger.error({ err }, `Failed: ${description}`);
  }
}

export async function addTkdlLiveBroadcastTables() {
  await runStep("create broadcast_editions", () => db.execute(sql`
    CREATE TABLE IF NOT EXISTS broadcast_editions (
      id SERIAL PRIMARY KEY,
      slot_key TEXT UNIQUE NOT NULL,
      slot_type TEXT NOT NULL,
      scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
      data_cutoff TIMESTAMP WITH TIME ZONE NOT NULL,
      status TEXT NOT NULL,
      change_score INTEGER NOT NULL DEFAULT 0,
      programme_version INTEGER NOT NULL DEFAULT 1,
      programme JSONB,
      diagnostic TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      published_at TIMESTAMP WITH TIME ZONE
    )
  `));

  await runStep("create broadcast_stories", () => db.execute(sql`
    CREATE TABLE IF NOT EXISTS broadcast_stories (
      id SERIAL PRIMARY KEY,
      story_key TEXT UNIQUE NOT NULL,
      league_type TEXT NOT NULL,
      story_type TEXT NOT NULL,
      subject_keys JSONB NOT NULL,
      anchor_match_id INTEGER,
      detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
      resolved_at TIMESTAMP WITH TIME ZONE,
      lifecycle TEXT NOT NULL,
      score INTEGER NOT NULL,
      confidence REAL NOT NULL,
      sentiment TEXT NOT NULL,
      facts JSONB NOT NULL,
      tags JSONB NOT NULL,
      last_full_edition_id INTEGER,
      last_headline_edition_id INTEGER,
      full_count INTEGER NOT NULL DEFAULT 0,
      headline_count INTEGER NOT NULL DEFAULT 0
    )
  `));
  // Every real caller filters/orders by these — see story-engine.ts's own
  // "find existing story by key" and "active stories for this league"
  // queries.
  await runStep("create idx_broadcast_stories_lifecycle", () => db.execute(sql`CREATE INDEX IF NOT EXISTS idx_broadcast_stories_lifecycle ON broadcast_stories(lifecycle)`));
  await runStep("create idx_broadcast_stories_league_type", () => db.execute(sql`CREATE INDEX IF NOT EXISTS idx_broadcast_stories_league_type ON broadcast_stories(league_type)`));
  await runStep("create idx_broadcast_stories_anchor_match_id", () => db.execute(sql`CREATE INDEX IF NOT EXISTS idx_broadcast_stories_anchor_match_id ON broadcast_stories(anchor_match_id)`));
  // Facts created before provenance tracking shipped were persisted at
  // updated_at. Backfill that timestamp once so the new fail-closed quality
  // gate can safely assess existing active stories.
  await runStep("backfill broadcast_stories.facts.__snapshotCutoff", () => db.execute(sql`
    UPDATE broadcast_stories
    SET facts = jsonb_set(
      COALESCE(facts, '{}'::jsonb),
      '{__snapshotCutoff}',
      to_jsonb(updated_at),
      true
    )
    WHERE NOT COALESCE(facts, '{}'::jsonb) ? '__snapshotCutoff'
  `));

  await runStep("create broadcast_prediction_snapshots", () => db.execute(sql`
    CREATE TABLE IF NOT EXISTS broadcast_prediction_snapshots (
      id SERIAL PRIMARY KEY,
      snapshot_type TEXT NOT NULL,
      league_type TEXT NOT NULL,
      season_id INTEGER,
      match_id INTEGER,
      edition_id INTEGER,
      generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      model_version TEXT NOT NULL,
      payload JSONB NOT NULL
    )
  `));

  await runStep("create broadcast_memory", () => db.execute(sql`
    CREATE TABLE IF NOT EXISTS broadcast_memory (
      id SERIAL PRIMARY KEY,
      memory_type TEXT NOT NULL,
      memory_key TEXT NOT NULL,
      subject_key TEXT,
      last_used_at TIMESTAMP WITH TIME ZONE NOT NULL,
      last_edition_id INTEGER,
      usage_count INTEGER NOT NULL DEFAULT 1,
      payload JSONB
    )
  `));
  await runStep("create idx_broadcast_memory_type_key_subject", () => db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcast_memory_type_key_subject
    ON broadcast_memory(memory_type, memory_key, subject_key)
  `));

  logger.info("TKDL LIVE broadcast tables ready");
}
