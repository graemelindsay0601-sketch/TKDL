import type { QSchoolPathway } from "../calendar/eligibility.ts";
import { WEEKS_PER_SEASON } from "../calendar/config.ts";

/**
 * A5 sporting rules. Every persisted contribution, snapshot, card and Q-School
 * allocation records the rules version that produced it. Shipped versions are
 * immutable: a rule change is a new version, never an edit of v1, so history is
 * never silently rewritten. There is no XP, no tier-unlock score and no
 * difficulty input anywhere in these rules.
 */
export const RANKING_RULES_VERSION = 1;
export const TOUR_CARD_RULES_VERSION = 1;
export const Q_SCHOOL_RULES_VERSION = 1;
export const SUPPORTED_SPORTING_VERSIONS = { ranking: [1, 2], tourCard: [1], qSchool: [1] } as const;

/** Linear Career clock: (season, week) -> publication index. Week 52 of season S = S*52. */
export const timeIndex = (season: number, week: number) => (season - 1) * WEEKS_PER_SEASON + week;
export const seasonOfIndex = (index: number) => Math.floor((index - 1) / WEEKS_PER_SEASON) + 1;
export const weekOfIndex = (index: number) => ((index - 1) % WEEKS_PER_SEASON) + 1;

// ------------------------------------------------------------------ rankings
export type RankingWindow = { kind: "ROLLING"; weeks: number } | { kind: "SEASON" };
export type RankingListDefinition = {
  key: string; name: string; scope: "PROFESSIONAL" | "SECONDARY" | "AMATEUR";
  /** A3 instance `ranking_category` values that contribute (only classification RANKING events carry one). */
  categories: readonly string[];
  window: RankingWindow;
  /** Qualification/cut lines reported with every snapshot (gap-to-cut facts for A6). */
  cutLines: readonly number[];
  /** One-time "entered top N" milestone thresholds (1 = #1). */
  milestoneThresholds: readonly number[];
};

/**
 * Ranking value = SUM of A4 ranking-eligible prize money (integer pence) from
 * counting contributions. A5 never prices a result itself: the amount is A4's
 * `career_prize_awards.ranking_eligible_pence` (human) or A4's immutable
 * `career_event_prize_tables` band at the finishing position (everyone else),
 * and only when that table is ranking-eligible.
 */
export const RANKING_LISTS_V1: readonly RankingListDefinition[] = Object.freeze([
  { key: "pro-world", name: "World Ranking", scope: "PROFESSIONAL", categories: ["PRO_CIRCUIT", "EUROPEAN_SERIES", "PRO_MAJOR", "PRO_WORLD_CHAMPIONSHIP"],
    window: { kind: "ROLLING", weeks: 2 * WEEKS_PER_SEASON }, cutLines: [1, 8, 16, 24, 32, 64], milestoneThresholds: [100, 64, 32, 16, 8, 1] },
  { key: "pro-circuit", name: "Pro Circuit Order of Merit", scope: "PROFESSIONAL", categories: ["PRO_CIRCUIT"],
    window: { kind: "ROLLING", weeks: WEEKS_PER_SEASON }, cutLines: [16, 32, 64], milestoneThresholds: [] },
  { key: "european-series", name: "European Series Order of Merit", scope: "PROFESSIONAL", categories: ["EUROPEAN_SERIES"],
    window: { kind: "ROLLING", weeks: WEEKS_PER_SEASON }, cutLines: [16, 32], milestoneThresholds: [] },
  { key: "challenger", name: "Challenger Series Ranking", scope: "SECONDARY", categories: ["CHALLENGER"],
    window: { kind: "SEASON" }, cutLines: [2, 10], milestoneThresholds: [1] },
  { key: "vault", name: "Vault Series Ranking", scope: "SECONDARY", categories: ["VAULT"],
    window: { kind: "SEASON" }, cutLines: [8], milestoneThresholds: [1] },
  { key: "amateur", name: "Amateur Circuit Ranking", scope: "AMATEUR", categories: ["AMATEUR_LOCAL", "AMATEUR_COUNTY", "AMATEUR_REGIONAL", "AMATEUR_NATIONAL"],
    window: { kind: "ROLLING", weeks: WEEKS_PER_SEASON }, cutLines: [16, 32], milestoneThresholds: [1] },
]);
export const RANKING_LISTS_V2: readonly RankingListDefinition[] = Object.freeze([
  ...RANKING_LISTS_V1,
  {key:"open-world",name:"Open World Ranking",scope:"AMATEUR",categories:["AMATEUR_NATIONAL"],window:{kind:"ROLLING",weeks:52},cutLines:[16,32],milestoneThresholds:[1]},
  {key:"women",name:"Women's Order of Merit",scope:"AMATEUR",categories:["WOMENS"],window:{kind:"ROLLING",weeks:52},cutLines:[8,16,32],milestoneThresholds:[1]},
  {key:"youth",name:"Youth Order of Merit",scope:"AMATEUR",categories:["YOUTH"],window:{kind:"SEASON"},cutLines:[8,16],milestoneThresholds:[1]},
]);
export function rankingListsFor(version: number): readonly RankingListDefinition[] {
  if(version===2)return RANKING_LISTS_V2;
  if (version !== RANKING_RULES_VERSION) throw new Error(`Unsupported Career ranking rules version ${version}; migration required`);
  return RANKING_LISTS_V1;
}
export const rankingList = (key: string, version = RANKING_RULES_VERSION) => rankingListsFor(version).find(l => l.key === key) ?? null;

/**
 * First publication index at which a contribution completed at `completion`
 * no longer counts. ROLLING: exactly `weeks` publications later (the same event
 * two seasons on replaces it). SEASON: the first publication of the next season.
 */
export function expiresIndex(window: RankingWindow, completion: number): number {
  return window.kind === "ROLLING" ? completion + window.weeks : seasonOfIndex(completion) * WEEKS_PER_SEASON + 1;
}

/**
 * Ranking order (documented tie-break hierarchy, identical for human and NPCs):
 *  1. ranking value (pence) descending
 *  2. largest single counting contribution descending
 *  3. most recent counting contribution (publication index) descending
 *  4. fewer counting contributions (higher average) — i.e. count ascending
 *  5. neutral deterministic key: stableUuid(seed, rulesVersion, "ranking-tiebreak", list, participant) ascending
 * No random draw, no human preference, no ability input.
 */
export const RANKING_TIE_BREAKS = ["VALUE_DESC", "BEST_SINGLE_DESC", "LATEST_DESC", "COUNT_ASC", "NEUTRAL_KEY_ASC"] as const;

// ------------------------------------------------------------------ Tour Cards
export const TOUR_CARD_RULES_V1 = Object.freeze({
  /** Default term: the award season (or the following season for end-of-season awards) plus one more. */
  termSeasons: 2,
  /** Cards ending this season are renewed for holders inside this cut of the season-end ranking. */
  retention: { list: "pro-world", maxPosition: 64 },
  /** Season-end Challenger ranking cards (next eligible non-holder if a top finisher already holds a card). */
  challengerCards: { list: "challenger", count: 2 },
  /**
   * Founding members: the NPC professionals that exist when the Career world is
   * generated already hold cards mid-term. Their term end is staggered (season 1
   * or 2) by a neutral hash, so card turnover begins naturally after season 1.
   */
  founding: { endSeasons: [1, 2] as const },
  /** Final Stage exemptions for the next season's Q-School (A3 provider entitlements). */
  qSchoolExemptions: { cardLosers: true, challengerPositions: [3, 10] as [number, number] },
});

// ------------------------------------------------------------------ Q-School
export const Q_SCHOOL_RULES_V1 = Object.freeze({
  /** Final Stage points by finishing position band (1 champion, 2 runner-up, 3 semi, 5 quarter, 9 L16, 17 L32). */
  points: [{ upToPosition: 1, points: 6 }, { upToPosition: 2, points: 5 }, { upToPosition: 4, points: 4 }, { upToPosition: 8, points: 3 },
    { upToPosition: 16, points: 2 }, { upToPosition: 32, points: 1 }] as const,
  /** Each Final Stage day winner earns a card directly; an unused direct card (repeat winner / cancelled day) rolls into the Order of Merit. */
  pathways: { UK_IRELAND: { orderOfMeritCards: 10 }, EUROPE: { orderOfMeritCards: 6 } } satisfies Record<QSchoolPathway, { orderOfMeritCards: number }>,
  minimumPointsForCard: 1,
  /**
   * Order of Merit tie-break hierarchy (identical for everyone):
   *  1. total points desc  2. best single-day finish (lowest position) asc
   *  3. scoring days desc  4. points on the latest Final Stage day desc
   *  5. Final Stage leg difference desc  6. Final Stage legs won desc
   *  7. neutral key stableUuid(seed, qSchoolRulesVersion, "q-school-tiebreak", season, pathway, participant) asc
   */
  tieBreaks: ["POINTS_DESC", "BEST_DAY_FINISH_ASC", "SCORING_DAYS_DESC", "LATEST_DAY_POINTS_DESC", "LEG_DIFFERENCE_DESC", "LEGS_WON_DESC", "NEUTRAL_KEY_ASC"] as const,
});
export const qSchoolPoints = (position: number) => Q_SCHOOL_RULES_V1.points.find(b => position <= b.upToPosition)?.points ?? 0;

/** Route selection for provider-issued Final Stage exemptions; REST_OF_WORLD defaults to the UK & Ireland pathway. */
export const PATHWAY_FOR_ZONE: Record<string, QSchoolPathway> = { UK_IRELAND: "UK_IRELAND", EUROPE: "EUROPE", REST_OF_WORLD: "UK_IRELAND" };

// ------------------------------------------------------------------ qualification milestones
/** A3 circuits/classifications whose confirmed entry is a "first qualified" fact. */
export const QUALIFICATION_MILESTONES = [
  { kind: "FIRST_PROFESSIONAL_EVENT", circuits: ["PRO_CIRCUIT", "EUROPEAN_SERIES", "MAJOR", "WORLD_CHAMPIONSHIP"], classification: "RANKING", definitionKey: null },
  { kind: "FIRST_MAJOR", circuits: ["MAJOR"], classification: "RANKING", definitionKey: null },
  { kind: "FIRST_WORLD_CHAMPIONSHIP", circuits: ["WORLD_CHAMPIONSHIP"], classification: "RANKING", definitionKey: "world-darts-championship" },
] as const;
