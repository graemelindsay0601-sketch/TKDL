import { pgTable, serial, integer, text, jsonb, real, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// TKDL LIVE — four broadcast-specific tables (handover doc section 13).
// Deliberately does NOT duplicate matches or standings: everything here is
// either broadcast-only state (an Edition's assembled programme, a story's
// lifecycle/score) or a point-in-time snapshot of a prediction that was
// already computed once and is worth keeping rather than recomputing
// (broadcast_prediction_snapshots — Title Predictor runs are explicitly not
// meant to re-run on every viewer request, per section 8.2).
//
// Actual CREATE TABLE IF NOT EXISTS DDL lives in
// artifacts/api-server/src/db/migrations/add_tkdl_live_broadcast.ts,
// following this repo's existing idempotent-startup-migration convention
// (see add_season_league_type.ts) rather than a formal drizzle-kit
// migration — these Drizzle definitions exist for typed query-builder
// access, the same split every other hand-rolled-SQL table in this app
// already uses (e.g. feature_flags: schema file here, raw DDL in
// cardTablesMigration.ts).

// ── 13.1 broadcast_editions ─────────────────────────────────────────────

export const SLOT_TYPES = ["midday", "evening", "night", "manual"] as const;
export type SlotType = (typeof SLOT_TYPES)[number];

export const EDITION_STATUSES = ["BUILDING", "PUBLISHED", "SKIPPED", "FAILED"] as const;
export type EditionStatus = (typeof EDITION_STATUSES)[number];

export const broadcastEditionsTable = pgTable("broadcast_editions", {
  id: serial("id").primaryKey(),
  // e.g. "2026-09-02:evening" — unique per logical slot, not per DB row, so
  // a lazily-regenerated slot (server was asleep at its scheduled time,
  // section 16.3) updates the same row rather than creating a duplicate.
  slotKey: text("slot_key").notNull().unique(),
  slotType: text("slot_type").notNull().$type<SlotType>(),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  dataCutoff: timestamp("data_cutoff", { withTimezone: true }).notNull(),
  status: text("status").notNull().$type<EditionStatus>(),
  changeScore: integer("change_score").notNull().default(0),
  programmeVersion: integer("programme_version").notNull().default(1),
  /** The assembled running order (section 11) — nullable while BUILDING/on FAILED. */
  programme: jsonb("programme").$type<unknown>(),
  diagnostic: text("diagnostic"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

export const insertBroadcastEditionSchema = createInsertSchema(broadcastEditionsTable).omit({ id: true, createdAt: true });
export type InsertBroadcastEdition = z.infer<typeof insertBroadcastEditionSchema>;
export type BroadcastEdition = typeof broadcastEditionsTable.$inferSelect;

// ── 13.2 broadcast_stories ───────────────────────────────────────────────

export const STORY_LIFECYCLES = ["NEW", "HOT", "ACTIVE", "COOLING", "RESOLVED", "ARCHIVED"] as const;
export type StoryLifecycle = (typeof STORY_LIFECYCLES)[number];

export const STORY_SENTIMENTS = ["positive", "neutral", "negative"] as const;
export type StorySentiment = (typeof STORY_SENTIMENTS)[number];

export const broadcastStoriesTable = pgTable("broadcast_stories", {
  id: serial("id").primaryKey(),
  // Deterministic identity for a story — the same underlying situation
  // (e.g. "player 7's current win streak") re-detected across builds
  // resolves to the SAME row via this key, rather than spawning a new one
  // every Edition (see story-engine.ts's own storyKey construction).
  storyKey: text("story_key").notNull().unique(),
  leagueType: text("league_type").notNull().$type<"singles" | "doubles" | "shift_wars">(),
  storyType: text("story_type").notNull(),
  /** Player ids (Singles) or team ids (Doubles/Shift Wars) this story is about, as strings — see story-engine.ts's subjectKey() for the exact encoding. */
  subjectKeys: jsonb("subject_keys").notNull().$type<string[]>(),
  anchorMatchId: integer("anchor_match_id"),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  lifecycle: text("lifecycle").notNull().$type<StoryLifecycle>(),
  score: integer("score").notNull(),
  confidence: real("confidence").notNull(),
  sentiment: text("sentiment").notNull().$type<StorySentiment>(),
  facts: jsonb("facts").notNull().$type<Record<string, unknown>>(),
  tags: jsonb("tags").notNull().$type<string[]>(),
  lastFullEditionId: integer("last_full_edition_id"),
  lastHeadlineEditionId: integer("last_headline_edition_id"),
  fullCount: integer("full_count").notNull().default(0),
  headlineCount: integer("headline_count").notNull().default(0),
});

export const insertBroadcastStorySchema = createInsertSchema(broadcastStoriesTable).omit({ id: true });
export type InsertBroadcastStory = z.infer<typeof insertBroadcastStorySchema>;
export type BroadcastStory = typeof broadcastStoriesTable.$inferSelect;

// ── 13.3 broadcast_prediction_snapshots ──────────────────────────────────

export const SNAPSHOT_TYPES = ["TITLE", "HISTORICAL_MATCH"] as const;
export type SnapshotType = (typeof SNAPSHOT_TYPES)[number];

export const broadcastPredictionSnapshotsTable = pgTable("broadcast_prediction_snapshots", {
  id: serial("id").primaryKey(),
  snapshotType: text("snapshot_type").notNull().$type<SnapshotType>(),
  leagueType: text("league_type").notNull().$type<"singles" | "doubles" | "shift_wars">(),
  seasonId: integer("season_id"),
  matchId: integer("match_id"),
  editionId: integer("edition_id"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  modelVersion: text("model_version").notNull(),
  payload: jsonb("payload").notNull().$type<unknown>(),
});

export const insertBroadcastPredictionSnapshotSchema = createInsertSchema(broadcastPredictionSnapshotsTable).omit({ id: true, generatedAt: true });
export type InsertBroadcastPredictionSnapshot = z.infer<typeof insertBroadcastPredictionSnapshotSchema>;
export type BroadcastPredictionSnapshot = typeof broadcastPredictionSnapshotsTable.$inferSelect;

// ── 13.4 broadcast_memory ────────────────────────────────────────────────
// Not written or read by the Story Engine (section 9, this file's actual
// consumer) — this table belongs to the Presenter/Commentary Engine
// (section 12), a later phase. Defined now because the doc's schema section
// specifies all four tables together, but nothing in this phase touches it.

export const MEMORY_TYPES = ["PHRASE", "PLAYER_NEGATIVE", "PLAYER_FEATURE", "RUNNING_JOKE", "PRESENTER_CALL"] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export const broadcastMemoryTable = pgTable("broadcast_memory", {
  id: serial("id").primaryKey(),
  memoryType: text("memory_type").notNull().$type<MemoryType>(),
  memoryKey: text("memory_key").notNull(),
  subjectKey: text("subject_key"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull(),
  lastEditionId: integer("last_edition_id"),
  usageCount: integer("usage_count").notNull().default(1),
  payload: jsonb("payload").$type<unknown>(),
}, (t) => [
  // Postgres treats NULLs as distinct for uniqueness, so a NULL subjectKey
  // (a memory entry with no specific subject, e.g. a generic phrase) won't
  // collide with another NULL row here — whatever in section 12 writes
  // subject-less rows needs to upsert by (memoryType, memoryKey) with an
  // explicit "no subject" sentinel instead of relying on this index alone
  // to prevent duplicates in that case. Flagging this now since it's easy
  // to trip over later; not this phase's problem to solve since the Story
  // Engine never writes here.
  uniqueIndex("idx_broadcast_memory_type_key_subject").on(t.memoryType, t.memoryKey, t.subjectKey),
]);

export const insertBroadcastMemorySchema = createInsertSchema(broadcastMemoryTable).omit({ id: true });
export type InsertBroadcastMemory = z.infer<typeof insertBroadcastMemorySchema>;
export type BroadcastMemory = typeof broadcastMemoryTable.$inferSelect;
