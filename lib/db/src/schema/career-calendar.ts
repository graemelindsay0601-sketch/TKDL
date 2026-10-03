import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, primaryKey, unique, index, uniqueIndex, foreignKey, check } from "drizzle-orm/pg-core";
import { careerSavesTable } from "./career-saves";
import { careerWorldPlayersTable, careerSimulatedMatchesTable } from "./career-world";

/**
 * A3 Career calendar/tournament schema. Mirrors artifacts/api-server/src/db/migrations/create_career_calendar.ts,
 * which is authoritative (it also installs history/lifecycle guard triggers that Drizzle cannot express).
 */
const saveFk = () => uuid("career_save_id").notNull().references(() => careerSavesTable.id, { onDelete: "cascade" });

export const careerEventDefinitionsTable = pgTable("career_event_definitions", {
  eventDatabaseVersion: integer("event_database_version").notNull(), definitionKey: text("definition_key").notNull(),
  definitionHash: text("definition_hash").notNull(), circuit: text("circuit").notNull(), classification: text("classification").notNull(),
  definition: jsonb("definition").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.eventDatabaseVersion, t.definitionKey] })]);

export const careerSeasonsTable = pgTable("career_seasons", {
  careerSaveId: saveFk(), season: integer("season").notNull(), eventDatabaseVersion: integer("event_database_version").notNull(),
  calendarGenerationVersion: integer("calendar_generation_version").notNull(), status: text("status").notNull(),
  playedWeek: integer("played_week").notNull().default(0), developedWeek: integer("developed_week").notNull().default(0),
  offSeasonProcessed: boolean("off_season_processed").notNull().default(false), instanceCount: integer("instance_count").notNull(),
  calendarHash: text("calendar_hash").notNull(), generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.season] }),
  check("career_seasons_week_order_check", sql`${t.developedWeek} <= ${t.playedWeek} AND ${t.playedWeek} <= ${t.developedWeek} + 1`),
]);

export const careerEventInstancesTable = pgTable("career_event_instances", {
  careerSaveId: saveFk(), id: uuid("id").notNull(), season: integer("season").notNull(), instanceKey: text("instance_key").notNull(),
  ordinal: integer("ordinal").notNull(), eventDatabaseVersion: integer("event_database_version").notNull(), definitionKey: text("definition_key").notNull(),
  name: text("name").notNull(), family: text("family").notNull(), circuit: text("circuit").notNull(), classification: text("classification").notNull(),
  rankingCategory: text("ranking_category"), presentationTier: text("presentation_tier").notNull(), featured: boolean("featured").notNull(),
  calendarPriority: integer("calendar_priority").notNull(), venueKey: text("venue_key").notNull(), city: text("city").notNull(), country: text("country").notNull(),
  region: text("region").notNull(), zone: text("zone").notNull(), localityKey: text("locality_key"),
  startWeek: integer("start_week").notNull(), endWeek: integer("end_week").notNull(), startDay: integer("start_day").notNull(), endDay: integer("end_day").notNull(),
  registrationOpensWeek: integer("registration_opens_week").notNull(), registrationClosesWeek: integer("registration_closes_week").notNull(),
  fieldSize: integer("field_size").notNull(), minimumEntrants: integer("minimum_entrants").notNull(), executable: boolean("executable").notNull(),
  seriesKey: text("series_key"), seriesDay: integer("series_day"), status: text("status").notNull(), statusReason: text("status_reason"),
  entrantCount: integer("entrant_count").notNull().default(0), championParticipantKey: text("champion_participant_key"), championNpcId: uuid("champion_npc_id"),
  snapshot: jsonb("snapshot").notNull(), fieldLockedAt: timestamp("field_locked_at", { withTimezone: true }),
  drawnAt: timestamp("drawn_at", { withTimezone: true }), completedAt: timestamp("completed_at", { withTimezone: true }),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.id] }), unique("career_event_instances_key_unique").on(t.careerSaveId, t.season, t.instanceKey),
  foreignKey({ columns: [t.careerSaveId, t.season], foreignColumns: [careerSeasonsTable.careerSaveId, careerSeasonsTable.season] }).onDelete("cascade"),
  foreignKey({ columns: [t.eventDatabaseVersion, t.definitionKey], foreignColumns: [careerEventDefinitionsTable.eventDatabaseVersion, careerEventDefinitionsTable.definitionKey] }),
  foreignKey({ columns: [t.careerSaveId, t.championNpcId], foreignColumns: [careerWorldPlayersTable.careerSaveId, careerWorldPlayersTable.id] }),
  index("career_event_instances_week_idx").on(t.careerSaveId, t.season, t.startWeek),
  index("career_event_instances_status_idx").on(t.careerSaveId, t.season, t.status),
  index("career_event_instances_definition_idx").on(t.careerSaveId, t.definitionKey, t.season),
  check("career_event_instances_special_check", sql`(${t.classification} = 'SPECIAL') = (${t.circuit} = 'SPECIAL') AND (${t.classification} <> 'SPECIAL' OR ${t.rankingCategory} IS NULL) AND (${t.classification} = 'RANKING') = (${t.rankingCategory} IS NOT NULL)`),
]);

export const careerEventEntriesTable = pgTable("career_event_entries", {
  careerSaveId: saveFk(), eventId: uuid("event_id").notNull(), participantKey: text("participant_key").notNull(), participantKind: text("participant_kind").notNull(),
  npcId: uuid("npc_id"), source: text("source").notNull(), entitlementId: uuid("entitlement_id"), status: text("status").notNull(), drawSeed: integer("draw_seed"),
  enteredSeason: integer("entered_season").notNull(), enteredWeek: integer("entered_week").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.eventId, t.participantKey] }),
  foreignKey({ columns: [t.careerSaveId, t.eventId], foreignColumns: [careerEventInstancesTable.careerSaveId, careerEventInstancesTable.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.careerSaveId, t.npcId], foreignColumns: [careerWorldPlayersTable.careerSaveId, careerWorldPlayersTable.id] }),
  index("career_event_entries_participant_idx").on(t.careerSaveId, t.participantKey, t.status),
]);

export const careerParticipantBookingsTable = pgTable("career_participant_bookings", {
  careerSaveId: saveFk(), season: integer("season").notNull(), participantKey: text("participant_key").notNull(), day: integer("day").notNull(), eventId: uuid("event_id").notNull(),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.season, t.participantKey, t.day] }),
  foreignKey({ columns: [t.careerSaveId, t.eventId], foreignColumns: [careerEventInstancesTable.careerSaveId, careerEventInstancesTable.id] }).onDelete("cascade"),
  index("career_participant_bookings_event_idx").on(t.careerSaveId, t.eventId),
]);

export const careerTournamentMatchesTable = pgTable("career_tournament_matches", {
  careerSaveId: saveFk(), id: uuid("id").notNull(), eventId: uuid("event_id").notNull(), stageKey: text("stage_key").notNull(), round: integer("round").notNull(),
  slot: integer("slot").notNull(), bestOf: integer("best_of").notNull(), scheduledDay: integer("scheduled_day").notNull(),
  aKey: text("a_key"), bKey: text("b_key"), aNpcId: uuid("a_npc_id"), bNpcId: uuid("b_npc_id"), status: text("status").notNull(), winnerKey: text("winner_key"),
  legsA: integer("legs_a"), legsB: integer("legs_b"), firstThrow: integer("first_throw"), firstThrowMethod: text("first_throw_method").notNull(),
  firstThrowDetail: jsonb("first_throw_detail"), resultSource: text("result_source"), simulatedMatchKey: text("simulated_match_key"), summary: jsonb("summary"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.id] }), unique("career_tournament_matches_slot_unique").on(t.careerSaveId, t.eventId, t.stageKey, t.round, t.slot),
  foreignKey({ columns: [t.careerSaveId, t.eventId], foreignColumns: [careerEventInstancesTable.careerSaveId, careerEventInstancesTable.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.careerSaveId, t.aNpcId], foreignColumns: [careerWorldPlayersTable.careerSaveId, careerWorldPlayersTable.id] }),
  foreignKey({ columns: [t.careerSaveId, t.bNpcId], foreignColumns: [careerWorldPlayersTable.careerSaveId, careerWorldPlayersTable.id] }),
  foreignKey({ columns: [t.careerSaveId, t.simulatedMatchKey], foreignColumns: [careerSimulatedMatchesTable.careerSaveId, careerSimulatedMatchesTable.matchKey] }),
  index("career_tournament_matches_pending_idx").on(t.careerSaveId, t.status, t.scheduledDay),
]);

export const careerEventResultsTable = pgTable("career_event_results", {
  careerSaveId: saveFk(), eventId: uuid("event_id").notNull(), participantKey: text("participant_key").notNull(), participantKind: text("participant_kind").notNull(),
  npcId: uuid("npc_id"), season: integer("season").notNull(), definitionKey: text("definition_key").notNull(), finishingPosition: integer("finishing_position").notNull(),
  stageReached: text("stage_reached").notNull(), isChampion: boolean("is_champion").notNull(), matchesPlayed: integer("matches_played").notNull(),
  wins: integer("wins").notNull(), losses: integer("losses").notNull(), legsFor: integer("legs_for").notNull(), legsAgainst: integer("legs_against").notNull(),
  metadata: jsonb("metadata").notNull(), recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.eventId, t.participantKey] }),
  foreignKey({ columns: [t.careerSaveId, t.eventId, t.participantKey], foreignColumns: [careerEventEntriesTable.careerSaveId, careerEventEntriesTable.eventId, careerEventEntriesTable.participantKey] }).onDelete("cascade"),
  foreignKey({ columns: [t.careerSaveId, t.npcId], foreignColumns: [careerWorldPlayersTable.careerSaveId, careerWorldPlayersTable.id] }),
  index("career_event_results_participant_idx").on(t.careerSaveId, t.participantKey, t.season),
  index("career_event_results_definition_idx").on(t.careerSaveId, t.definitionKey, t.season, t.finishingPosition),
  uniqueIndex("career_event_results_one_champion").on(t.careerSaveId, t.eventId).where(sql`${t.isChampion}`),
]);

export const careerQualificationEntitlementsTable = pgTable("career_qualification_entitlements", {
  careerSaveId: saveFk(), id: uuid("id").notNull(), idempotencyKey: text("idempotency_key").notNull(), recipientKey: text("recipient_key").notNull(),
  recipientKind: text("recipient_kind").notNull(), npcId: uuid("npc_id"), entitlementType: text("entitlement_type").notNull(), sourceKind: text("source_kind").notNull(),
  sourceEventId: uuid("source_event_id"), sourcePosition: integer("source_position"), sourceDetail: jsonb("source_detail").notNull(),
  awardedSeason: integer("awarded_season").notNull(), targetKey: text("target_key").notNull(), targetSeason: integer("target_season").notNull(),
  consumption: text("consumption").notNull(), status: text("status").notNull(), consumedByEventId: uuid("consumed_by_event_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.id] }), unique("career_qualification_entitlements_idempotency_unique").on(t.careerSaveId, t.idempotencyKey),
  foreignKey({ columns: [t.careerSaveId, t.sourceEventId], foreignColumns: [careerEventInstancesTable.careerSaveId, careerEventInstancesTable.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.careerSaveId, t.consumedByEventId], foreignColumns: [careerEventInstancesTable.careerSaveId, careerEventInstancesTable.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.careerSaveId, t.npcId], foreignColumns: [careerWorldPlayersTable.careerSaveId, careerWorldPlayersTable.id] }),
  index("career_qualification_entitlements_target_idx").on(t.careerSaveId, t.targetSeason, t.targetKey, t.status),
  index("career_qualification_entitlements_recipient_idx").on(t.careerSaveId, t.recipientKey, t.status),
]);

export const careerCalendarOperationsTable = pgTable("career_calendar_operations", {
  careerSaveId: saveFk(), operationKey: text("operation_key").notNull(), request: jsonb("request").notNull(), result: jsonb("result"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), completedAt: timestamp("completed_at", { withTimezone: true }),
}, t => [primaryKey({ columns: [t.careerSaveId, t.operationKey] })]);
