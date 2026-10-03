import { sql } from "drizzle-orm";
import { pgTable, uuid, integer, text, jsonb, timestamp, primaryKey, unique, index, foreignKey, check } from "drizzle-orm/pg-core";
import { careerSavesTable } from "./career-saves";
import { careerWorldPlayersTable } from "./career-world";
const saveId = () => uuid("career_save_id").notNull().references(() => careerSavesTable.id, { onDelete: "cascade" });
export const careerSeasonsTable = pgTable("career_seasons", {
  careerSaveId: saveId(), season: integer("season").notNull(), eventDatabaseVersion: integer("event_database_version").notNull(), day: integer("day").notNull().default(0), status: text("status").notNull().default("ACTIVE"),
}, t => [primaryKey({ columns: [t.careerSaveId, t.season] }), check("career_seasons_season_check", sql`${t.season}>0`), check("career_seasons_event_database_version_check", sql`${t.eventDatabaseVersion}>0`), check("career_seasons_day_check", sql`${t.day} BETWEEN 0 AND 364`), check("career_seasons_status_check", sql`${t.status} IN ('ACTIVE','COMPLETED')`)]);
export const careerEventsTable = pgTable("career_events", {
  careerSaveId: saveId(), id: uuid("id").notNull(), season: integer("season").notNull(), instanceKey: text("instance_key").notNull(), circuit: text("circuit").notNull(), classification: text("classification").notNull(),
  startDay: integer("start_day").notNull(), endDay: integer("end_day").notNull(), opensDay: integer("opens_day").notNull(), closesDay: integer("closes_day").notNull(), status: text("status").notNull(),
  snapshot: jsonb("snapshot").notNull(), draw: jsonb("draw"), result: jsonb("result"), cancellationReason: text("cancellation_reason"),
}, t => [primaryKey({ columns: [t.careerSaveId, t.id] }), unique().on(t.careerSaveId, t.season, t.instanceKey),
  foreignKey({ columns: [t.careerSaveId, t.season], foreignColumns: [careerSeasonsTable.careerSaveId, careerSeasonsTable.season] }).onDelete("cascade"),
  index("career_events_calendar_idx").on(t.careerSaveId, t.season, t.startDay, t.id), index("career_events_status_idx").on(t.careerSaveId, t.season, t.status, t.circuit),
  check("career_events_classification_check", sql`${t.classification} IN ('RANKING','QUALIFIER','INVITATIONAL_EXHIBITION','SPECIAL')`),
  check("career_events_start_day_check", sql`${t.startDay} BETWEEN 0 AND 363`), check("career_events_end_day_check", sql`${t.endDay} BETWEEN ${t.startDay} AND 363`),
  check("career_events_opens_day_check", sql`${t.opensDay} BETWEEN 0 AND ${t.startDay}`), check("career_events_closes_day_check", sql`${t.closesDay} BETWEEN ${t.opensDay} AND ${t.startDay}`),
  check("career_events_status_check", sql`${t.status} IN ('SCHEDULED','REGISTRATION_OPEN','DRAWN','IN_PROGRESS','COMPLETED','CANCELLED')`),
  check("career_events_snapshot_check", sql`jsonb_typeof(${t.snapshot})='object'`),
  check("career_events_result_check", sql`(${t.status}='COMPLETED')=(${t.result} IS NOT NULL)`),
  check("career_events_draw_check", sql`${t.status} NOT IN ('DRAWN','IN_PROGRESS','COMPLETED') OR ${t.draw} IS NOT NULL`),
  check("career_events_special_check", sql`${t.classification}<>'SPECIAL' OR COALESCE(${t.snapshot}->'definition'->'rankingCategory'='null'::jsonb AND ${t.snapshot}->'definition'->'qualification'='null'::jsonb,false)`),
]);
export const careerEventEntriesTable = pgTable("career_event_entries", {
  careerSaveId: saveId(), eventId: uuid("event_id").notNull(), participantKey: text("participant_key").notNull(), npcId: uuid("npc_id"), status: text("status").notNull(), identity: jsonb("identity").notNull(),
}, t => [primaryKey({ columns: [t.careerSaveId, t.eventId, t.participantKey] }),
  foreignKey({ columns: [t.careerSaveId, t.eventId], foreignColumns: [careerEventsTable.careerSaveId, careerEventsTable.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.careerSaveId, t.npcId], foreignColumns: [careerWorldPlayersTable.careerSaveId, careerWorldPlayersTable.id] }).onDelete("cascade"),
  index("career_entries_participant_idx").on(t.careerSaveId, t.participantKey, t.status),
  check("career_event_entries_status_check", sql`${t.status} IN ('ENTERED','WITHDRAWN','CONFIRMED','ELIMINATED','CHAMPION','MISSED')`),
  check("career_event_entries_identity_check", sql`jsonb_typeof(${t.identity})='object'`),
  check("career_event_entries_participant_check", sql`(${t.participantKey}='human' AND ${t.npcId} IS NULL) OR (${t.npcId} IS NOT NULL AND ${t.participantKey}=${t.npcId}::text)`),
]);
export const careerEventEntitlementsTable = pgTable("career_event_entitlements", {
  careerSaveId: saveId(), sourceEventId: uuid("source_event_id").notNull(), participantKey: text("participant_key").notNull(), targetKey: text("target_key").notNull(), targetKind: text("target_kind").notNull(),
  targetEventId: uuid("target_event_id"), season: integer("season").notNull(), status: text("status").notNull().default("EARNED"), earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.careerSaveId, t.sourceEventId, t.participantKey, t.targetKey] }),
  foreignKey({ columns: [t.careerSaveId, t.sourceEventId, t.participantKey], foreignColumns: [careerEventEntriesTable.careerSaveId, careerEventEntriesTable.eventId, careerEventEntriesTable.participantKey] }).onDelete("cascade"),
  foreignKey({ columns: [t.careerSaveId, t.targetEventId], foreignColumns: [careerEventsTable.careerSaveId, careerEventsTable.id] }).onDelete("cascade"),
  index("career_entitlement_target_idx").on(t.careerSaveId, t.season, t.participantKey, t.targetKey, t.status),
  check("career_event_entitlements_target_kind_check", sql`${t.targetKind} IN ('EVENT','FAMILY','STAGE')`), check("career_event_entitlements_season_check", sql`${t.season}>0`),
  check("career_event_entitlements_status_check", sql`${t.status} IN ('EARNED','CONSUMED','REVOKED')`),
]);
export const careerCalendarOperationsTable = pgTable("career_calendar_operations", {
  careerSaveId: saveId(), operationKey: text("operation_key").notNull(), request: jsonb("request").notNull(), result: jsonb("result").notNull(),
}, t => [primaryKey({ columns: [t.careerSaveId, t.operationKey] }), check("career_calendar_operations_operation_key_check", sql`length(${t.operationKey}) BETWEEN 1 AND 120`)]);
