// TKDL LIVE — Broadcast Director: pure math (handover doc sections 9.6, 10,
// 11.1-11.3). Zero `@workspace/db` runtime imports (only `import type`,
// which is erased before module resolution — same reasoning as story-
// engine-math.ts's own header), so this file stays directly unit testable
// the same way every other pure file in this folder does. director.ts (the
// DB-facing counterpart) gathers real broadcast_stories/broadcast_editions
// rows and calls into this file to merge, score, classify and select.
import type { BroadcastStory, StoryLifecycle } from "@workspace/db/schema";
import type { Treatment } from "./story-types.ts";
import type { ValidityRule } from "./live-events-math.ts";
import { treatmentForScore } from "./story-engine-math.ts";
import { shuffle } from "./seeded-rng.ts";

// ═══════════════════════════════════════════════════════════════════════
// 9.6 Story merging
// ═══════════════════════════════════════════════════════════════════════
//
// "All candidate detections from one result are grouped by anchor match
// before Edition selection. Choose one primary narrative and attach the
// rest as supporting facts." — literally: every broadcast_stories row that
// carries an anchorMatchId groups with every other row sharing that SAME
// anchorMatchId (this is exactly what lets one match that triggers UPSET +
// STREAK_BREAKER + HIGH_STAKE_WIN + a MILESTONE collapse into one segment
// instead of four).
//
// The doc's own worked example ("upset + streak breaker + new second place
// + title swing becomes one major TITLE_RACE_SHOCK segment") goes further
// than that literal rule, though — "new second place" and "title swing" are
// LEAGUE-family stories, which are season-anchored, not match-anchored (see
// story-engine.ts's own header on why: they're ongoing standings situations,
// re-detected once per league/season pass, not once per match). Nothing in
// the current schema records "which specific match most recently drove this
// LEAGUE detection," so there is no real causal link this function could
// merge on for that case without guessing — attempting it would mean
// silently attaching a LEAGUE story to whichever match merely happens to
// share a subject key and a similar timestamp, which is exactly the kind of
// unverified inference the fact firewall (17.1) exists to prevent. This
// function therefore implements the doc's LITERAL, verifiable merge rule —
// match-anchored stories by shared anchorMatchId — plus one further, equally
// verifiable tier the Appendix C.1 function name ("mergeStoriesByAnchor
// AND NARRATIVE") implies: subject-anchored stories (no anchorMatchId) that
// share the exact same subject-key set merge together too, since more than
// one story type CAN legitimately be true of the very same subject(s) at
// once (a player mid-WIN_STREAK who is also ABOVE_BASELINE, or a title race
// with both a DEAD_HEAT and a TITLE_RACE story live for the same entities) —
// presenting those as two separate segments back-to-back would read as
// repetitive, not as two different narratives. Cross-family "this LEAGUE
// story was CAUSED BY that match" merging remains a documented gap, not a
// silent one — a future phase could close it by having story-engine.ts
// record a causingMatchId on LEAGUE-family facts, but that's new plumbing,
// not something this function can retrofit from data that isn't there.

export type MergedStoryGroup = {
  /** "match:<id>" or "subjects:<sorted,keys>" — stable and useful for logging/debugging, not persisted anywhere. */
  groupKey: string;
  /** The highest-scoring story in the group — this is the one narrative a segment gets built around. */
  primary: BroadcastStory;
  /** Everything else in the group, highest score first — folded into the primary segment as extra supporting facts, never given their own segment. */
  supporting: BroadcastStory[];
};

function mergeGroupKey(story: Pick<BroadcastStory, "anchorMatchId" | "subjectKeys">): string {
  if (story.anchorMatchId !== null) return `match:${story.anchorMatchId}`;
  return `subjects:${[...story.subjectKeys].sort().join(",")}`;
}

/** Deterministic ranking within a group: highest score first; ties broken by lowest id (the story detected/created first) so output order never depends on input order or a re-run's incidental Map iteration order. */
function byScoreThenId(a: BroadcastStory, b: BroadcastStory): number {
  return b.score - a.score || a.id - b.id;
}

export function mergeStoriesByAnchorAndNarrative(stories: readonly BroadcastStory[]): MergedStoryGroup[] {
  const groups = new Map<string, BroadcastStory[]>();
  for (const story of stories) {
    const key = mergeGroupKey(story);
    const existing = groups.get(key);
    if (existing) existing.push(story);
    else groups.set(key, [story]);
  }

  const result: MergedStoryGroup[] = [];
  for (const [groupKey, members] of groups) {
    const [primary, ...supporting] = [...members].sort(byScoreThenId);
    result.push({ groupKey, primary, supporting });
  }
  // Highest-scoring group first — a stable, useful default order for any
  // caller that doesn't immediately re-sort (e.g. a quick diagnostic dump);
  // director.ts's own running-order selection re-ranks by its own rules
  // regardless.
  return result.sort((a, b) => byScoreThenId(a.primary, b.primary));
}

// ═══════════════════════════════════════════════════════════════════════
// 10.1 Edition Change Score
// ═══════════════════════════════════════════════════════════════════════
//
// "+5 each new completed match ... +5 each newly created Supporting story
// (50-69) ... +10 each newly created Featured story (70-84) ... +20 each
// newly created Major story (85+). Generate new Edition when score >= 30."
// Headline/ticker (30-49) and archive (0-29) bands earn no bonus — the
// doc's own table only lists three story bands, not five.
//
// "Story bonuses are applied after story merging so one match cannot
// inflate the score by spawning many closely related labels" is exactly
// why this function takes ONE treatment per MERGED GROUP (director.ts is
// expected to have already called mergeStoriesByAnchorAndNarrative and
// filtered to groups whose primary is newly created this batch), not one
// per raw broadcast_stories row.
const NEW_MATCH_POINTS = 5;
const NEW_STORY_BONUS: Partial<Record<Treatment, number>> = {
  supporting: 5,
  featured: 10,
  major: 20,
};

export function editionChangeScore(params: {
  newCompletedMatchCount: number;
  /** One entry per merged group whose primary story is newly created (lifecycle === "NEW") since the previous published Edition's cutoff — never one entry per raw candidate row. */
  newlyCreatedGroupTreatments: readonly Treatment[];
}): number {
  let score = params.newCompletedMatchCount * NEW_MATCH_POINTS;
  for (const treatment of params.newlyCreatedGroupTreatments) {
    score += NEW_STORY_BONUS[treatment] ?? 0;
  }
  return score;
}

/** Convenience wrapper — the one line editionChangeScore() itself doesn't do: turning "newly created" merged groups into the treatments editionChangeScore() actually wants. */
export function newlyCreatedGroupTreatments(groups: readonly MergedStoryGroup[]): Treatment[] {
  return groups.filter(g => g.primary.lifecycle === "NEW").map(g => treatmentForScore(g.primary.score));
}

// ═══════════════════════════════════════════════════════════════════════
// 10.2 Forced next-slot refresh
// ═══════════════════════════════════════════════════════════════════════

export function isForcedRefresh(params: {
  seasonChampionOrResetEventOccurred: boolean;
  noPublishedEditionExists: boolean;
  /** null when no published Edition exists at all (noPublishedEditionExists already covers that case on its own). */
  publishedEditionAgeHours: number | null;
  adminForced: boolean;
}): boolean {
  if (params.adminForced) return true;
  if (params.noPublishedEditionExists) return true;
  if (params.seasonChampionOrResetEventOccurred) return true;
  // Originally this clause also required hasAtLeastOneNewMatch, on the
  // theory that a rebuild with literally nothing new to say wasn't worth
  // forcing. In practice that meant a real quiet stretch (no matches
  // logged) left the same published Edition looping indefinitely, which is
  // exactly what players told us felt stale ("a constant same episode
  // loop" — direct player feedback). collectNewAndActiveStories() always
  // has HOT/ACTIVE/COOLING form and league stories, plus the FILLER family
  // (PRACTICE_ACTIVITY/SHADOW_BOT_PROMO/FEATURE_SPOTLIGHT), so a forced
  // rebuild on a quiet day still has real content to draw a fresh-sounding
  // Edition from — it's just guaranteed to happen at least once every 24h
  // regardless of match activity, per the explicit ask for "one new
  // episode a day."
  if (params.publishedEditionAgeHours !== null && params.publishedEditionAgeHours > 24) return true;
  return false;
}

// ═══════════════════════════════════════════════════════════════════════
// 11.2 Carry-forward rules
// ═══════════════════════════════════════════════════════════════════════
//
// The doc's own 11.2 table names four states — ACTIVE, DEVELOPED, STALE,
// RESOLVED — that are NOT the story's persisted lifecycle (9.1's six-value
// NEW/HOT/ACTIVE/COOLING/RESOLVED/ARCHIVED, already implemented in story-
// engine-math.ts). They're a separate, higher-level classification that
// only makes sense for a story that WAS already featured in the previous
// Edition: given that starting point, did it stay the same (ACTIVE), move
// meaningfully (DEVELOPED), stop being detected or fade (STALE), or resolve
// outright (RESOLVED)? A story with no previous-Edition appearance at all
// isn't a "carry-forward" candidate in the first place — it's just new —
// hence the `null` return below for that case.
export type CarryForwardState = "ACTIVE" | "DEVELOPED" | "STALE" | "RESOLVED";

export function classifyCarryForward(params: {
  wasFeaturedInPreviousEdition: boolean;
  currentLifecycle: StoryLifecycle;
}): CarryForwardState | null {
  if (!params.wasFeaturedInPreviousEdition) return null;
  if (params.currentLifecycle === "RESOLVED") return "RESOLVED";
  // ARCHIVED reads as "dropped from consideration entirely" here — the
  // doc's four carry-forward states have no distinct "gone quiet a long
  // time ago" bucket beyond STALE, and ARCHIVED is a strictly later, more
  // final state than a story that simply stopped being redetected once.
  if (params.currentLifecycle === "ARCHIVED") return "STALE";
  // A double-digit score swing (HOT/COOLING, per story-engine-math.ts's own
  // nextLifecycle()) is exactly "facts materially changed" — the doc's own
  // bar for DEVELOPED eligibility.
  if (params.currentLifecycle === "HOT" || params.currentLifecycle === "COOLING") return "DEVELOPED";
  if (params.currentLifecycle === "ACTIVE") return "ACTIVE";
  // NEW shouldn't really reach here (wasFeaturedInPreviousEdition implies
  // this isn't the story's first detection), but a story can genuinely be
  // NEW again after resolving and later recurring (nextLifecycle's own
  // "RESOLVED/ARCHIVED -> NEW on recurrence" rule) — that reads as STALE
  // from the PREVIOUS Edition's point of view (the old occurrence is over;
  // this is a fresh one, not a continuation to carry forward).
  return "STALE";
}

/**
 * 11.2's rule table as one function: is THIS specific carry-forward state
 * eligible for another full segment at all? (RESOLVED's "one resolution
 * segment, then cool/archive" cap — has it already HAD that one segment —
 * is a stateful fact only director.ts's own broadcast_stories.fullCount/
 * lastFullEditionId bookkeeping can answer, so it's threaded in here rather
 * than re-derived.)
 */
export function isCarryForwardEligibleForFullSegment(state: CarryForwardState, alreadyGivenResolutionSegment: boolean): boolean {
  switch (state) {
    case "ACTIVE": return true;
    case "DEVELOPED": return true;
    case "STALE": return false;
    case "RESOLVED": return !alreadyGivenResolutionSegment;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 10.4 Exposure balance
// ═══════════════════════════════════════════════════════════════════════

export const LEAGUE_AIRTIME_SOFT_CAP = 0.55; // "55% of full-segment time per league in a normal Edition"
export const MAX_FULL_SEGMENTS_PER_SUBJECT = 2; // "at most two full segments in one Edition unless separate Major events justify more"
export const REPETITION_PENALTY = 15; // judgment call: enough to usually push a repeated ACTIVE story below a genuinely new one of similar raw score, without being an absolute ban (11.2's "may carry forward ... reduce priority", not "never again")

/**
 * The one number director.ts's running-order selection actually ranks
 * candidates by: raw score, minus a flat penalty for "this exact story
 * already got a full segment and hasn't materially moved since" (11.2's
 * ACTIVE case), with STALE/already-resolved-and-spent groups excluded
 * outright (-Infinity, so a stable sort never accidentally surfaces them).
 * DEVELOPED and a fresh RESOLVED-but-not-yet-closed story get no penalty —
 * both are explicitly "eligible again" per 11.2's own table.
 */
export function fullSegmentPriority(params: {
  baseScore: number;
  carryForwardState: CarryForwardState | null; // null = wasn't in the previous Edition; always fully eligible
  alreadyGivenResolutionSegment: boolean;
}): number {
  if (params.carryForwardState === null) return params.baseScore;
  if (!isCarryForwardEligibleForFullSegment(params.carryForwardState, params.alreadyGivenResolutionSegment)) return -Infinity;
  if (params.carryForwardState === "ACTIVE") return params.baseScore - REPETITION_PENALTY;
  return params.baseScore;
}

/**
 * "A player/team normally receives at most two full segments in one
 * Edition unless separate Major events justify more" — a single subject
 * (by subjectKey, singular — a two-subject H2H/pair story counts once per
 * subject it names) is only blocked once it's ALREADY at the cap AND the
 * new candidate isn't itself a Major story. "Separate Major events" reads
 * as "a third Major-treatment story about this same subject is still
 * allowed through"; a third Featured/Supporting one about an already-
 * twice-featured subject is not.
 */
export function isWithinSubjectExposureCap(params: {
  fullSegmentsAlreadyGivenToThisSubjectThisEdition: number;
  candidateTreatment: Treatment;
}): boolean {
  if (params.fullSegmentsAlreadyGivenToThisSubjectThisEdition < MAX_FULL_SEGMENTS_PER_SUBJECT) return true;
  return params.candidateTreatment === "major";
}

/**
 * "Soft league airtime cap: 55% of full-segment time per league ... Major
 * title events may override." Takes SECONDS (estimatedSeconds, 14.5), not a
 * segment count, since the doc's own language ("airtime", "time") is about
 * duration, and segments vary a lot in length (a Major story runs 4-6
 * dialogue turns per 12.6, a Supporting one only 2). Only checked against
 * stories that AREN'T themselves Major — a genuine Major-title event is
 * explicitly allowed to blow through the cap, per the doc's own override
 * clause.
 *
 * `onlyLeagueWithContent` exists because the 55% figure only means anything
 * when there's a SECOND league whose stories could have used that airtime
 * instead — that's the entire reason the doc calls this a "per league"
 * balance rule in the first place. A club running only singles (no doubles/
 * shift_wars matches recorded at all) has every single candidate belong to
 * the one league that has any content, so `thisLeagueSecondsSoFar` is
 * always exactly equal to `totalFullSegmentSecondsSoFar` from the second
 * full segment onward — a projected share of 100% every time — and this
 * cap, meant to stop one league CROWDING OUT another, would instead
 * silently cap the entire Edition at one full segment ever, regardless of
 * how many genuine, distinct stories exist to tell. director.ts computes
 * this once per build (whether the candidate pool contains more than one
 * distinct leagueType) and threads it through every pickForSlot call.
 */
export function isWithinLeagueAirtimeCap(params: {
  candidateTreatment: Treatment;
  candidateSeconds: number;
  thisLeagueSecondsSoFar: number;
  totalFullSegmentSecondsSoFar: number;
  onlyLeagueWithContent: boolean;
}): boolean {
  if (params.candidateTreatment === "major") return true;
  if (params.onlyLeagueWithContent) return true; // nothing to balance airtime AGAINST
  if (params.totalFullSegmentSecondsSoFar === 0) return true; // nothing booked yet — nothing to be a share OF
  const projectedShare = (params.thisLeagueSecondsSoFar + params.candidateSeconds) / (params.totalFullSegmentSecondsSoFar + params.candidateSeconds);
  return projectedShare <= LEAGUE_AIRTIME_SOFT_CAP;
}

// ═══════════════════════════════════════════════════════════════════════
// 10.5 Variety — breaking ties without breaking "the best story wins"
// ═══════════════════════════════════════════════════════════════════════
//
// Direct response to player feedback that two Editions felt "structurally
// identical" even with the phrase bank's own variety fixed elsewhere:
// rankCandidates' sort (director.ts) is fully deterministic once every
// score/carry-forward input is fixed, so a genuinely tied field of
// candidates — same priority, same raw score, common among ARCHIVE/FILLER's
// own deliberately modest, deliberately stable scoring, and among several
// FORM/PERFORMANCE stories on a quiet week — previously always resolved to
// the same story id winning the same slot, Edition after Edition, for as
// long as the tie held (the sort's own final tiebreak was raw id, which
// never changes). This never changes WHICH story is best: a candidate can
// only ever be reordered against others sharing its EXACT priority and
// score, so a genuinely higher-ranked story can never lose a slot to a
// lower-ranked one — it only decides, among several equally-good stories,
// which one gets first pick this time. Uses the same per-Edition seeded-RNG
// contract (seeded-rng.ts) every other seeded choice in this codebase
// already follows, so the choice stays stable for every viewer of the same
// Edition and reproducible on a rebuild of that exact slot.
export function applyVarietyShuffle<T>(
  sortedDescByPriorityThenScore: readonly T[],
  keyOf: (item: T) => { priority: number; score: number },
  rng: () => number,
): T[] {
  const result: T[] = [];
  let i = 0;
  while (i < sortedDescByPriorityThenScore.length) {
    let j = i + 1;
    const head = keyOf(sortedDescByPriorityThenScore[i]);
    while (j < sortedDescByPriorityThenScore.length) {
      const current = keyOf(sortedDescByPriorityThenScore[j]);
      if (current.priority !== head.priority || current.score !== head.score) break;
      j++;
    }
    result.push(...shuffle(sortedDescByPriorityThenScore.slice(i, j), rng));
    i = j;
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════
// 11.1 Normal running-order template
// ═══════════════════════════════════════════════════════════════════════
//
// The doc's own table, transcribed as data rather than executable
// selection logic — matching which merged group best fits "Different
// league / second major story" or "WHAT TO WATCH" is director.ts's own
// job (it needs the full candidate pool, already-filled slots and league
// tallies in hand, none of which this pure data belongs holding). This is
// the fixed shape every normal Edition's running order is assembled
// against.
export type RunningOrderSlotPurpose =
  | "opening_headlines" | "main_story" | "second_major_story" | "analysis_or_predictor"
  | "supporting_story_or_checkin" | "form_h2h_or_spotlight" | "third_league_current_state"
  | "lighter_or_archive_or_callback" | "what_to_watch" | "closing";

export type RunningOrderSlotTemplate = { slot: number; purpose: RunningOrderSlotPurpose; required: boolean };

export const NORMAL_RUNNING_ORDER_TEMPLATE: readonly RunningOrderSlotTemplate[] = [
  { slot: 1, purpose: "opening_headlines", required: true },
  { slot: 2, purpose: "main_story", required: true },
  { slot: 3, purpose: "second_major_story", required: false },
  { slot: 4, purpose: "analysis_or_predictor", required: false },
  { slot: 5, purpose: "supporting_story_or_checkin", required: false },
  { slot: 6, purpose: "form_h2h_or_spotlight", required: false },
  { slot: 7, purpose: "third_league_current_state", required: false },
  { slot: 8, purpose: "lighter_or_archive_or_callback", required: false },
  { slot: 9, purpose: "what_to_watch", required: true },
  { slot: 10, purpose: "closing", required: true },
] as const;

// ═══════════════════════════════════════════════════════════════════════
// Programme shape — the persisted broadcast_editions.programme JSON
// ═══════════════════════════════════════════════════════════════════════
//
// Defined here (pure shape, no logic) rather than in director.ts/
// edition-engine.ts because BOTH of those DB-facing files need the exact
// same shape to agree: director.ts reads the PREVIOUS Edition's programme
// back in to classify carry-forward state (11.2), and edition-engine.ts is
// what writes a new one out after assembly. `lifecycleAtBroadcast` is the
// one field that exists purely to make carry-forward classification exact
// rather than approximate: it lets a future build tell "this story was
// already RESOLVED when it last got a full segment" (11.2's "one
// resolution segment, then cool/archive" cap is now satisfied — drop it)
// apart from "this story has JUST become RESOLVED since its last segment"
// (this next segment IS its one resolution segment — still eligible) using
// only what was actually broadcast, never a guess about internal timing.
export type ProgrammeSegment = {
  slot: number;
  purpose: RunningOrderSlotPurpose;
  importance: Treatment | "utility";
  /** null only for a slot with no story of its own (10's closing sign-off, or 9's what-to-watch in the documented no-LEAGUE-story edge case — see director.ts). */
  storyId: number | null;
  supportingStoryIds: number[];
  storyType: string | null;
  leagueType: "singles" | "doubles" | "shift_wars" | null;
  /** This story's broadcast_stories.lifecycle AT THE MOMENT this segment aired — see this section's own header for why. */
  lifecycleAtBroadcast: StoryLifecycle | null;
  dialogue: { speaker: "A" | "B"; text: string; holdSeconds: number }[];
  /** 11.6's own "simple validity rules" — empty for the two fixed utility segments (nothing about a hand-written sign-off line can go stale), generated once at build time from the story's own facts for every other segment. Typed here (not live-events-math.ts) only because ProgrammeSegment itself lives here; live-events-math.ts owns the type's actual definition and generation/evaluation logic. */
  validityRules: ValidityRule[];
  /** This story's own broadcast_stories.facts at build time — null only for the two fixed utility segments, which have no story behind them at all. Carried onto the persisted segment (rather than re-fetched later) for the same reason lifecycleAtBroadcast is: 14.5's own `graphic: { kind, data }` needs exactly these already-fact-firewalled numbers to build a segment's data graphic, and re-reading broadcast_stories at serialization time would risk showing a LATER, live-updated version of facts the dialogue itself never actually spoke — api-shapes.ts (routes/broadcast.ts's own serialization layer) reads this field directly rather than re-querying. */
  facts: Record<string, unknown> | null;
};

export type EditionProgramme = { segments: ProgrammeSegment[] };

/** `${slot}`'s own stable public segment id — shared by edition-engine.ts (quality-gate segment ids, live-events.ts lookups) and, eventually, routes/broadcast.ts's own 14.5 response serialization, so all three agree on the same scheme without re-deriving it independently. */
export function programmeSegmentId(slot: number): string {
  return `slot-${slot}`;
}

// ═══════════════════════════════════════════════════════════════════════
// 11.3 Quality gate before publish
// ═══════════════════════════════════════════════════════════════════════
//
// Pure predicates over an already-assembled programme — director.ts/
// edition-engine.ts build the actual segment list (with real `dialogue`,
// section 12); this file only owns the go/no-go rule for each documented
// gate condition, so the rules themselves stay independently testable
// without needing a fake Commentary Engine to produce fake dialogue.
export type QualityGateSegment = {
  id: string;
  leagueType: "singles" | "doubles" | "shift_wars" | null;
  importance: Treatment | "utility";
  sentiment: "positive" | "neutral" | "negative" | null;
  storyId: number | null;
};

export type QualityGateInput = {
  segments: readonly QualityGateSegment[];
  isChampionOrSeasonBoundarySpecial: boolean;
  /** True if any segment's dialogue references a match/story outside the Edition's own data cutoff snapshot — director.ts/validation.ts populate this from the real fact-firewall check (17.1), not this file. */
  hasFactsOutsideCutoffSnapshot: boolean;
  hasInvalidFutureMatchLanguage: boolean;
  hasUnresolvedPlaceholders: boolean;
  hasDuplicateStoryIds: boolean;
  /** subjectKey -> segments referencing it that are BOTH negative-sentiment AND inside 12.7's cooldown window. */
  playersWithRepeatedNegativeBanterInCooldown: readonly string[];
};

export type QualityGateResult = { pass: true } | { pass: false; reasons: string[] };

const MIN_MEANINGFUL_SEGMENTS = 4;

export function evaluateQualityGate(input: QualityGateInput): QualityGateResult {
  const reasons: string[] = [];

  if (!input.isChampionOrSeasonBoundarySpecial && input.segments.length < MIN_MEANINGFUL_SEGMENTS) {
    reasons.push(`fewer than ${MIN_MEANINGFUL_SEGMENTS} meaningful segments (${input.segments.length})`);
  }
  if (input.hasFactsOutsideCutoffSnapshot) reasons.push("dialogue facts do not all validate against the Edition cutoff snapshot");
  if (input.hasInvalidFutureMatchLanguage) reasons.push("invalid future-match language present");

  const leagueCounts = new Map<string, number>();
  for (const s of input.segments) {
    if (s.leagueType && (s.importance === "major" || s.importance === "featured" || s.importance === "supporting")) {
      leagueCounts.set(s.leagueType, (leagueCounts.get(s.leagueType) ?? 0) + 1);
    }
  }
  const fullSegmentTotal = [...leagueCounts.values()].reduce((a, b) => a + b, 0);
  const hasMajor = input.segments.some(s => s.importance === "major");
  // Same reasoning as isWithinLeagueAirtimeCap's own onlyLeagueWithContent
  // param above: "exceeds its share" only means something when a SECOND
  // league's content lost airtime to the first one. leagueCounts.size <= 1
  // means every full segment this Edition already belongs to the only
  // league that has any real content at all — nothing else was crowded out,
  // so this is correctly a 100% share with nothing to fail. Without this
  // guard, a single-league club's full segments always land in that one
  // league by construction, always compute as 100% > 55%, and the quality
  // gate would fail (and discard) every single Edition it ever tries to
  // publish, no matter how much genuine content it has.
  if (!hasMajor && fullSegmentTotal > 0 && leagueCounts.size > 1) {
    for (const [league, count] of leagueCounts) {
      if (count / fullSegmentTotal > LEAGUE_AIRTIME_SOFT_CAP) {
        reasons.push(`league "${league}" exceeds the ${Math.round(LEAGUE_AIRTIME_SOFT_CAP * 100)}% soft airtime cap without a Major-story justification`);
      }
    }
  }

  if (!input.segments.some(s => s.sentiment === "positive" || s.sentiment === "neutral")) {
    reasons.push("no positive or neutral segment present");
  }
  if (input.playersWithRepeatedNegativeBanterInCooldown.length > 0) {
    reasons.push(`repeated negative banter inside cooldown for: ${input.playersWithRepeatedNegativeBanterInCooldown.join(", ")}`);
  }
  if (input.hasUnresolvedPlaceholders) reasons.push("unresolved placeholder(s) present");
  if (input.hasDuplicateStoryIds) reasons.push("duplicate story ids present");

  return reasons.length === 0 ? { pass: true } : { pass: false, reasons };
}
