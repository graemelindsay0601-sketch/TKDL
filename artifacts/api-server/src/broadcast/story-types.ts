// TKDL LIVE — Story Engine: the StoryType taxonomy (handover doc Appendix
// A, "Story Catalogue for v1") and the Treatment type stories are sorted
// into (section 9.3). Pure identity/taxonomy only — no scoring math (that's
// story-engine-math.ts) and no detection logic (that's the per-family
// story-detectors-*.ts files) — so this file changes only when the
// catalogue itself changes.
//
// Every story type below is transcribed directly from Appendix A's table,
// grouped by the same nine families the doc uses. RESULT/FORM/H2H/
// PERFORMANCE/MILESTONE are Singles-only by design, mirroring
// history-reconstruction.ts's own Singles-only functions (buildH2HBefore,
// buildPlayerBaselines, etc.): Doubles and Shift Wars get their own
// team-shaped equivalents instead of reusing these (PAIR_UPSET rather than
// UPSET, PAIR_ELIMINATED rather than ELIMINATION, and so on) — Appendix A's
// own DOUBLES/SHIFT_WARS families exist precisely because a team result
// isn't a player result. LEAGUE and ARCHIVE apply across all three
// leagues (every BroadcastStory carries its own leagueType regardless of
// family, per 9.1).

export const RESULT_STORY_TYPES = [
  "UPSET", "MAJOR_UPSET", "MODEL_SHOCK",
  "HIGH_STAKE_WIN", "HIGH_STAKE_LOSS",
  "ELIMINATION", "LEADER_BEATEN",
  "STREAK_BREAKER", "DROUGHT_ENDED",
  "FIRST_H2H_WIN", "REVENGE",
] as const;

export const FORM_STORY_TYPES = [
  "WIN_STREAK", "LOSS_STREAK", "FORM_REVERSAL",
  "QUIET_CLIMBER", "FREEFALL", "ABOVE_BASELINE",
] as const;

export const H2H_STORY_TYPES = [
  "H2H_DOMINANCE", "RIVALRY", "RIVALRY_SWING",
] as const;

export const PERFORMANCE_STORY_TYPES = [
  "CLINICAL_FINISHING", "DOUBLE_TROUBLE",
  "SCORING_POWER", "SCORING_WITHOUT_FINISHING",
  "SEASON_BEST", "PERSONAL_BEST",
] as const;

export const LEAGUE_STORY_TYPES = [
  "NEW_LEADER", "LEAD_TIGHTENS", "LEAD_WIDENS",
  "TITLE_SWING", "NEW_FAVOURITE", "DEAD_HEAT",
  "TITLE_RACE", "CHAMPION", "TIE_PENDING",
] as const;

export const MILESTONE_STORY_TYPES = [
  "CAREER_MATCH_MILESTONE", "CAREER_WIN_MILESTONE",
  "180_MILESTONE", "ELIMINATION_MILESTONE",
] as const;

export const DOUBLES_STORY_TYPES = [
  "UNBEATEN_PAIR", "PAIR_SURGE", "PAIR_UPSET", "PAIR_ELIMINATED",
] as const;

export const SHIFT_WARS_STORY_TYPES = [
  "SHIFT_LEAD_CHANGE", "SHIFT_MOMENTUM", "SHIFT_COMEBACK", "SHIFT_DOMINANCE",
] as const;

export const ARCHIVE_STORY_TYPES = [
  "LAST_MEETING", "SEASON_COMPARISON", "HISTORICAL_H2H",
] as const;

export const STORY_FAMILIES = [
  "RESULT", "FORM", "H2H", "PERFORMANCE", "LEAGUE",
  "MILESTONE", "DOUBLES", "SHIFT_WARS", "ARCHIVE",
] as const;
export type StoryFamily = (typeof STORY_FAMILIES)[number];

export const STORY_TYPES_BY_FAMILY = {
  RESULT: RESULT_STORY_TYPES,
  FORM: FORM_STORY_TYPES,
  H2H: H2H_STORY_TYPES,
  PERFORMANCE: PERFORMANCE_STORY_TYPES,
  LEAGUE: LEAGUE_STORY_TYPES,
  MILESTONE: MILESTONE_STORY_TYPES,
  DOUBLES: DOUBLES_STORY_TYPES,
  SHIFT_WARS: SHIFT_WARS_STORY_TYPES,
  ARCHIVE: ARCHIVE_STORY_TYPES,
} as const satisfies Record<StoryFamily, readonly string[]>;

export type StoryType =
  | (typeof RESULT_STORY_TYPES)[number]
  | (typeof FORM_STORY_TYPES)[number]
  | (typeof H2H_STORY_TYPES)[number]
  | (typeof PERFORMANCE_STORY_TYPES)[number]
  | (typeof LEAGUE_STORY_TYPES)[number]
  | (typeof MILESTONE_STORY_TYPES)[number]
  | (typeof DOUBLES_STORY_TYPES)[number]
  | (typeof SHIFT_WARS_STORY_TYPES)[number]
  | (typeof ARCHIVE_STORY_TYPES)[number];

const STORY_TYPE_TO_FAMILY = new Map<StoryType, StoryFamily>();
for (const family of STORY_FAMILIES) {
  for (const storyType of STORY_TYPES_BY_FAMILY[family]) {
    STORY_TYPE_TO_FAMILY.set(storyType, family);
  }
}

export function familyForStoryType(storyType: StoryType): StoryFamily {
  const family = STORY_TYPE_TO_FAMILY.get(storyType);
  if (!family) throw new Error(`familyForStoryType: unknown story type ${storyType}`);
  return family;
}

// ── 9.3: treatment ───────────────────────────────────────────────────────
// A pure classification of a story, not an identity — kept here (rather
// than story-engine-math.ts) because the doc's own file map (section 20.1)
// pairs "schemas and score/treatment types" together in story-types.ts;
// treatmentForScore() itself (the score -> Treatment function) stays in
// story-engine-math.ts alongside the rest of the scoring math, and imports
// this type with a same-package relative import.
export type Treatment = "major" | "featured" | "supporting" | "headline_ticker" | "archive";

// ── StoryCandidate ────────────────────────────────────────────────────────
// What one pure detector function returns for one detected situation —
// everything a BroadcastStory (9.1) needs EXCEPT the identity/lifecycle
// bookkeeping (storyKey, detectedAt/updatedAt, lifecycle, score, confidence)
// that only story-engine.ts can fill in, since that's exactly the part
// that depends on whether this same situation was already being tracked.
// Both type-only imports below are erased before module resolution (see
// story-engine-math.ts's own header for why that matters for this folder's
// directly-unit-tested files).
import type { LeagueType } from "@workspace/db/schema";
import type { PartialStoryScoreComponents } from "./story-engine-math";

export type StoryCandidate = {
  storyType: StoryType;
  leagueType: LeagueType;
  /** Player ids (Singles) or team ids (Doubles/Shift Wars), pre-encoded via story-engine-math.ts's subjectKey(). */
  subjectKeys: string[];
  /** Present for match-anchored stories (most of RESULT/PERFORMANCE/DOUBLES/SHIFT_WARS); absent for subject-anchored ongoing situations (most of FORM/LEAGUE). */
  anchorMatchId?: number;
  sentiment: "positive" | "neutral" | "negative";
  /** Verified, display-ready numbers backing this story's claim — the fact firewall (section 17.1) means nothing goes here that isn't traceable to a real query result. */
  facts: Record<string, unknown>;
  tags: string[];
  components: PartialStoryScoreComponents;
};
