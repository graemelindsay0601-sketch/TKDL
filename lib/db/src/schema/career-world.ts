import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, doublePrecision, jsonb, timestamp, primaryKey, unique, index, foreignKey, check } from "drizzle-orm/pg-core";
import { careerSavesTable } from "./career-saves";

export const careerWorldStateTable = pgTable("career_world_state", {
  careerSaveId: uuid("career_save_id").primaryKey().references(() => careerSavesTable.id, { onDelete: "cascade" }),
  generationVersion: integer("generation_version").notNull(), simulationVersion: integer("simulation_version").notNull(),
  season: integer("season").notNull(), period: integer("period").notNull(), elapsedYear: doublePrecision("elapsed_year").notNull(),
  configSnapshot: jsonb("config_snapshot").notNull(), initializedAt: timestamp("initialized_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  check("career_world_state_generation_version_check", sql`${t.generationVersion} > 0`),
  check("career_world_state_simulation_version_check", sql`${t.simulationVersion} > 0`),
  check("career_world_state_season_check", sql`${t.season} > 0`), check("career_world_state_period_check", sql`${t.period} >= 0`),
  check("career_world_state_elapsed_year_check", sql`${t.elapsedYear} BETWEEN 0 AND 1`),
  check("career_world_state_config_snapshot_check", sql`jsonb_typeof(${t.configSnapshot}) = 'object'`),
]);

export const careerWorldPlayersTable = pgTable("career_world_players", {
  careerSaveId: uuid("career_save_id").notNull().references(() => careerSavesTable.id, { onDelete: "cascade" }), id: uuid("id").notNull(),
  worldKey: text("world_key").notNull(), firstName: text("first_name").notNull(), surname: text("surname").notNull(), nickname: text("nickname"),
  nationality: text("nationality").notNull(), homeRegion: text("home_region").notNull(), dominantHand: text("dominant_hand").notNull(),
  startingAge: integer("starting_age").notNull(), age: integer("age").notNull(), stage: text("stage").notNull(), tier: text("tier").notNull(),
  professionalStatus: text("professional_status").notNull(), detailTier: text("detail_tier").notNull(), templateKey: text("template_key"),
  status: text("status").notNull(), createdSeason: integer("created_season").notNull(), retiredSeason: integer("retired_season"),
  scoring: doublePrecision("scoring").notNull(), finishing: doublePrecision("finishing").notNull(), consistency: doublePrecision("consistency").notNull(),
  pressure: doublePrecision("pressure").notNull(), powerScoring: doublePrecision("power_scoring").notNull(), clutch: doublePrecision("clutch").notNull(),
  form: doublePrecision("form").notNull(), potential: doublePrecision("potential").notNull(), developmentRate: doublePrecision("development_rate").notNull(),
  developmentVolatility: doublePrecision("development_volatility").notNull(), peakStart: integer("peak_start").notNull(), peakEnd: integer("peak_end").notNull(),
  breakthroughAge: integer("breakthrough_age").notNull(), declineProfile: text("decline_profile").notNull(), lowAbilityYears: doublePrecision("low_ability_years").notNull(),
  recentDevelopment: doublePrecision("recent_development").notNull(), tendencies: jsonb("tendencies").notNull(),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.id] }), unique("career_world_players_identity_unique").on(t.careerSaveId, t.worldKey),
  index("career_world_players_active_tier_idx").on(t.careerSaveId, t.status, t.tier),
  check("career_world_players_first_name_check", sql`length(${t.firstName}) BETWEEN 1 AND 80`),
  check("career_world_players_surname_check", sql`length(${t.surname}) BETWEEN 1 AND 160`),
  check("career_world_players_nationality_check", sql`length(${t.nationality}) BETWEEN 2 AND 3`),
  check("career_world_players_dominant_hand_check", sql`${t.dominantHand} IN ('RIGHT', 'LEFT')`),
  check("career_world_players_starting_age_check", sql`${t.startingAge} BETWEEN 16 AND 110`),
  check("career_world_players_age_check", sql`${t.age} BETWEEN 16 AND 110`),
  check("career_world_players_stage_check", sql`${t.stage} IN ('PROSPECT', 'DEVELOPING', 'PRIME', 'VETERAN', 'RETIRED')`),
  check("career_world_players_tier_check", sql`${t.tier} IN ('GRASSROOTS', 'AMATEUR', 'PROFESSIONAL', 'ELITE')`),
  check("career_world_players_professional_status_check", sql`${t.professionalStatus} IN ('AMATEUR', 'PROFESSIONAL')`),
  check("career_world_players_detail_tier_check", sql`${t.detailTier} IN ('BASIC', 'STANDARD', 'FEATURED')`),
  check("career_world_players_status_check", sql`${t.status} IN ('ACTIVE', 'RETIRED')`),
  check("career_world_players_created_season_check", sql`${t.createdSeason} > 0`),
  ...([t.scoring, t.finishing, t.consistency, t.pressure, t.powerScoring, t.clutch, t.potential] as const)
    .map(column => check(`career_world_players_${column.name}_check`, sql`${column} BETWEEN 1 AND 100`)),
  check("career_world_players_form_check", sql`${t.form} BETWEEN -1 AND 1`),
  check("career_world_players_development_rate_check", sql`${t.developmentRate} BETWEEN 0 AND 10`),
  check("career_world_players_development_volatility_check", sql`${t.developmentVolatility} BETWEEN 0 AND 5`),
  check("career_world_players_peak_start_check", sql`${t.peakStart} BETWEEN 18 AND 70`),
  check("career_world_players_peak_end_check", sql`${t.peakEnd} BETWEEN 18 AND 80 AND ${t.peakEnd} >= ${t.peakStart}`),
  check("career_world_players_breakthrough_age_check", sql`${t.breakthroughAge} BETWEEN 16 AND 70`),
  check("career_world_players_decline_profile_check", sql`${t.declineProfile} IN ('GRADUAL', 'PLATEAU', 'SHARP', 'EARLY')`),
  check("career_world_players_low_ability_years_check", sql`${t.lowAbilityYears} BETWEEN 0 AND 110`),
  check("career_world_players_recent_development_check", sql`${t.recentDevelopment} BETWEEN -100 AND 100`),
  check("career_world_players_retirement_check", sql`(${t.status} = 'RETIRED') = (${t.retiredSeason} IS NOT NULL) AND (${t.status} = 'RETIRED') = (${t.stage} = 'RETIRED') AND (${t.retiredSeason} IS NULL OR ${t.retiredSeason} >= ${t.createdSeason})`),
  check("career_world_players_tendencies_check", sql`COALESCE(jsonb_typeof(${t.tendencies}) = 'object' AND ${t.tendencies} ?& ARRAY['local','floor','stage','qualifier','major']
    AND jsonb_typeof(${t.tendencies}->'local') = 'number' AND (${t.tendencies}->>'local')::double precision BETWEEN -2 AND 2
    AND jsonb_typeof(${t.tendencies}->'floor') = 'number' AND (${t.tendencies}->>'floor')::double precision BETWEEN -2 AND 2
    AND jsonb_typeof(${t.tendencies}->'stage') = 'number' AND (${t.tendencies}->>'stage')::double precision BETWEEN -2 AND 2
    AND jsonb_typeof(${t.tendencies}->'qualifier') = 'number' AND (${t.tendencies}->>'qualifier')::double precision BETWEEN -2 AND 2
    AND jsonb_typeof(${t.tendencies}->'major') = 'number' AND (${t.tendencies}->>'major')::double precision BETWEEN -2 AND 2, false)`),
]);

export const careerWorldPeriodsTable = pgTable("career_world_periods", {
  careerSaveId: uuid("career_save_id").notNull().references(() => careerSavesTable.id, { onDelete: "cascade" }),
  season: integer("season").notNull(), kind: text("kind").notNull(), sequence: integer("sequence").notNull(),
  request: jsonb("request").notNull(), summary: jsonb("summary").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.season, t.kind, t.sequence] }),
  check("career_world_periods_season_check", sql`${t.season} > 0`), check("career_world_periods_sequence_check", sql`${t.sequence} >= 0`),
  check("career_world_periods_kind_check", sql`${t.kind} IN ('PERIOD', 'OFF_SEASON')`),
  check("career_world_periods_request_check", sql`jsonb_typeof(${t.request}) = 'object'`), check("career_world_periods_summary_check", sql`jsonb_typeof(${t.summary}) = 'object'`),
]);

export const careerSimulatedMatchesTable = pgTable("career_simulated_matches", {
  careerSaveId: uuid("career_save_id").notNull().references(() => careerSavesTable.id, { onDelete: "cascade" }), id: uuid("id").notNull(),
  matchKey: text("match_key").notNull(), season: integer("season").notNull(), period: integer("period").notNull(), simulationVersion: integer("simulation_version").notNull(),
  playerAId: uuid("player_a_id").notNull(), playerBId: uuid("player_b_id").notNull(), winnerId: uuid("winner_id").notNull(),
  request: jsonb("request").notNull(), inputSnapshot: jsonb("input_snapshot").notNull(), result: jsonb("result").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.careerSaveId, t.id] }), unique("career_simulated_matches_key_unique").on(t.careerSaveId, t.matchKey),
  foreignKey({ columns: [t.careerSaveId, t.playerAId], foreignColumns: [careerWorldPlayersTable.careerSaveId, careerWorldPlayersTable.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.careerSaveId, t.playerBId], foreignColumns: [careerWorldPlayersTable.careerSaveId, careerWorldPlayersTable.id] }).onDelete("cascade"),
  index("career_simulated_matches_a_idx").on(t.careerSaveId, t.playerAId, t.completedAt), index("career_simulated_matches_b_idx").on(t.careerSaveId, t.playerBId, t.completedAt),
  check("career_simulated_matches_match_key_check", sql`length(${t.matchKey}) BETWEEN 1 AND 120`),
  check("career_simulated_matches_season_check", sql`${t.season} > 0`), check("career_simulated_matches_period_check", sql`${t.period} >= 0`),
  check("career_simulated_matches_simulation_version_check", sql`${t.simulationVersion} > 0`),
  check("career_simulated_matches_participants_check", sql`${t.playerAId} <> ${t.playerBId} AND ${t.winnerId} IN (${t.playerAId}, ${t.playerBId})`),
  check("career_simulated_matches_request_check", sql`jsonb_typeof(${t.request}) = 'object'`), check("career_simulated_matches_input_snapshot_check", sql`jsonb_typeof(${t.inputSnapshot}) = 'object'`),
  check("career_simulated_matches_result_check", sql`jsonb_typeof(${t.result}) = 'object'`),
]);
