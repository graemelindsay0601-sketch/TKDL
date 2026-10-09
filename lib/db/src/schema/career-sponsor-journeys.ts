import { sql } from "drizzle-orm";
import { foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { careerSavesTable } from "./career-saves";
import { careerSponsorContractsTable, careerSponsorOffersTable } from "./career-finance";

const saveFk = () => uuid("career_save_id").notNull().references(() => careerSavesTable.id, { onDelete: "cascade" });

/**
 * SP-B save-scoped commercial journey state. A4 offers and contracts remain the
 * financial authority; these rows only track interest, negotiation and history.
 */
export const careerSponsorJourneysTable = pgTable("career_sponsor_journeys", {
  careerSaveId: saveFk(),
  id: uuid("id").notNull(),
  operationKey: text("operation_key").notNull(),
  sponsorKey: text("sponsor_key").notNull(),
  sponsorDatabaseVersion: integer("sponsor_database_version").notNull(),
  openingOfferId: uuid("opening_offer_id"),
  currentOfferId: uuid("current_offer_id"),
  signedContractId: uuid("signed_contract_id"),
  status: text("status").notNull(),
  revision: integer("revision").notNull().default(0),
  negotiationRounds: integer("negotiation_rounds").notNull().default(0),
  representative: jsonb("representative"),
  brandPersonality: text("brand_personality").notNull(),
  source: jsonb("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.id] }),
  unique("career_sponsor_journeys_operation_unique").on(t.careerSaveId, t.operationKey),
  unique("career_sponsor_journeys_opening_offer_unique").on(t.careerSaveId, t.openingOfferId),
  foreignKey({ columns: [t.careerSaveId, t.openingOfferId], foreignColumns: [careerSponsorOffersTable.careerSaveId, careerSponsorOffersTable.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.careerSaveId, t.currentOfferId], foreignColumns: [careerSponsorOffersTable.careerSaveId, careerSponsorOffersTable.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.careerSaveId, t.signedContractId], foreignColumns: [careerSponsorContractsTable.careerSaveId, careerSponsorContractsTable.id] }).onDelete("cascade"),
  index("career_sponsor_journeys_current_idx").on(t.careerSaveId, t.currentOfferId),
  index("career_sponsor_journeys_status_idx").on(t.careerSaveId, t.status, t.updatedAt),
]);

export const careerSponsorJourneyEventsTable = pgTable("career_sponsor_journey_events", {
  careerSaveId: saveFk(),
  id: uuid("id").notNull(),
  journeyId: uuid("journey_id").notNull(),
  ordinal: integer("ordinal").notNull(),
  eventKey: text("event_key").notNull(),
  eventType: text("event_type").notNull(),
  offerId: uuid("offer_id"),
  season: integer("season"),
  week: integer("week"),
  details: jsonb("details").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.id] }),
  unique("career_sponsor_journey_events_key_unique").on(t.careerSaveId, t.eventKey),
  unique("career_sponsor_journey_events_ordinal_unique").on(t.careerSaveId, t.journeyId, t.ordinal),
  foreignKey({ columns: [t.careerSaveId, t.journeyId], foreignColumns: [careerSponsorJourneysTable.careerSaveId, careerSponsorJourneysTable.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.careerSaveId, t.offerId], foreignColumns: [careerSponsorOffersTable.careerSaveId, careerSponsorOffersTable.id] }).onDelete("cascade"),
  index("career_sponsor_journey_events_timeline_idx").on(t.careerSaveId, t.journeyId, t.createdAt),
]);

export const careerSponsorNegotiationsTable = pgTable("career_sponsor_negotiations", {
  careerSaveId: saveFk(),
  id: uuid("id").notNull(),
  journeyId: uuid("journey_id").notNull(),
  requestKey: text("request_key").notNull(),
  round: integer("round").notNull(),
  sourceOfferId: uuid("source_offer_id").notNull(),
  responseOfferId: uuid("response_offer_id"),
  request: jsonb("request").notNull(),
  outcome: text("outcome").notNull(),
  response: jsonb("response").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.id] }),
  unique("career_sponsor_negotiations_request_unique").on(t.careerSaveId, t.requestKey),
  uniqueIndex("career_sponsor_negotiations_round_unique_idx")
    .on(t.careerSaveId, t.journeyId, t.round).where(sql`outcome <> 'EXPIRED'`),
  foreignKey({ columns: [t.careerSaveId, t.journeyId], foreignColumns: [careerSponsorJourneysTable.careerSaveId, careerSponsorJourneysTable.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.careerSaveId, t.sourceOfferId], foreignColumns: [careerSponsorOffersTable.careerSaveId, careerSponsorOffersTable.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.careerSaveId, t.responseOfferId], foreignColumns: [careerSponsorOffersTable.careerSaveId, careerSponsorOffersTable.id] }).onDelete("cascade"),
]);
