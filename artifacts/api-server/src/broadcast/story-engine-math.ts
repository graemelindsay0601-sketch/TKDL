// TKDL LIVE — Story Engine: pure math (handover doc section 9). Zero
// runtime imports (no `@workspace/db`, not even its `/schema` subpath —
// lib/db/src/schema/index.ts re-exports via extensionless specifiers that
// Node's native TS type-stripping can't resolve when this file is run
// directly by `node --test`, which is exactly how this file's own tests
// run), so it stays directly unit testable the same way every other pure
// file in this folder (title-predictor-math.ts, predictor-math.ts) is.
// A `import type` is erased entirely before module resolution happens (it
// has zero runtime footprint), so it's safe to use for the one thing this
// file needs from the schema package: a compile-time guarantee, not a
// value. Score components (9.2), treatment thresholds (9.3), freshness
// decay (9.5), and the story/subject key encoding every detector uses to
// give a story a stable, deterministic identity across repeated detection
// passes.
import type { StoryLifecycle as SchemaStoryLifecycle } from "@workspace/db/schema";
import type { Treatment } from "./story-types";

// ── 9.2: score components ────────────────────────────────────────────────
// The doc gives each component's MAX and what it should reflect in prose
// ("Points/title/elimination consequence; stronger late in month" etc.) —
// not a formula. Computing each component's actual value is each
// detector's own job (it's the one place that knows what situation it's
// scoring); this file only owns clamping components to their caps and
// summing them, so every detector sums the same way.
export const SCORE_MAX = {
  competitiveImportance: 25,
  unexpectedness: 20, // 0 for non-result stories, per the doc
  freshness: 15,
  historicalSignificance: 15,
  performanceAnomaly: 10,
  narrativeContinuity: 10,
  entertainmentValue: 5,
} as const;

export type StoryScoreComponents = {
  competitiveImportance: number;
  unexpectedness: number;
  freshness: number;
  historicalSignificance: number;
  performanceAnomaly: number;
  narrativeContinuity: number;
  entertainmentValue: number;
};

// What a pure detector can actually determine on its own, from one match's
// (or one subject's) facts alone: everything except freshness (needs "now"
// at scoring time, which changes on every Edition build long after
// detection) and narrativeContinuity (needs cross-story context — whether
// this detection develops or resolves an existing ACTIVE story — which
// only the orchestrator, story-engine.ts, holds). Those two are filled in
// there, once, right before totalScore() is called.
export type PartialStoryScoreComponents = Omit<StoryScoreComponents, "freshness" | "narrativeContinuity">;

function clampComponent(value: number, max: number): number {
  return Math.max(0, Math.min(max, value));
}

/** Sums the clamped components (the maxes already add to exactly 100, so no separate 0..100 clamp is needed on the total). */
export function totalScore(components: StoryScoreComponents): number {
  return Math.round(
    clampComponent(components.competitiveImportance, SCORE_MAX.competitiveImportance) +
    clampComponent(components.unexpectedness, SCORE_MAX.unexpectedness) +
    clampComponent(components.freshness, SCORE_MAX.freshness) +
    clampComponent(components.historicalSignificance, SCORE_MAX.historicalSignificance) +
    clampComponent(components.performanceAnomaly, SCORE_MAX.performanceAnomaly) +
    clampComponent(components.narrativeContinuity, SCORE_MAX.narrativeContinuity) +
    clampComponent(components.entertainmentValue, SCORE_MAX.entertainmentValue),
  );
}

// ── 9.2: unexpectedness ──────────────────────────────────────────────────
// "Derived from pre-match Predictor; zero for non-result stories" — the one
// component with a natural, shared formula rather than a per-detector one,
// since every RESULT-family detector has the same input available (the
// Match Predictor's own pre-match winner probability) and the doc's own
// three named thresholds (UPSET <40%, MAJOR_UPSET <25%, MODEL_SHOCK <15%,
// section 9.4) all describe the same underlying quantity at different
// severities. A probability >=0.5 (the actual winner was the favourite, or
// an exact coin flip) is zero unexpectedness — nothing surprising happened
// — scaling linearly to the full 20 points as the winner's own pre-match
// probability approaches 0. Checked against the doc's own bands: 40% ->
// 4/20, 25% -> 10/20, 15% -> 14/20, matching the "upset < major upset <
// model shock" severity ordering the doc's naming implies.
export function unexpectednessComponent(winnerProbability: number): number {
  const clamped = Math.max(0, Math.min(1, winnerProbability));
  if (clamped >= 0.5) return 0;
  return SCORE_MAX.unexpectedness * ((0.5 - clamped) / 0.5);
}

// ── 9.4: HIGH_STAKE threshold ────────────────────────────────────────────
// "Stake >= league 85th percentile, minimum 5" (Appendix A / 9.4) — the
// SAMPLE this ranks against is LeagueActivityProfile.positiveStakes
// (history-reconstruction.ts, section 8.5's own stake sample), gathered
// once per league per Edition build; predictor-math.ts's percentileRank()
// answers the opposite question (a value's rank within a sample), so this
// is the quantile function it doesn't provide: the stake VALUE at a given
// percentile, via standard linear interpolation between the two nearest
// ranks. "Minimum 5" reads as an absolute floor on the resulting threshold
// (protects a low-stakes league, where even its 85th percentile might be a
// tiny number, from flagging trivial stakes as "high") rather than a
// minimum sample size — Appendix B has no separate "minimum sample size"
// config key for this, and a floor is the simpler, self-contained reading.
function quantile(sortedAscending: number[], p: number): number {
  const idx = p * (sortedAscending.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedAscending[lower];
  const frac = idx - lower;
  return sortedAscending[lower] * (1 - frac) + sortedAscending[upper] * frac;
}

const HIGH_STAKE_PERCENTILE = 0.85;
const HIGH_STAKE_MINIMUM = 5;

/** Empty sample -> the floor alone (nothing to rank against, so nothing beats the minimum). */
export function highStakeThreshold(positiveStakes: number[]): number {
  if (positiveStakes.length === 0) return HIGH_STAKE_MINIMUM;
  const sorted = [...positiveStakes].sort((a, b) => a - b);
  return Math.max(quantile(sorted, HIGH_STAKE_PERCENTILE), HIGH_STAKE_MINIMUM);
}

// ── 9.3: treatment thresholds ────────────────────────────────────────────
// Treatment itself is declared in story-types.ts (imported above, type-only
// so it carries no runtime footprint) alongside the StoryType taxonomy —
// this function is the actual score -> Treatment math, so it stays here.
export type { Treatment };

export function treatmentForScore(score: number): Treatment {
  if (score >= 85) return "major";
  if (score >= 70) return "featured";
  if (score >= 50) return "supporting";
  if (score >= 30) return "headline_ticker";
  return "archive";
}

// ── 9.5: freshness ────────────────────────────────────────────────────────
// "Result stories use a 12-hour half-life... persistent form/title stories
// use approximately 48 hours... milestones/records may remain eligible for
// 72 hours. These are scoring decay values, not deletion timers" — an
// exponential half-life decay, standard 0.5^(elapsed/halfLife), applied to
// the freshness component's own max (15), never to the total score
// directly (a stale RESULT story should still keep its competitive-
// importance/historical-significance value, just lose freshness points).
export type StoryFreshnessClass = "result" | "persistent" | "milestone";

const FRESHNESS_HALF_LIFE_HOURS: Record<StoryFreshnessClass, number> = {
  result: 12,
  persistent: 48,
  milestone: 72,
};

export function freshnessMultiplier(hoursSinceDetected: number, freshnessClass: StoryFreshnessClass): number {
  const halfLife = FRESHNESS_HALF_LIFE_HOURS[freshnessClass];
  return Math.pow(0.5, Math.max(hoursSinceDetected, 0) / halfLife);
}

export function freshnessComponent(hoursSinceDetected: number, freshnessClass: StoryFreshnessClass): number {
  return SCORE_MAX.freshness * freshnessMultiplier(hoursSinceDetected, freshnessClass);
}

// ── Story / subject key encoding ─────────────────────────────────────────
// The doc's story object (9.1) has `storyKey`/`subjectKeys` but no encoding
// algorithm — this is this file's own scheme, applied consistently by
// every detector so re-detecting the same real-world situation always
// resolves to the SAME broadcast_stories row (the table's storyKey column
// is UNIQUE) rather than spawning duplicates.
//
// Two shapes, matching the two genuinely different kinds of story in
// Appendix A: a MATCH-ANCHORED story is a one-off historical event (an
// UPSET *in this specific match* stays that match's story forever, and a
// later different match's UPSET is a different story) — its key includes
// anchorMatchId. A SUBJECT-ANCHORED story describes an ONGOING situation
// about a player/team (a win streak, a title race) that should update the
// same row as it develops, not spawn a new row every time it's
// re-detected — its key is keyed off the sorted subject list instead.

export function subjectKey(leagueType: "singles" | "doubles" | "shift_wars", entityId: number): string {
  return `${leagueType}:${entityId}`;
}

export function matchAnchoredStoryKey(
  leagueType: "singles" | "doubles" | "shift_wars",
  storyType: string,
  anchorMatchId: number,
): string {
  return `${leagueType}:${storyType}:match:${anchorMatchId}`;
}

export function subjectAnchoredStoryKey(
  leagueType: "singles" | "doubles" | "shift_wars",
  storyType: string,
  subjectKeys: string[],
): string {
  return `${leagueType}:${storyType}:subjects:${[...subjectKeys].sort().join(",")}`;
}

// A third shape, added while building story-engine.ts (the orchestrator):
// a SEASON-anchored story is a standings-based situation whose subjects are
// PERMANENT entities that recur season after season (a Singles player who
// can be crowned CHAMPION more than once in their life; a Shift Wars
// department, one of only three fixed teams that plays every single
// month). Plain subjectAnchoredStoryKey collides across seasons for
// exactly those cases — the same player winning the title in season 3 and
// again in season 11 would resolve to the identical storyKey, so the
// second win would incorrectly read as "still detected" (a continuation
// of a years-old ACTIVE story) instead of the brand-new event it actually
// is. Doubles doesn't need this: its team ids are fresh per-season rows
// that are never reused (see team-history-reconstruction.ts's own
// header), so a Doubles team id can't collide across seasons in the first
// place. story-engine.ts uses this for the whole LEAGUE and SHIFT_WARS
// families plus ARCHIVE's SEASON_COMPARISON — every case where the
// underlying situation is inherently scoped to one season/month's own
// competition, not an entity's whole career.
//
// The `season:${seasonId}:` segment is placed so a caller can also find
// every story for one league+type+season via a storyKey PREFIX match
// (`${leagueType}:${storyType}:season:${seasonId}:`), which story-engine.ts
// needs to reconcile stories whose trigger condition stopped holding
// (LEAGUE/SHIFT_WARS types don't share one fixed subject list the way
// FORM/H2H do — TITLE_RACE's subjects are whichever entities are viable
// this pass, which changes as the race narrows — so reconciliation there
// has to scan by prefix rather than recomputing one known key).
export function seasonAnchoredStoryKey(
  leagueType: "singles" | "doubles" | "shift_wars",
  storyType: string,
  seasonId: number,
  subjectKeys: string[],
): string {
  return `${leagueType}:${storyType}:season:${seasonId}:subjects:${[...subjectKeys].sort().join(",")}`;
}

/** The storyKey prefix every seasonAnchoredStoryKey() for this (league, type, season) shares, for reconciliation scans. */
export function seasonAnchoredStoryKeyPrefix(
  leagueType: "singles" | "doubles" | "shift_wars",
  storyType: string,
  seasonId: number,
): string {
  return `${leagueType}:${storyType}:season:${seasonId}:subjects:`;
}

// ── Lifecycle transitions ────────────────────────────────────────────────
// The doc's story object declares the six lifecycle values (9.1) but
// section 9 itself doesn't specify the transition rule between them — that
// reads as belonging to the Edition/Director machinery (sections 10-11),
// which this phase doesn't build. This is a reasonable, explicit reading
// of what section 9 alone implies (a story needs SOME lifecycle value the
// moment it's detected or re-detected), not a transcription of a rule the
// doc actually states: NEW on first detection; RESOLVED the moment a
// detector re-runs and the underlying situation no longer holds; HOT/
// COOLING when the score has moved meaningfully since last time; ACTIVE
// otherwise; a situation recurring after being RESOLVED/ARCHIVED reads as
// a fresh NEW story rather than reanimating the old one (a second win
// streak after the first one broke is a new streak, not a continuation).
// The actual time-based ARCHIVED sweep (a RESOLVED story aging out of
// consideration) needs wall-clock tracking across Edition builds, which is
// the Director's job, not this pure function's — flagged as a scope
// boundary, not silently dropped.
//
// The six values themselves are declared here AND in
// lib/db/src/schema/broadcast.ts's own STORY_LIFECYCLES (the
// broadcast_stories.lifecycle column's type) — a real textual duplication,
// not eliminated by importing the schema's value export here, since that
// would reintroduce the module-resolution problem noted above. What IS
// eliminated is silent drift: the type-only import above plus the
// assertion right below make it a compile error, in this file, if the two
// definitions are ever a value apart in either direction.
export const STORY_LIFECYCLES = ["NEW", "HOT", "ACTIVE", "COOLING", "RESOLVED", "ARCHIVED"] as const;
export type StoryLifecycle = (typeof STORY_LIFECYCLES)[number];

type AssertLifecycleParity = [StoryLifecycle] extends [SchemaStoryLifecycle]
  ? [SchemaStoryLifecycle] extends [StoryLifecycle]
    ? true
    : ["schema has a lifecycle value this file is missing"]
  : ["this file has a lifecycle value the schema is missing"];
const _lifecycleParityCheck: AssertLifecycleParity = true as AssertLifecycleParity;
void _lifecycleParityCheck;

const HOT_SCORE_DELTA = 10; // judgment call: a double-digit score jump reads as "getting more newsworthy," not just "still true"
const COOLING_SCORE_DELTA = -10;

export function nextLifecycle(params: {
  previousLifecycle: StoryLifecycle | null; // null = never detected before
  stillDetected: boolean; // this pass re-ran the trigger and it's still true
  previousScore: number | null;
  currentScore: number;
}): StoryLifecycle {
  if (!params.stillDetected) return "RESOLVED";
  if (params.previousLifecycle === null || params.previousScore === null) return "NEW";
  if (params.previousLifecycle === "RESOLVED" || params.previousLifecycle === "ARCHIVED") return "NEW";

  const delta = params.currentScore - params.previousScore;
  if (delta >= HOT_SCORE_DELTA) return "HOT";
  if (delta <= COOLING_SCORE_DELTA) return "COOLING";
  return "ACTIVE";
}
