/**
 * Career DTOs as returned by the A1–A5 API (artifacts/api-server/src/career/**).
 * These mirror the server's explicit projections; only fields A6 renders are typed.
 * The server is authoritative — the UI never derives sporting or financial facts itself.
 */
export type CareerStatus = "ACTIVE" | "RETIRED";

// ---------------------------------------------------------------- A1 saves
export type CareerSave = {
  id: string; slotNumber: number; careerName: string | null; status: CareerStatus; difficulty: string;
  currentSeason: number; currentWeek: number; createdAt: string; updatedAt: string; retiredAt: string | null;
  balancePence: number; currency: "GBP"; standing: string; professionalRanking: number | null;
  professionalRankingMoneyPence: number; sponsor: string | null; hasTourCard: boolean;
};
export type CareerSaveList = { slots: { slotNumber: number; career: CareerSave | null }[]; archived: CareerSave[] };

// ---------------------------------------------------------------- A3 calendar / events
export type DenialReason = string;
export type HumanView = {
  relationship: "AVAILABLE" | "QUALIFIED" | "ENTERED" | "CONFIRMED" | "PLAYING" | "COMPLETED" | "WITHDRAWN" | "MISSED" | "NOT_ELIGIBLE";
  eligible: boolean; eligibilityReasons: DenialReason[]; canEnter: boolean; denials: DenialReason[]; conflictsWith: string[];
  entryStatus: string | null; result: { finishingPosition: number; stageReached: string; champion: boolean } | null;
};
export type EventFinancePreview = {
  affordable: boolean; currency: "GBP"; travelBand: string; nights: number; entryFeePence: number; entryFeeBasis: string;
  estimatedTravelPence: number; estimatedAccommodationPence: number;
  sponsorCoverage: { entryFeePence: number; travelPence: number; accommodationPence: number };
  estimatedPlayerCostPence: number; balancePence: number; availablePence: number;
  prizeProfile: string; topPrizePence: number; rankingEligible: boolean;
  commitment: { status: string; entryFeePaidPence: number; entryFeeCoveredPence: number; tripId: string | null } | null;
};
export type EventFormat = { gameType: string; startingScore?: number; matchContext: string; structure: string; stages: { key: string; kind: string; bestOfByRound?: number[] }[];
  days: number; sideSize: number; inRule?: string; outRule?: string; scoringUnit?: "LEGS" | "SETS"; legsPerSet?: number | null; setPlay?: unknown };
export type CareerEvent = {
  id: string; instanceKey: string; season: number; name: string; definitionKey: string; family: string; circuit: string; classification: string;
  rankingCategory: string | null; presentation: { tier: PresentationTier; featured: boolean; calendarPriority: number; brandingFamily?: string };
  dates: { startWeek: number; endWeek: number; startDay: number; endDay: number; startDayOfWeek: number; grouping: string };
  registration: { opensWeek: number; closesWeek: number };
  venue: { key: string; name: string; city: string; country: string; region: string; zone: string; localityKey: string | null };
  format: EventFormat; capability: { executable: boolean; code?: string; reasons?: string[] };
  field: { size: number; minimum: number; entrants: number; policy: string };
  series: { key: string; day: number } | null; qSchool: { pathway: string; stage: "FIRST" | "FINAL"; day: number } | null;
  seedingPolicy: { list: string | null; seeds: number };
  status: EventStatus; statusReason: string | null;
  champion: { participantKey: string; npcId: string | null } | null;
  human: HumanView | null; finance: EventFinancePreview | null;
};
export type EventStatus = "SCHEDULED" | "REGISTRATION_OPEN" | "REGISTRATION_CLOSED" | "DRAW_PENDING" | "DRAWN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type PresentationTier = "LOCAL" | "STANDARD" | "FEATURED" | "TELEVISED" | "MAJOR" | "WORLD";
export type CalendarOverview = {
  season: number; week: number; grouping: { key: string; name: string; fromWeek: number; toWeek: number };
  groupings: { key: string; name: string; fromWeek: number; toWeek: number }[]; status: string; playedWeek: number; instanceCount: number;
  pendingHumanMatches: { matchId: string; eventId: string }[];
  currentWeekActions: { type: string; eventId: string; name: string }[];
  nextMeaningful: { season: number; week: number; reasons: { type: string; eventId?: string; name?: string }[] };
};
export type CalendarResponse = { overview: CalendarOverview; season: number; scope: string; events: CareerEvent[] };
export type CareerMatch = {
  id: string; stage: string; round: number; roundName: string | null; slot: number; bestOf: number; scheduledDay: number;
  a: { key: string; name: string | null } | null; b: { key: string; name: string | null } | null;
  status: "PENDING" | "AWAITING_HUMAN" | "COMPLETED" | "BYE" | "WALKOVER"; winnerKey: string | null; legs: [number, number] | null;
  firstThrow: number | null; firstThrowMethod: string; resultSource: string | null; summary: unknown;
};
export type EventDetail = {
  event: CareerEvent;
  field: { participantKey: string; kind: string; name: string; nationality: string | null; tier: string | null; source: string; status: string; seed: number | null }[];
  draw: { rounds: number; matches: CareerMatch[] };
  progress: { totalMatches: number; completedMatches: number; currentRound: number };
  human: { nextMatch: CareerMatch | null; result: unknown };
  results: { participantKey: string; name: string | null; position: number; stageReached: string; champion: boolean; wins: number; losses: number; legsFor: number; legsAgainst: number }[];
};
export type HistoryRow = { eventId: string; season: number; name: string; definitionKey: string; circuit: string; classification: string; presentationTier: PresentationTier;
  week: number; country: string; participantKey: string; position: number; stageReached: string; champion: boolean; wins: number; losses: number };
export type AdvanceResult = { operationKey: string; from: { season: number; week: number }; to: { season: number; week: number };
  stop: { reason: "LIMIT" | "TARGET_REACHED" | "MEANINGFUL_DATE" | "SEASON_BOUNDARY" | "HUMAN_MATCH_PENDING"; detail?: unknown }; weeksPlayed: number };

// ---------------------------------------------------------------- A4 finance
export type FinanceSummary = {
  currency: "GBP"; balancePence: number; startingBalancePence: number; careerEarningsPence: number; sponsorEarningsPence: number; careerExpensesPence: number;
  sponsorCoveredExpensesPence: number; ledgerEntries: number; reconciled: boolean; reservedForTravelPence: number; availablePence: number;
  sponsor: { contractId: string; sponsorKey: string; displayName: string; tier: string; endSeason: number; endWeek: number } | null; availableOffers: number;
};
export type LedgerEntry = { id: string; category: string; headline: string; amountPence: number; direction: "CREDIT" | "DEBIT"; season: number | null; week: number | null;
  eventId: string | null; grossAmountPence: number | null; sponsorCoveredPence: number; reason: string | null; createdAt: string };
export type SponsorTerms = {
  sponsorKey: string; displayName: string; tier: string; duration: { kind: "REMAINDER_OF_SEASON" } | { kind: "SEASONS"; seasons: number };
  signingBonusPence: number; eventPayment: { amountPence: number; circuits: string[]; maxEventsPerSeason: number } | null;
  coverage: { costTypes: string[]; percent: number; perEventCapPence: number | null; seasonCapPence: number | null; circuits: string[] | null }[];
  performanceBonuses: { key: string; maxPosition: number; amountPence: number; circuits: string[] | null; classifications: string[] }[];
  renewalRequirement: unknown; retentionRequirement: unknown; presentation: { colour: string };
};
export type SponsorContract = { id: string; sponsorKey: string; tier: string; terms: SponsorTerms; status: string; endReason: string | null;
  start: { season: number; week: number }; end: { season: number; week: number }; totals: { paidPence: number; coveredPence: number } };
export type SponsorOffer = { id: string; sponsorKey: string; tier: string; kind: "NEW" | "RENEWAL"; terms: SponsorTerms; status: string; statusReason: string | null;
  offered: { season: number; week: number }; expires: { season: number; week: number } };
export type SponsorsResponse = { active: SponsorContract | null; offers: SponsorOffer[]; history: { contracts: SponsorContract[]; offers: SponsorOffer[] } };

// ---------------------------------------------------------------- A5 sporting
export type CutGap = { cutPosition: number; valueAtCutPence: number | null; inside: boolean; placesOutside: number | null; gapPence: number | null };
export type RankingRow = { position: number; participantKey: string; kind: string; name: string | null; nationality: string | null; valuePence: number;
  previousPosition: number | null; movement: number | null; isNew: boolean; gapAbovePence: number | null; gapBelowPence: number | null; careerHighPosition: number; countedContributions: number };
export type Standing = { list: string; published: { season: number; week: number; sequence: number; participantCount: number; rulesVersion: number } | null; ranked: boolean;
  standing: RankingRow | null; careerHighPosition: number | null; seasonHighPosition: number | null; cutLines: CutGap[] };
export type TourCard = { id: string; source: string; sourceDetail: Record<string, unknown>; awarded: { season: number; week: number }; term: { startSeason: number; endSeason: number };
  status: string; endReason: string | null; ended: { season: number; week: number } | null };
export type TourCardView = { participantKey: string; holdsCard: boolean; current: (TourCard & { reviewSeason: number; retention: { list: string; maxPosition: number } }) | null; history: TourCard[] };
export type Milestone = { id?: string; kind: string; list_key: string | null; season: number; week: number; detail: Record<string, unknown> };
export type SportingSummary = {
  season: number; week: number; professionalStatus: "AMATEUR" | "PROFESSIONAL"; tourCard: { holdsCard: boolean; current: TourCardView["current"] };
  worldRanking: Standing; rankings: { key: string; name: string; scope: string; published: Standing["published"]; position: number | null; valuePence: number; movement: number | null; isNew: boolean; careerHighPosition: number | null }[];
  recentMilestones: Milestone[];
};
export type RankingListMeta = { key: string; name: string; scope: string; categories: string[]; window: { kind: string; weeks?: number }; cutLines: number[];
  published: { season: number; week: number; sequence: number; participantCount: number; reason: string } | null; human: Standing };
export type RankingTable = { list: string; name: string; view?: string; published: { season: number; week: number; sequence: number; participantCount: number; rulesVersion: number } | null;
  cutLines?: Record<string, number | null>; participant: { key: string; position: number | null } | null; rows: RankingRow[] };
export type RankingHistory = { list: string; participantKey: string; careerHigh: { position: number; publicationIndex: number } | null;
  seasonHighs: { season: number; best: number; worst: number; snapshots: number }[]; snapshots: (RankingRow & { season: number; week: number; sequence: number })[] };
export type RankingContribution = { eventId: string; eventName: string; definitionKey: string; circuit: string; season: number; week: number; finishingPosition: number; amountPence: number; source: string };
export type RankingExplain = { list: string; window: { kind: string; weeks?: number }; position: number | null; valuePence: number; contributionTotalPence: number; explained: boolean;
  counting: RankingContribution[]; expired: RankingContribution[]; pending: RankingContribution[] };
export type OomEntry = { participantKey: string; position: number; points: number; bestDayFinish: number; scoringDays: number; name: string | null; dayWinner: boolean };
export type QSchoolPathwayView = {
  pathway: "UK_IRELAND" | "EUROPE";
  finalStage: { days: number; completed: number; dayWinners: { day: number; status: string; winner: string | null }[] };
  participant: { firstStage: { day: number; position: number }[]; finalStageEntry: { route: string; detail: unknown } | null; wonDay: number[];
    orderOfMerit: { position: number; contenderPosition: number | null; points: number; insideCardLine: boolean } | null };
  cardLine: { orderOfMeritCards: number; valueAtLinePoints: number | null };
  standings: OomEntry[];
  allocation: { allocatedWeek: number; directCards: number; unusedDirectCards: number; orderOfMeritCards: number;
    awards: { participantKey: string; name: string | null; route: "DIRECT" | "ORDER_OF_MERIT"; day: number | null; orderOfMeritPosition: number | null; points: number; cardId: string }[] } | null;
};
export type QSchoolView = { season: number; participantKey: string; tieBreaks: string[]; pathways: QSchoolPathwayView[] };
export type RouteFact = { type: string; met: boolean; reasons?: string[]; parts?: RouteFact[]; inner?: RouteFact; list?: string; maxPosition?: number; position?: number | null;
  placesOutside?: number | null; gapToCutPence?: number | null; tourCard?: boolean | null; targetKey?: string; held?: boolean; qualifierRoutes?: string[]; required?: string };
export type QualificationEvent = { eventId: string; name: string; definitionKey: string; circuit: string; classification: string; startWeek: number; status: string;
  eligible: boolean; reasons: string[]; routes: RouteFact; seedingList: string | null; seeds: number };
export type QualificationResponse = { season: number; tourCard: boolean | null; professionalStatus: string; rankings: Record<string, number>; events: QualificationEvent[] };
