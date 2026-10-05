import type { Dart, X01Format } from "../../shared/darts-rules/x01.ts";

export type Fact = { id: string; source: string; label: string; season: number; day: number | null; week: number | null; date: string | null; age: number | null; eventId?: string };
export type EventFact = Fact & { eventId: string; name: string; definitionKey: string; circuit: string; classification: string; presentationTier: string; country: string; participantKey: string; participantName: string; position: number; stageReached: string; champion: boolean; wins: number; losses: number };
export type MatchEvidence = { id: string; eventId: string; name: string; season: number; day: number; round: number; slot: number; won: boolean };
export type DartEvidence = { matchId: string; eventId: string; format: X01Format; firstThrower: 0 | 1; darts: Dart[] };
export type Performance = { recordedMatches: number; unavailableMatches: number; darts: number | null; threeDartAverage: number | null; highestCheckout: number | null; checkoutsCompleted: number | null; checkoutAttempts: null; checkoutPercentage: null; maximums: number | null; visits140Plus: number | null; visits100Plus: number | null; highestVisit: number | null; bestMatchAverage: { matchId: string; value: number } | null; most180sMatch: { matchId: string; value: number } | null };
export type CareerFacts = {
  careerSaveId: string;
  statistics: { matchesPlayed: number; wins: number; losses: number; winPercentage: number | null; eventsEntered: number; titles: number; runnersUp: number; semiFinals: number; quarterFinals: number; bestFinish: EventFact | null; currentWinningStreak: number | null; longestWinningStreak: number | null; currentSeason: number; seasonsPlayed: number };
  performance: Performance;
  records: { firstMatch: Fact | null; firstWin: Fact | null; firstFinal: EventFact | null; firstTitle: EventFact | null; latestTitle: EventFact | null; bestWorldRanking: (Fact & { position: number }) | null; highestTierTitles: EventFact[]; firstTourCard: Fact | null; regainedTourCards: Fact[] };
  results: EventFact[]; timeline: Fact[];
  world: { champions: EventFact[]; rankingLeaders: (Fact & { participantKey: string; participantName: string })[] };
};
