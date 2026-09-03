// TKDL LIVE — Live layer: pure math (handover doc sections 11.4-11.6,
// Appendix C.2). Zero `@workspace/db` runtime imports (only `import type`,
// erased before module resolution — same reasoning as every other *-math.ts
// file in this folder), so this file stays directly unit testable. live-
// events.ts (DB-facing) resolves real current standings/match data, then
// calls into this file to classify and to evaluate/attach validity rules.
//
// ── 11.6's validity rules: what's actually checkable, cheaply, on every
// 30-second poll ────────────────────────────────────────────────────────
// 11.6 names five illustrative rule kinds ("such as leaderIs, entityActive,
// winStreakAtLeast, storyStillActive or titleProbabilityBand"). This file
// implements exactly those five, generated per-story from facts a story
// already carries — not invented per story TYPE, but derived generically
// from whichever of a story's own fact keys match a known shape (see
// validityRulesForStory below). Two design decisions worth flagging:
//
// 1. storyStillActive is attached to EVERY story-backed segment, but is
//    only a BATCH-granularity check (it reflects whatever story-engine.ts's
//    lifecycle reconciliation last computed, which only runs when an
//    Edition actually builds). The other four kinds exist precisely because
//    real matches get submitted continuously BETWEEN Edition builds, and a
//    viewer polling GET /api/broadcast/live every 30 seconds needs staleness
//    caught well before the next Edition build gets around to reconciling
//    it — that's the genuine reason this file's checks have to be cheap,
//    targeted, current-state comparisons rather than a full detector re-run.
//
// 2. winStreakAtLeast is implemented here as "winStreakIntactSince": rather
//    than trying to cheaply recompute an entity's exact CURRENT streak
//    length (which would mean rebuilding a season timeline — exactly the
//    per-request heavyweight computation 16.5 rules out), the rule instead
//    captures "has this entity recorded any loss since the moment this
//    exact claim was last confirmed." That is sufficient to detect
//    staleness (a single loss breaks any win-streak claim outright) via one
//    cheap "most recent result" lookup, without ever needing the streak's
//    exact number — a more honest, correctly-scoped implementation of the
//    same underlying rule than a literal `n`-comparison would be able to
//    offer at this cost.
//
// Every OTHER story type (RESULT/PERFORMANCE/MILESTONE/ARCHIVE/PAIR_UPSET/
// PAIR_ELIMINATED/CHAMPION are permanently-true past events; FORM/H2H/
// PAIR_SURGE/SHIFT_COMEBACK/SHIFT_DOMINANCE/TIE_PENDING are ongoing
// situations story-engine.ts's own subject-/season-anchored reconciliation
// already resolves the moment they stop being true) gets storyStillActive
// alone — a real, sufficient check for those, not a shortfall. See
// story-engine.ts's own resolveUndetectedSubjectStories/
// resolveUndetectedSeasonStories for the mechanism that keeps that true.
import type { BroadcastStory, LeagueType } from "@workspace/db/schema";
import type { StoryType } from "./story-types.ts";

// ── 9.4's own VIABLE_TITLE_PROBABILITY threshold (story-detectors-league.ts)
// marks "in the race at all"; FAVOURITE_BAND_THRESHOLD below is a fresh
// judgment call (nothing elsewhere in this codebase already fixes where
// "contender" becomes "favourite") — flagged explicitly rather than left to
// look load-bearing-precise. ──────────────────────────────────────────────
export const LONGSHOT_BAND_THRESHOLD = 0.10;
export const FAVOURITE_BAND_THRESHOLD = 0.40;

export type TitleProbabilityBand = "longshot" | "contender" | "favourite";

export function titleProbabilityBand(probability: number): TitleProbabilityBand {
  if (probability < LONGSHOT_BAND_THRESHOLD) return "longshot";
  if (probability >= FAVOURITE_BAND_THRESHOLD) return "favourite";
  return "contender";
}

export type ValidityRule =
  | { kind: "storyStillActive"; storyId: number }
  | { kind: "leaderIs"; leagueType: LeagueType; entityId: number }
  | { kind: "entityActive"; leagueType: LeagueType; entityId: number }
  /** sinceInstant: ISO string — the moment this exact claim was last confirmed (the story's own updatedAt at build time). Stale iff the entity has recorded a loss after this instant. */
  | { kind: "winStreakIntactSince"; leagueType: LeagueType; entityId: number; sinceInstant: string }
  | { kind: "titleProbabilityBand"; leagueType: LeagueType; entityId: number; band: TitleProbabilityBand };

function numberFact(facts: Record<string, unknown>, key: string): number | null {
  const value = facts[key];
  return typeof value === "number" ? value : null;
}

function numberArrayFact(facts: Record<string, unknown>, key: string): number[] | null {
  const value = facts[key];
  return Array.isArray(value) && value.every((v): v is number => typeof v === "number") ? value : null;
}

/**
 * Every non-utility ProgrammeSegment gets its own set of these, generated
 * once at Edition-build time from the story's own already-known facts (no
 * new query needed here — this function is pure) and persisted alongside
 * the segment's dialogue. live-events.ts is what re-evaluates them later
 * against current state.
 */
export function validityRulesForStory(story: Pick<BroadcastStory, "id" | "storyType" | "leagueType" | "facts" | "updatedAt">): ValidityRule[] {
  const rules: ValidityRule[] = [{ kind: "storyStillActive", storyId: story.id }];
  const facts = story.facts;
  const leagueType = story.leagueType;
  const sinceInstant = story.updatedAt.toISOString();

  function pushEntityActiveAndBand(entityId: number, probability: number): void {
    rules.push({ kind: "entityActive", leagueType, entityId });
    rules.push({ kind: "titleProbabilityBand", leagueType, entityId, band: titleProbabilityBand(probability) });
  }

  switch (story.storyType as StoryType) {
    case "WIN_STREAK":
    case "UNBEATEN_PAIR": {
      const entityId = numberFact(facts, "playerId") ?? numberFact(facts, "teamId");
      if (entityId !== null) rules.push({ kind: "winStreakIntactSince", leagueType, entityId, sinceInstant });
      break;
    }
    case "NEW_LEADER": {
      const entityId = numberFact(facts, "newLeaderEntityId");
      if (entityId !== null) {
        rules.push({ kind: "leaderIs", leagueType, entityId });
        rules.push({ kind: "entityActive", leagueType, entityId });
      }
      break;
    }
    case "LEAD_TIGHTENS":
    case "LEAD_WIDENS": {
      const entityId = numberFact(facts, "leaderEntityId");
      if (entityId !== null) {
        rules.push({ kind: "leaderIs", leagueType, entityId });
        rules.push({ kind: "entityActive", leagueType, entityId });
      }
      break;
    }
    case "SHIFT_LEAD_CHANGE": {
      const entityId = numberFact(facts, "newLeaderTeamId");
      if (entityId !== null) rules.push({ kind: "leaderIs", leagueType, entityId });
      break;
    }
    case "SHIFT_MOMENTUM": {
      const entityId = numberFact(facts, "leaderTeamId");
      if (entityId !== null) rules.push({ kind: "leaderIs", leagueType, entityId });
      break;
    }
    case "TITLE_SWING": {
      const entityId = numberFact(facts, "entityId");
      const probability = numberFact(facts, "currentProbability");
      if (entityId !== null && probability !== null) pushEntityActiveAndBand(entityId, probability);
      break;
    }
    case "NEW_FAVOURITE": {
      const entityId = numberFact(facts, "newFavouriteEntityId");
      const probability = numberFact(facts, "probability");
      if (entityId !== null && probability !== null) pushEntityActiveAndBand(entityId, probability);
      break;
    }
    case "DEAD_HEAT": {
      const firstId = numberFact(facts, "firstEntityId");
      const firstP = numberFact(facts, "firstProbability");
      const secondId = numberFact(facts, "secondEntityId");
      const secondP = numberFact(facts, "secondProbability");
      if (firstId !== null && firstP !== null) pushEntityActiveAndBand(firstId, firstP);
      if (secondId !== null && secondP !== null) pushEntityActiveAndBand(secondId, secondP);
      break;
    }
    case "TITLE_RACE": {
      const ids = numberArrayFact(facts, "viableEntityIds");
      const probs = numberArrayFact(facts, "probabilities");
      if (ids && probs && ids.length === probs.length) {
        ids.forEach((entityId, i) => pushEntityActiveAndBand(entityId, probs[i]));
      }
      break;
    }
    default:
      // Every other type: storyStillActive alone is correct and sufficient — see this file's own header.
      break;
  }

  return rules;
}

// ═══════════════════════════════════════════════════════════════════════
// 11.4 Live layer classification + 11.5 ageing
// ═══════════════════════════════════════════════════════════════════════

export type LiveOverlayClass = "just_in" | "breaking";

/** 11.4: "JUST IN: Story score 45-84". */
const JUST_IN_MIN_SCORE = 45;
/** 11.4: "BREAKING: ... normally score >=90". */
const BREAKING_MIN_SCORE = 90;
/** 11.5: "overlay eligibility lasts 10 minutes after playedAt." */
const OVERLAY_AGE_LIMIT_MS = 10 * 60 * 1000;

/**
 * 11.4's own table leaves scores 85-89 undefined (JUST IN's own band caps at
 * 84; BREAKING's own threshold starts at 90) — a small real gap in the
 * doc's table, not something this function silently resolves without
 * comment: treated as JUST IN, the more conservative of the two adjacent
 * tiers, since nothing in the doc suggests a distinct third band there.
 * Below 45: ticker material only, no overlay at all.
 */
export function classifyLiveScore(score: number): LiveOverlayClass | null {
  if (score >= BREAKING_MIN_SCORE) return "breaking";
  if (score >= JUST_IN_MIN_SCORE) return "just_in";
  return null;
}

export function isWithinOverlayAgeWindow(playedAt: Date, now: Date): boolean {
  return now.getTime() - playedAt.getTime() <= OVERLAY_AGE_LIMIT_MS && now.getTime() >= playedAt.getTime();
}
