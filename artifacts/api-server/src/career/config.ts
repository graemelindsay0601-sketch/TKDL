import { CURRENT_EVENT_DATABASE_VERSION } from "./calendar/config.ts";

/** Persist these independently: application releases are not save versions. */
export const CAREER_VERSIONS = Object.freeze({
  careerSchemaVersion: 1,
  worldGenerationVersion: 1,
  /** New saves use the current catalogue; existing roots migrate forward without rewriting played history. */
  eventDatabaseVersion: CURRENT_EVENT_DATABASE_VERSION,
  playerDatabaseVersion: 8,
});

export const CAREER_SLOTS = [1, 2, 3] as const;
export const CAREER_DIFFICULTIES = ["ACCESSIBLE", "STANDARD", "CHALLENGING"] as const;
export type CareerDifficulty = typeof CAREER_DIFFICULTIES[number];
export const CAREER_FEATURE = "tour_career_2";

/** Fictional GBP, stored as integer pence. Never TKDL coins or league points. */
export const CAREER_DEFAULTS = Object.freeze({
  difficulty: "STANDARD" as CareerDifficulty,
  currentSeason: 1,
  currentWeek: 1,
  balancePence: 25_000,
  professionalRanking: null,
  professionalRankingMoneyPence: 0,
  sponsor: null,
  hasTourCard: false,
  standing: "Unknown Amateur",
  currency: "GBP",
  competitionCategory:"OPEN",
});
