/**
 * A3 calendar constants. Event database v1 is immutable once shipped: changing an
 * authored definition requires a new eventDatabaseVersion branch, never an edit.
 */
export const EVENT_DATABASE_VERSION = 1;
/**
 * A6.5 adds event database v2 (Junior Development Circuit, The Double Crown,
 * age eligibility). New saves start on v2; v1 saves keep v1 for life.
 */
export const CURRENT_EVENT_DATABASE_VERSION = 5;
export const SUPPORTED_EVENT_DATABASE_VERSIONS = [1, 2, 3, 4, 5] as const;
/** Season generation algorithm version, part of every calendar RNG scope. */
export const CALENDAR_GENERATION_VERSION = 1;

export const WEEKS_PER_SEASON = 52;
export const DAYS_PER_WEEK = 7;
export const DAYS_PER_SEASON = WEEKS_PER_SEASON * DAYS_PER_WEEK;

/** Presentation/organisation groupings only. Never progression gates. */
export const SEASON_GROUPINGS = [
  { key: "OPENING_SWING", name: "Opening Swing", fromWeek: 1, toWeek: 8 },
  { key: "SPRING_CIRCUIT", name: "Spring Circuit", fromWeek: 9, toWeek: 16 },
  { key: "SUMMER_TOUR", name: "Summer Tour", fromWeek: 17, toWeek: 32 },
  { key: "MAJOR_SEASON", name: "Major Season", fromWeek: 33, toWeek: 44 },
  { key: "WORLD_CHAMPIONSHIP_PERIOD", name: "World Championship Period", fromWeek: 45, toWeek: 52 },
] as const;
export type SeasonGroupingKey = typeof SEASON_GROUPINGS[number]["key"];
export const groupingForWeek = (week: number) => {
  const grouping = SEASON_GROUPINGS.find(g => week >= g.fromWeek && week <= g.toWeek);
  if (!grouping) throw new Error(`Week ${week} is outside the 52-week season`);
  return grouping;
};

/**
 * Canonical A2 development cadence: exactly one A2 PERIOD per elapsed Career week.
 * Period N is processed when week N has been played out. 52 periods per season,
 * each 1/52 of a year, then A2 processOffSeason exactly once.
 */
export const DEVELOPMENT_CADENCE = Object.freeze({
  periodsPerSeason: WEEKS_PER_SEASON,
  elapsedYearsPerPeriod: 1 / WEEKS_PER_SEASON,
  /** A2 takes one world-level opportunity scalar per period. Fixed for determinism. */
  opportunity: 0.5,
  offSeasonOpportunity: 0.5,
});

export const CIRCUITS = [
  "GRASSROOTS", "COUNTY", "REGIONAL", "NATIONAL_AMATEUR", "CHALLENGER", "VAULT", "Q_SCHOOL",
  "PRO_CIRCUIT", "EUROPEAN_SERIES", "WORLD_SERIES", "INVITATIONAL", "MAJOR", "WORLD_CHAMPIONSHIP", "SPECIAL",
] as const;
export type Circuit = typeof CIRCUITS[number];

export const CLASSIFICATIONS = ["RANKING", "QUALIFIER", "INVITATIONAL_EXHIBITION", "SPECIAL"] as const;
export type Classification = typeof CLASSIFICATIONS[number];

export const PRESENTATION_TIERS = ["LOCAL", "STANDARD", "FEATURED", "TELEVISED", "MAJOR", "WORLD"] as const;
export type PresentationTier = typeof PRESENTATION_TIERS[number];

export const EVENT_STATUSES = [
  "SCHEDULED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "DRAW_PENDING", "DRAWN", "IN_PROGRESS", "COMPLETED", "CANCELLED",
] as const;
export type EventStatus = typeof EVENT_STATUSES[number];

/** Upper bound on NPC fields so 220 NPCs can fill hundreds of events without fabrication. */
export const FIELD_SIZES = [8, 16, 24, 32, 48, 64, 96, 128] as const;
