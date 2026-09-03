// TKDL LIVE — Broadcast Director: the DB-facing running-order selector
// (handover doc sections 10-11; Appendix C.1's own `directorSelect(merged,
// titleSnapshots)`). director-math.ts owns every pure rule this file
// applies (merging, priority scoring, exposure caps, carry-forward
// classification, the running-order template shape) — this file's own job
// is purely the SLOT-MATCHING logic 11.1's table describes in prose
// ("different league", "Form, H2H, stats or spotlight", "if needed") that
// has no home in a pure file because it's about picking among a real,
// already-scored candidate pool, not a standalone rule.
//
// DB-FACING, NOT UNIT TESTED — same convention as story-engine.ts,
// config.ts and commentary-engine.ts: no dedicated test file, verified by
// typecheck + build clean and by construction from the fully-tested pure
// layer underneath (director-math.ts, story-engine-math.ts, story-types.ts).
// directorSelect() itself takes an already-fetched story pool and a
// previous programme as PLAIN ARGUMENTS rather than querying the database
// itself — it doesn't need to (story-engine.ts's own
// collectNewAndActiveStories() is what gathers the pool; edition-engine.ts
// is what reads the previous Edition row) — so despite living in this
// "DB-facing" file for consistency with its sibling orchestration files,
// it's actually a synchronous pure function over its inputs. Kept in this
// file rather than director-math.ts anyway because — unlike everything in
// director-math.ts — its own logic is about SELECTING from a real pool via
// story-type-family lookups (familyForStoryType), which is identity/
// taxonomy business, not scoring math.
//
// ── Slot-by-slot interpretation of 11.1's prose ───────────────────────────
// Slots 2/5 (main_story / supporting_story_or_checkin) take whatever the
// single highest-priority remaining candidate is, no family filter — that's
// literally what "highest valid Main Story" and "supporting story" mean.
// Slot 3 ("different league / second major story") prefers a candidate from
// a DIFFERENT league than slot 2's; failing that, only a genuine Major
// story is allowed to double up on the same league (a second Major result
// is worth a segment regardless of league; a second Featured/Supporting one
// from the same league is exactly the kind of repetition 10.4 exists to
// prevent). Slot 4 ("Analysis / Title Predictor if materially useful") maps
// directly to the LEAGUE family — the only family whose stories are ever
// Title-Predictor-driven — with "if materially useful" already enforced by
// the Story Engine's own detection thresholds (a LEAGUE story that didn't
// clear its own materiality bar was never detected at all, so any
// candidate reaching this pool by definition already cleared it). Slot 6
// ("Form, H2H, stats or spotlight") maps to FORM ∪ H2H ∪ PERFORMANCE — the
// three families whose whole subject IS individual form/stats, PERFORMANCE
// included since match-level scoring/checkout numbers are exactly "stats."
// Slot 7 ("third-league current state if needed") only fires when a third
// leagueType genuinely hasn't appeared in slots 2-6 yet AND a real
// candidate exists for it — "if needed" means exactly that, not "always."
// Slot 8 ("lighter/archive/presenter callback") prefers the ARCHIVE family
// specifically (LAST_MEETING/SEASON_COMPARISON/HISTORICAL_H2H are
// definitionally the "lighter" evergreen-context stories — see their own
// detectors' own components, which deliberately score modestly), falling
// back to whatever's next-best rather than leaving real content unused.
import { treatmentForScore } from "./story-engine-math.ts";
import { familyForStoryType, type StoryType, type Treatment } from "./story-types.ts";
import {
  mergeStoriesByAnchorAndNarrative, classifyCarryForward,
  fullSegmentPriority, isWithinSubjectExposureCap, isWithinLeagueAirtimeCap,
  type MergedStoryGroup, type CarryForwardState, type RunningOrderSlotPurpose,
  type EditionProgramme, type ProgrammeSegment,
} from "./director-math.ts";
import type { BroadcastStory } from "@workspace/db/schema";

// Rough per-treatment airtime estimate for the 10.4 running tally ONLY
// (never persisted, never shown to a viewer) — derived from 12.6's own
// turn-count-by-treatment (Supporting 3 [originally 2 — QUICK_HIT grew a
// required 3rd "banter" turn, see commentary-math.ts's own comment on
// BLUEPRINTS.QUICK_HIT], Featured 3-4, Major 4-6 turns) times
// dialogueHoldSeconds' own [3.5, 9] per-turn range, using each band's
// approximate midpoint turn count and hold time.
const ESTIMATED_SECONDS_BY_TREATMENT: Record<Treatment, number> = {
  supporting: 3 * 6,
  featured: 3.5 * 6,
  major: 5 * 6,
  headline_ticker: 4,
  archive: 3.5 * 6,
};

export type RunningOrderEntry = {
  slot: number;
  purpose: RunningOrderSlotPurpose;
  group: MergedStoryGroup | null;
  treatment: Treatment | "utility";
  carryForwardState: CarryForwardState | null;
};

export type DirectorResult = {
  runningOrder: RunningOrderEntry[];
  /** Every merged group considered, whether or not it made the running order — edition-engine.ts needs this for 10.1's change-score computation (newlyCreatedGroupTreatments operates over ALL merged groups, not just selected ones). */
  mergedGroups: MergedStoryGroup[];
};

type RankedCandidate = {
  group: MergedStoryGroup;
  treatment: Treatment;
  carryForwardState: CarryForwardState | null;
  priority: number;
};

function storyFamily(story: Pick<BroadcastStory, "storyType">) {
  return familyForStoryType(story.storyType as StoryType);
}

function rankCandidates(merged: readonly MergedStoryGroup[], previousProgramme: EditionProgramme | null): RankedCandidate[] {
  const previousSegmentByStoryId = new Map<number, ProgrammeSegment>();
  if (previousProgramme) {
    for (const seg of previousProgramme.segments) {
      if (seg.storyId !== null) previousSegmentByStoryId.set(seg.storyId, seg);
      for (const id of seg.supportingStoryIds) previousSegmentByStoryId.set(id, seg);
    }
  }

  const ranked = merged.map((group): RankedCandidate => {
    const previousSegment = previousSegmentByStoryId.get(group.primary.id) ?? null;
    const carryForwardState = classifyCarryForward({
      wasFeaturedInPreviousEdition: previousSegment !== null,
      currentLifecycle: group.primary.lifecycle,
    });
    const alreadyGivenResolutionSegment = previousSegment?.lifecycleAtBroadcast === "RESOLVED";
    const treatment = treatmentForScore(group.primary.score);
    const priority = fullSegmentPriority({ baseScore: group.primary.score, carryForwardState, alreadyGivenResolutionSegment });
    return { group, treatment, carryForwardState, priority };
  });

  return ranked
    .filter(c => c.priority > -Infinity) // STALE / already-spent RESOLVED groups excluded outright
    .sort((a, b) => b.priority - a.priority || b.group.primary.score - a.group.primary.score || a.group.primary.id - b.group.primary.id);
}

type SlotFillContext = {
  used: Set<string>;
  fullSegmentsPerSubject: Map<string, number>;
  secondsPerLeague: Map<string, number>;
  totalFullSegmentSeconds: { value: number };
  /** See isWithinLeagueAirtimeCap's own comment (director-math.ts): true when
   * every candidate in the whole ranked pool belongs to the same league, in
   * which case the 55% airtime cap has nothing to balance against and must
   * not apply — otherwise a single-league club's entire Edition would be
   * capped at one full segment regardless of how many real stories exist. */
  onlyLeagueWithContent: boolean;
};

function newContext(onlyLeagueWithContent: boolean): SlotFillContext {
  return { used: new Set(), fullSegmentsPerSubject: new Map(), secondsPerLeague: new Map(), totalFullSegmentSeconds: { value: 0 }, onlyLeagueWithContent };
}

function pickForSlot(candidates: readonly RankedCandidate[], filter: (c: RankedCandidate) => boolean, ctx: SlotFillContext): RankedCandidate | null {
  for (const candidate of candidates) {
    if (ctx.used.has(candidate.group.groupKey)) continue;
    if (!filter(candidate)) continue;

    const subjectCounts = candidate.group.primary.subjectKeys.map(k => ctx.fullSegmentsPerSubject.get(k) ?? 0);
    const maxSubjectCount = subjectCounts.length > 0 ? Math.max(...subjectCounts) : 0;
    if (!isWithinSubjectExposureCap({ fullSegmentsAlreadyGivenToThisSubjectThisEdition: maxSubjectCount, candidateTreatment: candidate.treatment })) continue;

    const candidateSeconds = ESTIMATED_SECONDS_BY_TREATMENT[candidate.treatment];
    const leagueSecondsSoFar = ctx.secondsPerLeague.get(candidate.group.primary.leagueType) ?? 0;
    if (!isWithinLeagueAirtimeCap({ candidateTreatment: candidate.treatment, candidateSeconds, thisLeagueSecondsSoFar: leagueSecondsSoFar, totalFullSegmentSecondsSoFar: ctx.totalFullSegmentSeconds.value, onlyLeagueWithContent: ctx.onlyLeagueWithContent })) continue;

    return candidate;
  }
  return null;
}

function commit(candidate: RankedCandidate, ctx: SlotFillContext): void {
  ctx.used.add(candidate.group.groupKey);
  for (const key of candidate.group.primary.subjectKeys) {
    ctx.fullSegmentsPerSubject.set(key, (ctx.fullSegmentsPerSubject.get(key) ?? 0) + 1);
  }
  const seconds = ESTIMATED_SECONDS_BY_TREATMENT[candidate.treatment];
  ctx.secondsPerLeague.set(candidate.group.primary.leagueType, (ctx.secondsPerLeague.get(candidate.group.primary.leagueType) ?? 0) + seconds);
  ctx.totalFullSegmentSeconds.value += seconds;
}

const LEAGUE_TYPES = ["singles", "doubles", "shift_wars"] as const;

/**
 * Fills the 10-slot NORMAL_RUNNING_ORDER_TEMPLATE (11.1) from an
 * already-gathered story pool, applying 9.6 merging, 10.1-adjacent
 * priority ranking, 10.4 exposure caps and 11.2 carry-forward eligibility
 * along the way. Synchronous and side-effect-free — see this file's own
 * header for why, despite the "DB-facing" naming convention it follows.
 */
export function directorSelect(params: {
  pool: readonly BroadcastStory[];
  /** The immediately preceding PUBLISHED Edition's programme, or null if none exists yet (first-ever Edition) — used only for 11.2 carry-forward classification. */
  previousProgramme: EditionProgramme | null;
}): DirectorResult {
  const merged = mergeStoriesByAnchorAndNarrative(params.pool);
  const ranked = rankCandidates(merged, params.previousProgramme);
  const distinctLeagues = new Set(ranked.map(c => c.group.primary.leagueType));
  const ctx = newContext(distinctLeagues.size <= 1);
  const entries: RunningOrderEntry[] = [];

  function place(slot: number, purpose: RunningOrderSlotPurpose, pick: RankedCandidate | null): void {
    if (!pick) return;
    commit(pick, ctx);
    entries.push({ slot, purpose, group: pick.group, treatment: pick.treatment, carryForwardState: pick.carryForwardState });
  }

  // Slot 2 — main_story: the single highest-priority candidate, unfiltered.
  const mainPick = pickForSlot(ranked, () => true, ctx);
  place(2, "main_story", mainPick);

  // Slot 3 — second_major_story: a different league first; a same-league
  // Major story only if no different-league candidate is available.
  const mainLeague = mainPick?.group.primary.leagueType ?? null;
  const secondPick =
    pickForSlot(ranked, c => c.group.primary.leagueType !== mainLeague, ctx) ??
    pickForSlot(ranked, c => c.treatment === "major", ctx);
  place(3, "second_major_story", secondPick);

  // Slot 4 — analysis_or_predictor: the LEAGUE family (Title Predictor's own domain).
  const analysisPick = pickForSlot(ranked, c => storyFamily(c.group.primary) === "LEAGUE", ctx);
  place(4, "analysis_or_predictor", analysisPick);

  // Slot 5 — supporting_story_or_checkin: best remaining candidate, unfiltered.
  const supportingPick = pickForSlot(ranked, () => true, ctx);
  place(5, "supporting_story_or_checkin", supportingPick);

  // Slot 6 — form_h2h_or_spotlight: FORM ∪ H2H ∪ PERFORMANCE.
  const formPick = pickForSlot(ranked, c => {
    const family = storyFamily(c.group.primary);
    return family === "FORM" || family === "H2H" || family === "PERFORMANCE";
  }, ctx);
  place(6, "form_h2h_or_spotlight", formPick);

  // Slot 7 — third_league_current_state: only "if needed" — a league not
  // yet represented in slots 2-6, and only if a real candidate exists.
  const leaguesSoFar = new Set(entries.filter(e => e.group !== null).map(e => e.group!.primary.leagueType));
  let thirdLeaguePick: RankedCandidate | null = null;
  for (const league of LEAGUE_TYPES) {
    if (leaguesSoFar.has(league)) continue;
    thirdLeaguePick = pickForSlot(ranked, c => c.group.primary.leagueType === league, ctx);
    if (thirdLeaguePick) break;
  }
  place(7, "third_league_current_state", thirdLeaguePick);

  // Slot 8 — lighter_or_archive_or_callback: ARCHIVE family preferred, else
  // whatever's next-best so real remaining content isn't left unused.
  const lighterPick =
    pickForSlot(ranked, c => storyFamily(c.group.primary) === "ARCHIVE", ctx) ??
    pickForSlot(ranked, () => true, ctx);
  place(8, "lighter_or_archive_or_callback", lighterPick);

  // Slot 1 — opening_headlines: a brief tease of up to 3 of the stories
  // ALREADY placed above (highest score first) — never new content of its
  // own, and exempt from the exposure/airtime tallies above (10.4's caps
  // are explicitly about "full-segment time," and a headline tease isn't a
  // full segment — see 9.3's own separate headline_ticker treatment tier).
  const headlineSources = entries
    .filter(e => e.group !== null)
    .slice()
    .sort((a, b) => b.group!.primary.score - a.group!.primary.score)
    .slice(0, 3);
  const headlineEntries: RunningOrderEntry[] = headlineSources.map(e => ({
    slot: 1, purpose: "opening_headlines", group: e.group, treatment: "headline_ticker", carryForwardState: e.carryForwardState,
  }));

  // Slot 9 — what_to_watch (required): an unresolved LEAGUE-family
  // question. Prefer a not-yet-used LEAGUE candidate; failing that,
  // legitimately re-reference the best LEAGUE candidate already placed
  // elsewhere (recapping the open question is real content, not
  // duplication, since it airs in a structurally different slot). If the
  // ENTIRE pool has no LEAGUE-family story at all — realistically only
  // possible in the first few days of a brand-new season, before any
  // standings-based story has ever been detected — this slot is left with
  // no group; edition-engine.ts's quality gate (MIN_MEANINGFUL_SEGMENTS)
  // is what correctly holds back publishing an Edition that thin, rather
  // than this file inventing a question from data it was never given.
  const unusedLeaguePick = pickForSlot(ranked, c => storyFamily(c.group.primary) === "LEAGUE", ctx);
  let whatToWatchEntry: RunningOrderEntry;
  if (unusedLeaguePick) {
    commit(unusedLeaguePick, ctx);
    whatToWatchEntry = { slot: 9, purpose: "what_to_watch", group: unusedLeaguePick.group, treatment: unusedLeaguePick.treatment, carryForwardState: unusedLeaguePick.carryForwardState };
  } else {
    const bestLeagueOverall = ranked.find(c => storyFamily(c.group.primary) === "LEAGUE") ?? null;
    whatToWatchEntry = bestLeagueOverall
      ? { slot: 9, purpose: "what_to_watch", group: bestLeagueOverall.group, treatment: bestLeagueOverall.treatment, carryForwardState: bestLeagueOverall.carryForwardState }
      : { slot: 9, purpose: "what_to_watch", group: null, treatment: "utility", carryForwardState: null };
  }

  // Slot 10 — closing: a short sign-off, no story of its own.
  const closingEntry: RunningOrderEntry = { slot: 10, purpose: "closing", group: null, treatment: "utility", carryForwardState: null };

  // Order here is BUILD order, not display order — edition-engine.ts renders
  // each entry's dialogue (and records its phrase usage into broadcast_memory)
  // in this exact sequence, then routes/broadcast.ts re-partitions the result
  // by `purpose` for display (headlines vs. body), which doesn't care where
  // in this array a headline entry sat. That distinction matters here because
  // a headline tease is, by 9.3's own design, a re-use of a story ALREADY
  // placed in a full slot above (or slot 9's own "recap" fallback re-uses one
  // too) — both reuse the exact same QUICK_HIT phrase pool a full Supporting
  // segment for that same story/subject would need. A story type with few
  // phrases per intent (CHAMPION has exactly one) has nothing left once the
  // first use records that phrase's cooldown, so whichever of the two renders
  // SECOND in build order gets an empty, dropped segment — silently thinning
  // the Edition despite the pool having plenty of other real content. Full
  // segments are the substantial content a viewer actually came for; teases
  // and recaps are optional garnish on content that (in the tease's case)
  // gets its own real segment moments later anyway — so full segments render
  // first and claim the phrase pool, with headline teases last so a cooldown
  // collision costs only the tease, never the segment it was teasing.
  return {
    runningOrder: [...entries, whatToWatchEntry, ...headlineEntries, closingEntry],
    mergedGroups: merged,
  };
}
