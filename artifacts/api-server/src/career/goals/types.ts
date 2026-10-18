import type { Fact, CareerFacts } from "../facts/types.ts";
import type { CareerRelationships } from "../relationships/types.ts";

export const FOCUSES = {
  OPEN_SCHEDULE: { label: "Anything goes", description: "No preference: suggestions from the whole calendar, nearest and soonest first." },
  PROFESSIONAL_PATHWAY: { label: "Going pro", description: "Q-School, the Challenger Tour and ranking events. Turning professional is still up to you." },
  AMATEUR_CIRCUIT: { label: "Amateur darts", description: "Local, county and open events, and the Vault. You can still try Q-School whenever you like." },
  PRIZE_MONEY: { label: "Prize money", description: "The best first prizes for what they cost. Winning isn't guaranteed." },
  MAJOR_QUALIFICATION: { label: "Big events", description: "The majors and the World Championship, and the qualifiers that lead to them." },
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
  progress: { current: number | null; target: number; unit: string; note: string | null }; completion: Fact | null; evidence: Fact | null };
export type GoalsView = { careerSaveId: string; focus: Focus; focusOptions: { value: Focus; label: string; description: string }[];
  activeLimit: number; retired: boolean; mainGoalId: string | null; nearTermEventId: string | null; goals: GoalView[]; options: { definition: GoalDefinition; label: string }[];
  opportunities: (Opportunity & { reason: string })[]; context: { currentRank: number | null; holdsCard: boolean; earningsPence: number } };
