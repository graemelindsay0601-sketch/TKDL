/**
 * TEST-ONLY Career fixtures (A6). Shapes mirror real A1–A5 responses captured from the
 * Career API; values are illustrative and never used by production screens.
 */
import type {
  CalendarOverview, CareerEvent, CareerSave, EventDetail, FinanceSummary, HumanView, QSchoolPathwayView, RankingListMeta, RankingRow, SportingSummary,
} from "../../features/career/types.ts";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> | T[K] : T[K] };
const merge = <T,>(base: T, over: DeepPartial<T> = {}): T => {
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(over)) {
    const b = (base as Record<string, unknown>)[k];
    out[k] = v && typeof v === "object" && !Array.isArray(v) && b && typeof b === "object" && !Array.isArray(b) ? merge(b, v as never) : v;
  }
  return out as T;
};

export const SAVE_ID = "11111111-1111-4111-8111-111111111111";

export function save(over: DeepPartial<CareerSave> = {}): CareerSave {
  return merge<CareerSave>({
    id: SAVE_ID, slotNumber: 1, careerName: "Fixture Career", status: "ACTIVE", difficulty: "STANDARD", currentSeason: 1, currentWeek: 1,
    createdAt: "2026-10-04 05:39:07.543+00", updatedAt: "2026-10-04 05:39:29.192+00", retiredAt: null, balancePence: 25000, currency: "GBP",
    standing: "Unknown Amateur", professionalRanking: null, professionalRankingMoneyPence: 0, sponsor: null, hasTourCard: false,
  }, over);
}

export function overview(over: DeepPartial<CalendarOverview> = {}): CalendarOverview {
  const groupings = [{ key: "OPENING_SWING", name: "Opening Swing", fromWeek: 1, toWeek: 8 }, { key: "SPRING_CIRCUIT", name: "Spring Circuit", fromWeek: 9, toWeek: 16 },
    { key: "SUMMER_TOUR", name: "Summer Tour", fromWeek: 17, toWeek: 32 }, { key: "MAJOR_SEASON", name: "Major Season", fromWeek: 33, toWeek: 44 },
    { key: "WORLD_CHAMPIONSHIP_PERIOD", name: "World Championship Period", fromWeek: 45, toWeek: 52 }];
  return merge<CalendarOverview>({ season: 1, week: 1, grouping: groupings[0], groupings, status: "ACTIVE", playedWeek: 0, instanceCount: 413,
    pendingHumanMatches: [], currentWeekActions: [], nextMeaningful: { season: 1, week: 2, reasons: [] } }, over);
}

export function human(over: DeepPartial<HumanView> = {}): HumanView {
  return merge<HumanView>({ relationship: "AVAILABLE", eligible: true, eligibilityReasons: [], canEnter: true, denials: [], conflictsWith: [], entryStatus: null, result: null }, over);
}

let seq = 0;
export function event(over: DeepPartial<CareerEvent> = {}): CareerEvent {
  seq++;
  return merge<CareerEvent>({
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`, instanceKey: `fixture-${seq}:s1`, season: 1, name: `Fixture Open ${seq}`, definitionKey: "fixture-open",
    family: "LOCAL", circuit: "GRASSROOTS", classification: "RANKING", rankingCategory: "AMATEUR_LOCAL",
    presentation: { tier: "LOCAL", featured: false, calendarPriority: 10 },
    dates: { startWeek: 2, endWeek: 2, startDay: 12, endDay: 12, startDayOfWeek: 5, grouping: "OPENING_SWING" },
    registration: { opensWeek: 1, closesWeek: 2 },
    venue: { key: "v", name: "Social Club", city: "Newcastle", country: "GBR", region: "NE", zone: "UK_IRELAND", localityKey: null },
    format: { gameType: "X01", startingScore: 501, matchContext: "floor", structure: "KNOCKOUT", stages: [{ key: "main", kind: "KNOCKOUT", bestOfByRound: [5, 7] }], days: 1, sideSize: 1, scoringUnit: "LEGS" },
    capability: { executable: true }, field: { size: 32, minimum: 8, entrants: 0, policy: "OPEN" }, series: null, qSchool: null, seedingPolicy: { list: null, seeds: 0 },
    status: "REGISTRATION_OPEN", statusReason: null, champion: null, human: human(),
    finance: { affordable: true, currency: "GBP", travelBand: "DOMESTIC", nights: 0, entryFeePence: 500, entryFeeBasis: "PER_EVENT", estimatedTravelPence: 6000,
      estimatedAccommodationPence: 0, sponsorCoverage: { entryFeePence: 0, travelPence: 0, accommodationPence: 0 }, estimatedPlayerCostPence: 6500,
      balancePence: 25000, availablePence: 25000, prizeProfile: "prize:local", topPrizePence: 2500, rankingEligible: true, commitment: null },
  }, over);
}

const cut = (cutPosition: number, inside: boolean, gapPence: number | null) => ({ cutPosition, valueAtCutPence: 100000 * (70 - cutPosition), inside, placesOutside: inside ? 0 : 10, gapPence });
export function row(position: number, over: Partial<RankingRow> = {}): RankingRow {
  return { position, participantKey: `npc-${position}`, kind: "NPC", name: `Player ${position}`, nationality: "GBR", valuePence: 2_000_000 - position * 10_000,
    previousPosition: position, movement: 0, isNew: false, gapAbovePence: 0, gapBelowPence: 0, careerHighPosition: position, countedContributions: 3, ...over };
}

export function sporting(kind: "UNRANKED_AMATEUR" | "RANKED_PRO", over: DeepPartial<SportingSummary> = {}): SportingSummary {
  const pro = kind === "RANKED_PRO";
  const me = pro ? row(42, { participantKey: "HUMAN", kind: "HUMAN", name: null, nationality: null, valuePence: 1_200_000, previousPosition: 39, movement: -3, careerHighPosition: 20 }) : null;
  return merge<SportingSummary>({
    season: 1, week: pro ? 12 : 1, professionalStatus: pro ? "PROFESSIONAL" : "AMATEUR",
    tourCard: pro ? { holdsCard: true, current: { id: "card-1", source: "Q_SCHOOL_DIRECT", sourceDetail: {}, awarded: { season: 1, week: 3 }, term: { startSeason: 1, endSeason: 2 },
      status: "ACTIVE", endReason: null, ended: null, reviewSeason: 2, retention: { list: "pro-world", maxPosition: 64 } } } : { holdsCard: false, current: null },
    worldRanking: { list: "pro-world", published: pro ? { season: 1, week: 11, sequence: 6, participantCount: 134, rulesVersion: 1 } : null, ranked: pro, standing: me,
      careerHighPosition: pro ? 20 : null, seasonHighPosition: pro ? 20 : null, cutLines: pro ? [cut(1, false, 13_350_000), cut(32, false, 300_000), cut(64, true, 0)] : [] },
    rankings: [{ key: "pro-world", name: "World Ranking", scope: "PROFESSIONAL", published: null, position: pro ? 42 : null, valuePence: pro ? 1_200_000 : 0, movement: pro ? -3 : null, isNew: false, careerHighPosition: pro ? 20 : null }],
    recentMilestones: pro ? [{ id: "m1", kind: "FIRST_RANKING_ENTRY", list_key: "pro-world", season: 1, week: 5, detail: { position: 25 } }] : [],
  }, over);
}

export function finance(over: DeepPartial<FinanceSummary> = {}): FinanceSummary {
  return merge<FinanceSummary>({ currency: "GBP", balancePence: 25000, startingBalancePence: 25000, careerEarningsPence: 0, sponsorEarningsPence: 0, careerExpensesPence: 0,
    sponsorCoveredExpensesPence: 0, ledgerEntries: 1, reconciled: true, reservedForTravelPence: 0, availablePence: 25000, sponsor: null, availableOffers: 0 }, over);
}

export function rankingMeta(over: DeepPartial<RankingListMeta> = {}): RankingListMeta {
  const s = sporting("RANKED_PRO").worldRanking;
  return merge<RankingListMeta>({ key: "pro-world", name: "World Ranking", scope: "PROFESSIONAL", categories: ["PRO_CIRCUIT"], window: { kind: "ROLLING", weeks: 104 },
    cutLines: [1, 8, 16, 24, 32, 64], published: { season: 1, week: 11, sequence: 6, participantCount: 134, reason: "RESULTS" }, human: s }, over);
}

export function pathway(over: DeepPartial<QSchoolPathwayView> = {}): QSchoolPathwayView {
  return merge<QSchoolPathwayView>({ pathway: "UK_IRELAND", finalStage: { days: 4, completed: 0, dayWinners: [] },
    participant: { firstStage: [], finalStageEntry: null, wonDay: [], orderOfMerit: null }, cardLine: { orderOfMeritCards: 10, valueAtLinePoints: null }, standings: [], allocation: null }, over);
}

export function eventDetail(e: CareerEvent, over: Partial<EventDetail> = {}): EventDetail {
  return { event: e, field: [], draw: { rounds: 0, matches: [] }, progress: { totalMatches: 0, completedMatches: 0, currentRound: 0 }, human: { nextMatch: null, result: null }, results: [], ...over };
}
