import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, bigint, boolean, jsonb, timestamp, primaryKey, unique, index, uniqueIndex, foreignKey } from "drizzle-orm/pg-core";
import { careerSavesTable } from "./career-saves";
import { careerEventResultsTable } from "./career-calendar";
import { careerEventPrizeTablesTable } from "./career-finance";

/**
 * A5 Career sporting schema (rankings, Tour Cards, Q-School, milestones). Mirrors
 * artifacts/api-server/src/db/migrations/create_career_sporting.ts, which is
 * authoritative (immutability triggers, the Tour Card guard and check constraints live there).
 */
const saveFk = () => uuid("career_save_id").notNull().references(() => careerSavesTable.id, { onDelete: "cascade" });
const big = (name: string) => bigint(name, { mode: "number" });

export const careerSportingStateTable = pgTable("career_sporting_state", {
  careerSaveId: uuid("career_save_id").primaryKey().references(() => careerSavesTable.id, { onDelete: "cascade" }),
  rankingRulesVersion: integer("ranking_rules_version").notNull(), tourCardRulesVersion: integer("tour_card_rules_version").notNull(),
  qSchoolRulesVersion: integer("q_school_rules_version").notNull(), forcePublish: boolean("force_publish").notNull().default(false),
  reviewedSeason: integer("reviewed_season").notNull().default(0), initializedAt: timestamp("initialized_at", { withTimezone: true }).notNull().defaultNow(),
});

export const careerRankingContributionsTable = pgTable("career_ranking_contributions", {
  careerSaveId: saveFk(), id: uuid("id").notNull(), listKey: text("list_key").notNull(), participantKey: text("participant_key").notNull(),
  participantKind: text("participant_kind").notNull(), npcId: uuid("npc_id"), eventId: uuid("event_id").notNull(), season: integer("season").notNull(), week: integer("week").notNull(),
  completionIndex: integer("completion_index").notNull(), expiresIndex: integer("expires_index").notNull(), finishingPosition: integer("finishing_position").notNull(),
  amountPence: big("amount_pence").notNull(), source: text("source").notNull(), rankingCategory: text("ranking_category").notNull(),
  rankingRulesVersion: integer("ranking_rules_version").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.id] }), unique("career_ranking_contributions_once").on(t.careerSaveId, t.listKey, t.eventId, t.participantKey),
  foreignKey({ columns: [t.careerSaveId, t.eventId, t.participantKey], foreignColumns: [careerEventResultsTable.careerSaveId, careerEventResultsTable.eventId, careerEventResultsTable.participantKey] }).onDelete("cascade"),
  foreignKey({ columns: [t.careerSaveId, t.eventId], foreignColumns: [careerEventPrizeTablesTable.careerSaveId, careerEventPrizeTablesTable.eventId] }).onDelete("cascade"),
  index("career_ranking_contributions_window_idx").on(t.careerSaveId, t.listKey, t.completionIndex, t.expiresIndex),
  index("career_ranking_contributions_participant_idx").on(t.careerSaveId, t.listKey, t.participantKey, t.completionIndex),
]);

export const careerRankingSnapshotsTable = pgTable("career_ranking_snapshots", {
  careerSaveId: saveFk(), id: uuid("id").notNull(), listKey: text("list_key").notNull(), sequence: integer("sequence").notNull(), season: integer("season").notNull(),
  week: integer("week").notNull(), publicationIndex: integer("publication_index").notNull(), rankingRulesVersion: integer("ranking_rules_version").notNull(),
  participantCount: integer("participant_count").notNull(), countedContributions: integer("counted_contributions").notNull(), newContributions: integer("new_contributions").notNull(),
  expiredContributions: integer("expired_contributions").notNull(), removedRetired: integer("removed_retired").notNull().default(0), cutValues: jsonb("cut_values").notNull(),
  reason: text("reason").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.id] }), unique("career_ranking_snapshots_publication").on(t.careerSaveId, t.listKey, t.publicationIndex),
  unique("career_ranking_snapshots_sequence").on(t.careerSaveId, t.listKey, t.sequence),
]);

export const careerRankingSnapshotRowsTable = pgTable("career_ranking_snapshot_rows", {
  careerSaveId: saveFk(), snapshotId: uuid("snapshot_id").notNull(), listKey: text("list_key").notNull(), publicationIndex: integer("publication_index").notNull(),
  season: integer("season").notNull(), participantKey: text("participant_key").notNull(), participantKind: text("participant_kind").notNull(), npcId: uuid("npc_id"),
  position: integer("position").notNull(), valuePence: big("value_pence").notNull(), previousPosition: integer("previous_position"), movement: integer("movement"),
  isNew: boolean("is_new").notNull(), gapAbovePence: big("gap_above_pence"), gapBelowPence: big("gap_below_pence"),
  careerHighPosition: integer("career_high_position").notNull(), countedContributions: integer("counted_contributions").notNull(),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.snapshotId, t.participantKey] }), unique("career_ranking_snapshot_rows_position").on(t.careerSaveId, t.snapshotId, t.position),
  foreignKey({ columns: [t.careerSaveId, t.snapshotId], foreignColumns: [careerRankingSnapshotsTable.careerSaveId, careerRankingSnapshotsTable.id] }).onDelete("cascade"),
  index("career_ranking_snapshot_rows_history_idx").on(t.careerSaveId, t.listKey, t.participantKey, t.publicationIndex),
]);

export const careerRankingParticipantsTable = pgTable("career_ranking_participants", {
  careerSaveId: saveFk(), listKey: text("list_key").notNull(), participantKey: text("participant_key").notNull(), participantKind: text("participant_kind").notNull(),
  npcId: uuid("npc_id"), currentPosition: integer("current_position"), currentValuePence: big("current_value_pence").notNull().default(0), previousPosition: integer("previous_position"),
  careerHighPosition: integer("career_high_position").notNull(), careerHighIndex: integer("career_high_index").notNull(), firstRankedIndex: integer("first_ranked_index").notNull(),
  updatedIndex: integer("updated_index").notNull(),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.listKey, t.participantKey] }),
  index("career_ranking_participants_position").on(t.careerSaveId, t.listKey, t.currentPosition).where(sql`${t.currentPosition} IS NOT NULL`),
]);

export const careerTourCardsTable = pgTable("career_tour_cards", {
  careerSaveId: saveFk(), id: uuid("id").notNull(), operationKey: text("operation_key").notNull(), participantKey: text("participant_key").notNull(),
  participantKind: text("participant_kind").notNull(), npcId: uuid("npc_id"), source: text("source").notNull(), sourceDetail: jsonb("source_detail").notNull(),
  sourceEventId: uuid("source_event_id"), awardedSeason: integer("awarded_season").notNull(), awardedWeek: integer("awarded_week").notNull(),
  startSeason: integer("start_season").notNull(), endSeason: integer("end_season").notNull(), status: text("status").notNull(), endReason: text("end_reason"),
  endedSeason: integer("ended_season"), endedWeek: integer("ended_week"), previousCardId: uuid("previous_card_id"), tourCardRulesVersion: integer("tour_card_rules_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.id] }), unique("career_tour_cards_operation").on(t.careerSaveId, t.operationKey),
  uniqueIndex("career_tour_cards_one_active").on(t.careerSaveId, t.participantKey).where(sql`${t.status} = 'ACTIVE'`),
  index("career_tour_cards_participant_idx").on(t.careerSaveId, t.participantKey, t.startSeason),
]);

export const careerQSchoolResultsTable = pgTable("career_qschool_results", {
  careerSaveId: saveFk(), eventId: uuid("event_id").notNull(), participantKey: text("participant_key").notNull(), participantKind: text("participant_kind").notNull(),
  npcId: uuid("npc_id"), season: integer("season").notNull(), pathway: text("pathway").notNull(), stage: text("stage").notNull(), seriesDay: integer("series_day").notNull(),
  finishingPosition: integer("finishing_position").notNull(), points: integer("points").notNull(), legsFor: integer("legs_for").notNull(), legsAgainst: integer("legs_against").notNull(),
  qSchoolRulesVersion: integer("q_school_rules_version").notNull(),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.eventId, t.participantKey] }),
  foreignKey({ columns: [t.careerSaveId, t.eventId, t.participantKey], foreignColumns: [careerEventResultsTable.careerSaveId, careerEventResultsTable.eventId, careerEventResultsTable.participantKey] }).onDelete("cascade"),
  index("career_qschool_results_standing_idx").on(t.careerSaveId, t.season, t.pathway, t.stage, t.participantKey),
]);

export const careerQSchoolAllocationsTable = pgTable("career_qschool_allocations", {
  careerSaveId: saveFk(), season: integer("season").notNull(), pathway: text("pathway").notNull(), allocatedWeek: integer("allocated_week").notNull(),
  finalDays: integer("final_days").notNull(), completedDays: integer("completed_days").notNull(), directCards: integer("direct_cards").notNull(),
  unusedDirectCards: integer("unused_direct_cards").notNull(), orderOfMeritCards: integer("order_of_merit_cards").notNull(), standings: jsonb("standings").notNull(),
  qSchoolRulesVersion: integer("q_school_rules_version").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.careerSaveId, t.season, t.pathway] })]);

export const careerQSchoolCardAwardsTable = pgTable("career_qschool_card_awards", {
  careerSaveId: saveFk(), season: integer("season").notNull(), pathway: text("pathway").notNull(), participantKey: text("participant_key").notNull(),
  route: text("route").notNull(), seriesDay: integer("series_day"), orderOfMeritPosition: integer("order_of_merit_position"), points: integer("points").notNull(), cardId: uuid("card_id").notNull(),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.season, t.participantKey] }), unique("career_qschool_card_awards_card").on(t.careerSaveId, t.cardId),
  foreignKey({ columns: [t.careerSaveId, t.season, t.pathway], foreignColumns: [careerQSchoolAllocationsTable.careerSaveId, careerQSchoolAllocationsTable.season, careerQSchoolAllocationsTable.pathway] }).onDelete("cascade"),
  foreignKey({ columns: [t.careerSaveId, t.cardId], foreignColumns: [careerTourCardsTable.careerSaveId, careerTourCardsTable.id] }).onDelete("cascade"),
]);

export const careerSportingMilestonesTable = pgTable("career_sporting_milestones", {
  careerSaveId: saveFk(), id: uuid("id").notNull(), operationKey: text("operation_key").notNull(), participantKey: text("participant_key").notNull(),
  participantKind: text("participant_kind").notNull(), npcId: uuid("npc_id"), kind: text("kind").notNull(), listKey: text("list_key"), season: integer("season").notNull(),
  week: integer("week").notNull(), detail: jsonb("detail").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.id] }), unique("career_sporting_milestones_operation").on(t.careerSaveId, t.operationKey),
  index("career_sporting_milestones_participant_idx").on(t.careerSaveId, t.participantKey, t.season, t.week),
]);
