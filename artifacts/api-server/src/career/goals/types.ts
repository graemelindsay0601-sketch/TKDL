import type { Fact, CareerFacts } from "../facts/types.ts";
import type { CareerRelationships } from "../relationships/types.ts";

export const FOCUSES = {
  OPEN_SCHEDULE: { label: "Open Schedule", description: "Normal calendar, without a strategic preference. Every pathway remains yours to choose." },
  PROFESSIONAL_PATHWAY: { label: "Professional Pathway", description: "Q-School and published ranking/pro opportunities. Turning professional is optional." },
  AMATEUR_CIRCUIT: { label: "Amateur Circuit", description: "Local, county, open and secondary competition. Q-School remains available where eligible." },
  PRIZE_MONEY: { label: "Prize-Money Focus", description: "Published first prizes and estimated Career costs. No guaranteed profit or financial bonus." },
  MAJOR_QUALIFICATION: { label: "Major Qualification", description: "Major/world events and their authored qualification routes. No invitation or eligibility shortcuts." },
} as const;
export type Focus = keyof typeof FOCUSES;
export type GoalDefinition =
  | { type: "WIN_TITLE" | "REACH_FINAL" | "WIN_MAJOR" | "WIN_WORLD" | "WIN_AMATEUR_TITLE" | "EARN_TOUR_CARD" }
  | { type: "WIN_EVENT"; eventId: string }
  | { type: "REACH_WORLD_RANK" | "EARNINGS" | "MAXIMUMS"; target: number }
  | { type: "BEAT_OPPONENT" | "IMPROVE_H2H"; opponentId: string }
  | { type: "BEAT_RELATIONSHIP"; opponentId: string; relationship: "Career Rival" | "Nemesis" };
export type GoalRow = { id: string; career_save_id: string; request_key: string; definition: GoalDefinition; target_key: string; baseline_evidence: string[];
  status: "ACTIVE" | "COMPLETED" | "ABANDONED"; created_season: number; created_week: number; completed_evidence: Fact | null };
export type Opportunity = {
  id: string; name: string; season: number; startDay: number; circuit: string; classification: string; tier: string; status: string;
  canEnter: boolean; eligible: boolean; denials: string[]; relationship: string; majorRoute: boolean;
  firstPrizePence: number | null; estimatedCostPence: number | null; registration: { opensWeek: number; closesWeek: number };
};
export type GoalSources = { facts: CareerFacts; relationships: CareerRelationships; eventNames?: Record<string,string>; currentWeek:number; currentRank: number | null; holdsCard: boolean;
  earningsPence: number; earningsEvidence: { id: string; amountPence: number; fact: Fact }[] };
export type GoalView = { id: string; definition: GoalDefinition; label: string; status: GoalRow["status"]; created: { season: number; week: number };
  progress: { current: number | null; target: number; unit: string; note: string | null }; completion: Fact | null };
export type GoalsView = { careerSaveId: string; focus: Focus; focusOptions: { value: Focus; label: string; description: string }[];
  activeLimit: number; retired: boolean; goals: GoalView[]; options: { definition: GoalDefinition; label: string }[];
  opportunities: (Opportunity & { reason: string })[]; context: { currentRank: number | null; holdsCard: boolean; earningsPence: number } };
