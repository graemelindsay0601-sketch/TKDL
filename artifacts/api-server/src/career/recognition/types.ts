import type { EventFact, Fact } from "../facts/types.ts";

export const CONTEXTS = {
  LOCAL: "Local",
  AMATEUR: "Amateur",
  PROFESSIONAL: "Professional",
  MAJOR_STAGE: "Major / Stage",
  INTERNATIONAL: "International",
} as const;
export type RecognitionContext = keyof typeof CONTEXTS;
export const LEVELS = ["UNKNOWN", "KNOWN", "ESTABLISHED", "HIGHLY_REGARDED", "ELITE"] as const;
export type RecognitionLevel = typeof LEVELS[number];
export const LEVEL_LABELS: Record<RecognitionLevel, string> = {
  UNKNOWN: "Unknown", KNOWN: "Known", ESTABLISHED: "Established", HIGHLY_REGARDED: "Highly regarded", ELITE: "Elite",
};
export type RecognitionEvent = { fact: Fact; circuit: string; classification: string; tier: string; international: boolean };
export type RecognitionResult = RecognitionEvent & { champion: boolean; stageReached: string };
export type RecognitionQualification = RecognitionEvent & { targetKey: string };
/** Public sporting facts only. Age, focus, goals, finances and hidden A2 attributes are not inputs. */
export type RecognitionSources = {
  results: RecognitionResult[];
  appearances: RecognitionEvent[];
  qualifications: RecognitionQualification[];
  cards: Fact[];
  rankings: (Fact & { position: number })[];
};
export type RecognitionMilestone = Fact & {
  context: RecognitionContext; level: RecognitionLevel; precision: "DAY" | "WEEK"; supportingFactIds: string[];
};
export type RecognitionView = {
  careerSaveId: string;
  subject: { kind: "HUMAN" | "NPC"; id: string; name: string; retired: boolean };
  standing: { label: string; description: string };
  contexts: { context: RecognitionContext; label: string; level: RecognitionLevel; levelLabel: string; evidence: Fact[] }[];
  strongest: RecognitionContext[];
  milestones: RecognitionMilestone[];
  historyNote: string;
  relationships: { opponentId: string; name: string; labels: string[]; description: string }[];
};
/** A7.1 event evidence adapter, not a second results/statistics engine. */
export const recognitionResult = (r: EventFact, international = false): RecognitionResult => ({
  fact: { id:r.id, source:r.source, label:`${r.name} — ${r.champion ? "title" : r.stageReached.toLowerCase().replaceAll("_", " ")}`,
    season:r.season, day:r.day, week:r.week, date:r.date, age:r.age, eventId:r.eventId },
  circuit:r.circuit, classification:r.classification, tier:r.presentationTier, international,
  champion:r.champion, stageReached:r.stageReached,
});
