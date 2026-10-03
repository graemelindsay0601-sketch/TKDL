import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, primaryKey, unique, index, uniqueIndex, foreignKey } from "drizzle-orm/pg-core";
import { careerSavesTable } from "./career-saves";
import { careerEventInstancesTable, careerEventResultsTable } from "./career-calendar";

/**
 * A4 Career finance & sponsorship schema. Mirrors artifacts/api-server/src/db/migrations/create_career_finance.ts,
 * which is authoritative (ledger triggers, check constraints and immutability guards live there).
 */
const saveFk = () => uuid("career_save_id").notNull().references(() => careerSavesTable.id, { onDelete: "cascade" });

export const careerFinanceStateTable = pgTable("career_finance_state", {
  careerSaveId: uuid("career_save_id").primaryKey().references(() => careerSavesTable.id, { onDelete: "cascade" }),
  financeVersion: integer("finance_version").notNull(), sponsorDatabaseVersion: integer("sponsor_database_version").notNull(),
  initializedAt: timestamp("initialized_at", { withTimezone: true }).notNull().defaultNow(),
});

export const careerSponsorOffersTable = pgTable("career_sponsor_offers", {
  careerSaveId: saveFk(), id: uuid("id").notNull(), operationKey: text("operation_key").notNull(), sponsorKey: text("sponsor_key").notNull(),
  sponsorDatabaseVersion: integer("sponsor_database_version").notNull(), tier: text("tier").notNull(), kind: text("kind").notNull(),
  terms: jsonb("terms").notNull(), source: jsonb("source").notNull(), offeredSeason: integer("offered_season").notNull(), offeredWeek: integer("offered_week").notNull(),
  expiresSeason: integer("expires_season").notNull(), expiresWeek: integer("expires_week").notNull(), status: text("status").notNull(), statusReason: text("status_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.id] }), unique("career_sponsor_offers_operation_unique").on(t.careerSaveId, t.operationKey),
  uniqueIndex("career_sponsor_offers_one_open").on(t.careerSaveId, t.sponsorKey).where(sql`${t.status} = 'AVAILABLE'`),
]);

export const careerSponsorContractsTable = pgTable("career_sponsor_contracts", {
  careerSaveId: saveFk(), id: uuid("id").notNull(), offerId: uuid("offer_id").notNull(), sponsorKey: text("sponsor_key").notNull(),
  sponsorDatabaseVersion: integer("sponsor_database_version").notNull(), tier: text("tier").notNull(), terms: jsonb("terms").notNull(),
  startSeason: integer("start_season").notNull(), startWeek: integer("start_week").notNull(), endSeason: integer("end_season").notNull(), endWeek: integer("end_week").notNull(),
  status: text("status").notNull(), endReason: text("end_reason"),
  signedAt: timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(), endedAt: timestamp("ended_at", { withTimezone: true }),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.id] }), unique("career_sponsor_contracts_offer_unique").on(t.careerSaveId, t.offerId),
  foreignKey({ columns: [t.careerSaveId, t.offerId], foreignColumns: [careerSponsorOffersTable.careerSaveId, careerSponsorOffersTable.id] }).onDelete("cascade"),
  uniqueIndex("career_sponsor_contracts_one_active").on(t.careerSaveId).where(sql`${t.status} = 'ACTIVE'`),
]);

export const careerTripsTable = pgTable("career_trips", {
  careerSaveId: saveFk(), id: uuid("id").notNull(), season: integer("season").notNull(), tripKey: text("trip_key").notNull(), band: text("band").notNull(),
  destination: text("destination").notNull(), startDay: integer("start_day").notNull(), endDay: integer("end_day").notNull(), nights: integer("nights").notNull(),
  eventIds: jsonb("event_ids").notNull(), travelGrossPence: integer("travel_gross_pence").notNull(), travelCoveredPence: integer("travel_covered_pence").notNull(),
  accommodationGrossPence: integer("accommodation_gross_pence").notNull(), accommodationCoveredPence: integer("accommodation_covered_pence").notNull(),
  committedSeason: integer("committed_season").notNull(), committedWeek: integer("committed_week").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.careerSaveId, t.id] }), unique("career_trips_key_unique").on(t.careerSaveId, t.season, t.tripKey)]);

export const careerEventFinanceTable = pgTable("career_event_finance", {
  careerSaveId: saveFk(), eventId: uuid("event_id").notNull(), season: integer("season").notNull(), financeVersion: integer("finance_version").notNull(),
  status: text("status").notNull(), snapshot: jsonb("snapshot").notNull(), entryFeeGrossPence: integer("entry_fee_gross_pence").notNull(),
  entryFeeCoveredPence: integer("entry_fee_covered_pence").notNull(), entryFeePaidPence: integer("entry_fee_paid_pence").notNull(),
  estimatedTripPence: integer("estimated_trip_pence").notNull(), tripId: uuid("trip_id"), enteredSeason: integer("entered_season").notNull(), enteredWeek: integer("entered_week").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.eventId] }),
  foreignKey({ columns: [t.careerSaveId, t.eventId], foreignColumns: [careerEventInstancesTable.careerSaveId, careerEventInstancesTable.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.careerSaveId, t.tripId], foreignColumns: [careerTripsTable.careerSaveId, careerTripsTable.id] }).onDelete("cascade"),
  index("career_event_finance_status_idx").on(t.careerSaveId, t.season, t.status),
]);

export const careerEventPrizeTablesTable = pgTable("career_event_prize_tables", {
  careerSaveId: saveFk(), eventId: uuid("event_id").notNull(), season: integer("season").notNull(), financeVersion: integer("finance_version").notNull(),
  prizeProfileKey: text("prize_profile_key").notNull(), classification: text("classification").notNull(), rankingEligible: boolean("ranking_eligible").notNull(),
  bands: jsonb("bands").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.eventId] }),
  foreignKey({ columns: [t.careerSaveId, t.eventId], foreignColumns: [careerEventInstancesTable.careerSaveId, careerEventInstancesTable.id] }).onDelete("cascade"),
]);

export const careerPrizeAwardsTable = pgTable("career_prize_awards", {
  careerSaveId: saveFk(), eventId: uuid("event_id").notNull(), participantKey: text("participant_key").notNull(), season: integer("season").notNull(),
  finishingPosition: integer("finishing_position").notNull(), cashAwardPence: integer("cash_award_pence").notNull(), rankingEligiblePence: integer("ranking_eligible_pence").notNull(),
  classification: text("classification").notNull(), ledgerEntryId: uuid("ledger_entry_id"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.eventId, t.participantKey] }),
  foreignKey({ columns: [t.careerSaveId, t.eventId, t.participantKey], foreignColumns: [careerEventResultsTable.careerSaveId, careerEventResultsTable.eventId, careerEventResultsTable.participantKey] }).onDelete("cascade"),
]);
