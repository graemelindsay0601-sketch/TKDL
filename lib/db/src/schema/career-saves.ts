import { sql } from "drizzle-orm";
import { pgTable, uuid, integer, text, timestamp, jsonb, boolean, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { playersTable } from "./players";

/** A save ID is a universe boundary. Restart replaces it; retirement preserves it. */
export const careerSavesTable = pgTable("career_saves", {
  id: uuid("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  slotNumber: integer("slot_number").notNull(),
  careerName: text("career_name"),
  status: text("status").$type<"ACTIVE" | "RETIRED">().notNull(),
  difficulty: text("difficulty").$type<"ACCESSIBLE" | "STANDARD" | "CHALLENGING">().notNull(),
  currentSeason: integer("current_season").notNull(),
  currentWeek: integer("current_week").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
  careerSchemaVersion: integer("career_schema_version").notNull(),
  worldGenerationVersion: integer("world_generation_version").notNull(),
  eventDatabaseVersion: integer("event_database_version").notNull(),
  playerDatabaseVersion: integer("player_database_version").notNull(),
  worldSeed: text("world_seed").notNull(),
  settingsSnapshot: jsonb("settings_snapshot").$type<Record<string, unknown>>().notNull(),
  careerFocus: text("career_focus").notNull().default("OPEN_SCHEDULE"),
  balancePence: integer("balance_pence").notNull(),
  standing: text("standing").notNull(),
  professionalRanking: integer("professional_ranking"),
  professionalRankingMoneyPence: integer("professional_ranking_money_pence").notNull(),
  sponsor: text("sponsor"),
  hasTourCard: boolean("has_tour_card").notNull(),
}, t => [
  uniqueIndex("career_saves_active_slot_unique").on(t.playerId, t.slotNumber).where(sql`${t.status} = 'ACTIVE'`),
  index("career_saves_player_status_idx").on(t.playerId, t.status),
  check("career_saves_slot_check", sql`${t.slotNumber} BETWEEN 1 AND 3`),
  check("career_saves_status_check", sql`${t.status} IN ('ACTIVE', 'RETIRED')`),
  check("career_saves_difficulty_check", sql`${t.difficulty} IN ('ACCESSIBLE', 'STANDARD', 'CHALLENGING')`),
  check("career_saves_name_check", sql`${t.careerName} IS NULL OR char_length(btrim(${t.careerName})) BETWEEN 1 AND 80`),
  check("career_saves_time_check", sql`${t.currentSeason} > 0 AND ${t.currentWeek} > 0`),
  check("career_saves_retired_check", sql`(${t.status} = 'RETIRED') = (${t.retiredAt} IS NOT NULL)`),
  check("career_saves_versions_check", sql`${t.careerSchemaVersion} > 0 AND ${t.worldGenerationVersion} > 0 AND ${t.eventDatabaseVersion} > 0 AND ${t.playerDatabaseVersion} > 0`),
  check("career_saves_seed_check", sql`${t.worldSeed} ~ '^[0-9a-f]{64}$'`),
  check("career_saves_settings_check", sql`jsonb_typeof(${t.settingsSnapshot}) = 'object'`),
  // A4: the balance is a cache of the immutable ledger and can never go negative.
  check("career_saves_balance_nonnegative", sql`${t.balancePence} >= 0`),
  check("career_saves_ranking_check", sql`${t.professionalRanking} IS NULL OR ${t.professionalRanking} > 0`),
  check("career_saves_focus_check",sql`${t.careerFocus} IN ('OPEN_SCHEDULE','PROFESSIONAL_PATHWAY','AMATEUR_CIRCUIT','PRIZE_MONEY','MAJOR_QUALIFICATION')`),
  check("career_saves_ranking_money_check", sql`${t.professionalRankingMoneyPence} >= 0`),
]);

/** Career-only ledger foundation; all future entries belong to the save, never the player. */
export const careerFinanceEntriesTable = pgTable("career_finance_entries", {
  id: uuid("id").primaryKey(),
  careerSaveId: uuid("career_save_id").notNull().references(() => careerSavesTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  amountPence: integer("amount_pence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // A4 ledger columns (see create_career_finance.ts, which also installs the defaults/immutability triggers and composite FKs).
  category: text("category").notNull(), headline: text("headline").notNull(), operationKey: text("operation_key").notNull(),
  season: integer("season"), week: integer("week"), eventId: uuid("event_id"), tripId: uuid("trip_id"), contractId: uuid("contract_id"),
  reversesEntryId: uuid("reverses_entry_id"), grossAmountPence: integer("gross_amount_pence"), sponsorCoveredPence: integer("sponsor_covered_pence").notNull().default(0),
  financeVersion: integer("finance_version"), reason: text("reason"), detail: jsonb("detail").notNull().default(sql`'{}'::jsonb`),
}, t => [
  index("career_finance_entries_save_idx").on(t.careerSaveId),
  uniqueIndex("career_finance_entries_operation_unique").on(t.careerSaveId, t.operationKey),
  uniqueIndex("career_finance_entries_save_id_unique").on(t.careerSaveId, t.id),
  index("career_finance_entries_recent_idx").on(t.careerSaveId, t.createdAt, t.id),
]);

export type CareerSave = typeof careerSavesTable.$inferSelect;
export type CareerFinanceEntry = typeof careerFinanceEntriesTable.$inferSelect;
