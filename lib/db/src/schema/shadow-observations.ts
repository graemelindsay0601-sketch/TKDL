import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, unique, primaryKey, foreignKey, index, check } from "drizzle-orm/pg-core";
import { playersTable } from "./players";

/** SB2.1A: source metadata and contextual evidence are versioned JSON contracts.
 * Relational identity/eligibility fields are indexed; no public data API is implied.
 */
export const shadowActivitiesTable = pgTable("shadow_activities", {
  id: uuid("id").primaryKey(), sourceNamespace: text("source_namespace").notNull(), sourceId: text("source_id").notNull(),
  ownerPlayerId: integer("owner_player_id").references(() => playersTable.id, { onDelete: "cascade" }),
  sourceRevision: integer("source_revision").notNull().default(-1), payloadHash: text("payload_hash"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [unique().on(t.sourceNamespace, t.sourceId), check("shadow_activities_source_revision_check", sql`${t.sourceRevision} >= -1`),
  check("shadow_activities_metadata_check", sql`jsonb_typeof(${t.metadata})='object'`)]);

export const shadowActivityRevisionsTable = pgTable("shadow_activity_revisions", {
  activityId: uuid("activity_id").notNull().references(() => shadowActivitiesTable.id, { onDelete: "cascade" }),
  sourceRevision: integer("source_revision").notNull(), payloadHash: text("payload_hash").notNull(), snapshot: jsonb("snapshot").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.activityId, t.sourceRevision] }), check("shadow_activity_revisions_source_revision_check", sql`${t.sourceRevision}>=0`),
  check("shadow_activity_revisions_snapshot_check", sql`jsonb_typeof(${t.snapshot})='object'`)]);

export const shadowObservationsTable = pgTable("shadow_observations", {
  id: uuid("id").primaryKey(), activityId: uuid("activity_id").notNull().references(() => shadowActivitiesTable.id, { onDelete: "cascade" }),
  sourceRevision: integer("source_revision").notNull(), participantKey: text("participant_key").notNull(),
  playerId: integer("player_id").references(() => playersTable.id, { onDelete: "cascade" }), playerSlot: integer("player_slot").notNull(),
  sourceOrdinal: integer("source_ordinal").notNull(), unit: text("unit").notNull(), provenance: text("provenance").notNull(),
  dataQuality: integer("data_quality").notNull(), trainingEligible: boolean("training_eligible").notNull(), exclusionReason: text("exclusion_reason"),
  payloadHash: text("payload_hash").notNull(), evidence: jsonb("evidence").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [unique().on(t.activityId, t.participantKey, t.sourceOrdinal),
  foreignKey({ columns: [t.activityId, t.sourceRevision], foreignColumns: [shadowActivityRevisionsTable.activityId, shadowActivityRevisionsTable.sourceRevision] }).onDelete("cascade"),
  index("shadow_observations_player_idx").on(t.playerId, t.activityId, t.sourceOrdinal).where(sql`${t.trainingEligible}`),
  check("shadow_observations_player_slot_check", sql`${t.playerSlot}>=0`), check("shadow_observations_source_ordinal_check", sql`${t.sourceOrdinal}>=0`),
  check("shadow_observations_unit_check", sql`${t.unit} IN ('DART','VISIT','RESULT')`),
  check("shadow_observations_provenance_check", sql`${t.provenance} IN ('HUMAN','BOT','NPC','SIMULATION','REPLAY_GENERATED','UNKNOWN')`),
  check("shadow_observations_data_quality_check", sql`${t.dataQuality} BETWEEN 1 AND 5`),
  check("shadow_observations_evidence_check", sql`jsonb_typeof(${t.evidence})='object'`),
  check("shadow_observations_check", sql`(${t.trainingEligible} AND ${t.provenance}='HUMAN' AND ${t.playerId} IS NOT NULL AND ${t.exclusionReason} IS NULL AND ${t.unit}='DART' AND ${t.dataQuality}>=3)
    OR (NOT ${t.trainingEligible} AND ${t.exclusionReason} IS NOT NULL)`),
]);
