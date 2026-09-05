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
// single highest-priority remaining candidate is, no family filter beyond
// one exclusion — see isFlashbackFamily's own comment below for why ARCHIVE/
// FILLER content never fills these two slots — that's otherwise literally
// what "highest valid Main Story" and "supporting story" mean.
// Slot 3 ("different league / second major story") prefers a candidate from
// a DIFFERENT league than slot 2's; failing that, only a genuine Major
// story is allowed to double up on the same league (a second Major result
// is worth a segment regardless of league; a second Featured/Supporting one
// from the same league is exactly the kind of repetition 10.4 exists to
// prevent) — same flashback exclusion as slots 2/5. Slot 4 ("Analysis /
// Title Predictor if materially useful") maps directly to the LEAGUE
// family — the only family whose stories are ever Title-Predictor-driven —
// with "if materially useful" already enforced by the Story Engine's own
// detection thresholds (a LEAGUE story that didn't clear its own
// materiality bar was never detected at all, so any candidate reaching
// this pool by definition already cleared it). Slot 6 ("Form, H2H, stats
// or spotlight") maps to FORM ∪ H2H ∪ PERFORMANCE — the three families
// whose whole subject IS individual form/stats, PERFORMANCE included since
// match-level scoring/checkout numbers are exactly "stats." Slot 7
// ("third-league current state if needed") only fires when a third
// leagueType genuinely hasn't appeared in slots 2-6 yet AND a real,
// non-flashback candidate exists for it — "if needed" means exactly that,
// not "always," and "current state" means exactly that too. Slot 8
// ("lighter/archive/presenter callback") prefers the ARCHIVE family
// specifically (LAST_MEETING/SEASON_COMPARISON/HISTORICAL_H2H are
// definitionally the "lighter" evergreen-context stories — see their own
// detectors' own components, which deliberately score modestly), falling
// back to whatever's next-best (including FILLER) rather than leaving real
// content unused — this is the ONE slot ARCHIVE/FILLER content is allowed
// to fill, by design (see isFlashbackFamily's own comment).
import { isFreshResultEventForNews, treatmentForScore } from "./story-engine-math.ts";
import { familyForStoryType, type StoryType, type Treatment } from "./story-types.ts";
import {
  mergeStoriesByAnchorAndNarrative, classifyCarryForward,
  fullSegmentPriority, isWithinSubjectExposureCap, isWithinLeagueAirtimeCap, applyVarietyShuffle,
  type MergedStoryGroup, type CarryForwardState, type RunningOrderSlotPurpose,
  type EditionProgramme, type ProgrammeSegment, type ProgrammeMode, type OrdinaryProgrammeMode,
  PROGRAMME_PACING_RULES,
} from "./director-math.ts";
import { seededRng } from "./seeded-rng.ts";
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

/**
 * Select the v2 editorial mode from real story activity rather than the
 * scheduled clock slot. A quiet day becomes a deliberate Magazine Edition,
 * never a weak News Edition padded with routine material.
 *
 * Season Review has higher-level season-boundary context and is selected by
 * edition-engine before this resolver is called.
 */
export function selectProgrammeMode(
  pool: readonly BroadcastStory[],
  editorialCutoff?: Date,
): Exclude<ProgrammeMode, "SEASON_REVIEW"> {
  const referenceTime = editorialCutoff ?? new Date(pool.reduce(
    (latest, story) => Math.max(latest, story.updatedAt.getTime(), story.detectedAt.getTime()),
    0,
  ));
  // Count editorial storylines, not detector rows: REVENGE + FIRST_H2H_WIN
  // about one match is one piece of news, not two independent reasons to
  // declare a busy News Edition.
  const competitiveGroups = mergeStoriesByAnchorAndNarrative(pool);
  const freshCompetitive = competitiveGroups.filter(group => {
    const stories = [group.primary, ...group.supporting];
    return stories.some(story => {
      if (story.lifecycle !== "NEW" && story.lifecycle !== "HOT") return false;
      const family = storyFamily(story);
      const isMatchResult = family === "RESULT" || (family === "DOUBLES" && story.anchorMatchId !== null);
      if (isMatchResult) return isFreshResultEventForNews(story.facts.playedAt, referenceTime);
      return family === "LEAGUE" || family === "DOUBLES" || family === "SHIFT_WARS";
    });
  }).map(group => group.primary);

  // Use the Show Bible's treatment scale rather than an unrelated 65/90
  // scale. Two fresh competitive stories strong enough for the headline
  // ticker make a genuinely busy news board; one Supporting-or-better story
  // is substantial enough to lead a News Edition on its own.
  const broadcastWorthy = freshCompetitive.filter(story => treatmentForScore(story.score) !== "archive");
  const hasStrongLead = freshCompetitive.some(story => {
    const treatment = treatmentForScore(story.score);
    return treatment === "supporting" || treatment === "featured" || treatment === "major";
  });
  if (broadcastWorthy.length >= 2 || hasStrongLead) {
    return "NEWS";
  }

  const meaningfulCompetitive = pool.some(story => {
    if (story.lifecycle !== "NEW" && story.lifecycle !== "HOT") return false;
    const family = storyFamily(story);
    const isMatchResult = family === "RESULT" || (family === "DOUBLES" && story.anchorMatchId !== null);
    if (isMatchResult) return isFreshResultEventForNews(story.facts.playedAt, referenceTime);
    return family === "LEAGUE" || family === "FORM" || family === "PERFORMANCE"
      || family === "DOUBLES" || family === "SHIFT_WARS";
  });

  return meaningfulCompetitive ? "BALANCED" : "MAGAZINE";
}

// ── The "clump of all seasons, doesn't flow" fix ──────────────────────────
// A real user report traced a catch-up-style Edition reading as an
// incoherent jumble of old material back to two families that this file's
// own header already earmarks as slot 8's own deliberate content — ARCHIVE
// (LAST_MEETING/SEASON_COMPARISON/HISTORICAL_H2H — "definitionally the
// 'lighter' evergreen-context stories") and FILLER (story-types.ts's own
// header: "content this show can air when there isn't enough real
// news"... "director.ts's slot 8 for how a stale FILLER story earns
// priority so 'every so often' is actually enforced") — but every OTHER
// slot's own "whatever's next-best" fallback (slots 2, 3's second attempt,
// 5, and 7's per-league filter) was unfiltered by family, so in a genuinely
// quiet period (off-season, or an admin-forced regenerate with little fresh
// match data) MULTIPLE slots could each independently fall back onto
// ARCHIVE/FILLER content — several different old stories, none of them
// framed as a look-back, all standing in as if they were today's actual
// headline, main story, AND supporting story at once. Confining these two
// families to slot 8 (their one clearly-a-callback home) means a quiet
// period now correctly leaves slots 2/3/5/7 empty rather than dressed up
// as current news — and an Edition left too thin by that is exactly what
// edition-engine.ts's own MIN_MEANINGFUL_SEGMENTS gate exists to hold back
// from publishing (11.6's "drop rather than publish broken or empty
// content"), not a new failure mode this introduces.
function isFlashbackFamily(story: Pick<BroadcastStory, "storyType">): boolean {
  const family = storyFamily(story);
  return family === "ARCHIVE" || family === "FILLER";
}

function rankCandidates(merged: readonly MergedStoryGroup[], previousProgramme: EditionProgramme | null, slotKey: string): RankedCandidate[] {
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

  const sorted = ranked
    .filter(c => c.priority > -Infinity) // STALE / already-spent RESOLVED groups excluded outright
    .sort((a, b) => b.priority - a.priority || b.group.primary.score - a.group.primary.score || a.group.primary.id - b.group.primary.id);

  // 10.5 variety: reorder only WITHIN a tied priority+score band (see
  // director-math.ts's own header on applyVarietyShuffle) — the sort above
  // already guarantees a higher-priority/higher-score candidate always sorts
  // first, so this can only change which of several EQUALLY-good candidates
  // gets first pick of a slot, never which one is best.
  return applyVarietyShuffle(sorted, c => ({ priority: c.priority, score: c.group.primary.score }), seededRng(slotKey, "variety:rank-candidates"));
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
 * Fills the 11-slot NORMAL_RUNNING_ORDER_TEMPLATE (11.1) from an
 * already-gathered story pool, applying 9.6 merging, 10.1-adjacent
 * priority ranking, 10.4 exposure caps and 11.2 carry-forward eligibility
 * along the way. Synchronous and side-effect-free — see this file's own
 * header for why, despite the "DB-facing" naming convention it follows.
 */
export function directorSelect(params: {
  pool: readonly BroadcastStory[];
  mode: OrdinaryProgrammeMode;
  /** The immediately preceding PUBLISHED Edition's programme, or null if none exists yet (first-ever Edition) — used only for 11.2 carry-forward classification. */
  previousProgramme: EditionProgramme | null;
  pacing?: import("./director-math.ts").ProgrammePacingRule;
  /** Seeds 10.5's variety shuffle among tied candidates — same per-Edition seeded-RNG contract (seeded-rng.ts) as every other seeded choice in this codebase (e.g. commentaryRng): same slotKey -> the same shuffle, every viewer, every rebuild of that exact slot. */
  slotKey: string;
}): DirectorResult {
  const merged = mergeStoriesByAnchorAndNarrative(params.pool);
  const ranked = rankCandidates(merged, params.previousProgramme, params.slotKey);
  const distinctLeagues = new Set(ranked.map(c => c.group.primary.leagueType));
  const ctx = newContext(distinctLeagues.size <= 1);
  const entries: RunningOrderEntry[] = [];
  const pacing = params.pacing ?? PROGRAMME_PACING_RULES[params.mode];

  function place(slot: number, purpose: RunningOrderSlotPurpose, pick: RankedCandidate | null): void {
    if (!pick) return;
    commit(pick, ctx);
    entries.push({ slot, purpose, group: pick.group, treatment: pick.treatment, carryForwardState: pick.carryForwardState });
  }

  // Slot 3 — main_story: the single highest-priority candidate — unfiltered
  // by anything else, but never a flashback (see isFlashbackFamily's own
  // comment): the "main story" slot claiming an old champion or a filler
  // promo as today's top headline is exactly the bug this exists to avoid.
  const isFreshResult = (c: RankedCandidate) =>
    storyFamily(c.group.primary) === "RESULT"
    && (c.group.primary.lifecycle === "NEW" || c.group.primary.lifecycle === "HOT");
  const isFeaturePremise = (c: RankedCandidate) => {
    const family = storyFamily(c.group.primary);
    return family === "FILLER" || family === "ARCHIVE" || family === "H2H" || family === "PERFORMANCE";
  };
  const mainPick = params.mode === "NEWS"
    ? pickForSlot(ranked, isFreshResult, ctx) ?? pickForSlot(ranked, c => !isFlashbackFamily(c.group.primary), ctx)
    : params.mode === "MAGAZINE"
      ? pickForSlot(ranked, isFeaturePremise, ctx) ?? pickForSlot(ranked, () => true, ctx)
      : pickForSlot(ranked, c => !isFlashbackFamily(c.group.primary), ctx);
  place(3, "main_story", mainPick);

  // Slot 4 — second_major_story: a different league first; a same-league
  // Major story only if no different-league candidate is available. A
  // flashback story can't reach "major" treatment in practice (ARCHIVE/
  // FILLER detectors deliberately score modestly — see their own
  // components), but the filter is applied for the same reason slot 3's is:
  // this slot's OWN name promises a second real story, not a callback.
  const mainLeague = mainPick?.group.primary.leagueType ?? null;
  const secondPick =
    pickForSlot(ranked, c => c.group.primary.leagueType !== mainLeague && !isFlashbackFamily(c.group.primary), ctx) ??
    pickForSlot(ranked, c => c.treatment === "major" && !isFlashbackFamily(c.group.primary), ctx);
  place(4, "second_major_story", secondPick);

  // Slot 5 — analysis_or_predictor: the LEAGUE family (Title Predictor's own domain).
  const analysisPick = pickForSlot(ranked, c => storyFamily(c.group.primary) === "LEAGUE", ctx);
  place(5, "analysis_or_predictor", analysisPick);

  // Slot 6 — supporting_story_or_checkin: best remaining candidate — same
  // flashback exclusion as slot 3. Without this, a quiet period could give
  // slot 9 ONE archive/filler story and slot 6 a completely different one,
  // which is the literal "clump of all seasons" a real user report named:
  // two callback-shaped segments airing back to back, neither one framed
  // as a look-back.
  const supportingPick = pickForSlot(ranked, c => !isFlashbackFamily(c.group.primary), ctx);
  place(6, "supporting_story_or_checkin", supportingPick);

  // Slot 7 — form_h2h_or_spotlight: FORM ∪ H2H ∪ PERFORMANCE.
  const formPick = pickForSlot(ranked, c => {
    const family = storyFamily(c.group.primary);
    return family === "FORM" || family === "H2H" || family === "PERFORMANCE";
  }, ctx);
  place(7, "form_h2h_or_spotlight", formPick);

  // Slot 8 — third_league_current_state: only "if needed" — a league not
  // yet represented in slots 3-7, and only if a real candidate exists. The
  // slot's own purpose name says "current state" — a flashback story here
  // would misrepresent old news as that league's current state, so this
  // excludes the same two families slots 3/4/6 do.
  const leaguesSoFar = new Set(entries.filter(e => e.group !== null).map(e => e.group!.primary.leagueType));
  let thirdLeaguePick: RankedCandidate | null = null;
  for (const league of LEAGUE_TYPES) {
    if (leaguesSoFar.has(league)) continue;
    thirdLeaguePick = pickForSlot(ranked, c => c.group.primary.leagueType === league && !isFlashbackFamily(c.group.primary), ctx);
    if (thirdLeaguePick) break;
  }
  place(8, "third_league_current_state", thirdLeaguePick);

  // Slot 9 — lighter_or_archive_or_callback: ARCHIVE family preferred, else
  // whatever's next-best so real remaining content isn't left unused.
  const lighterPick =
    pickForSlot(ranked, c => storyFamily(c.group.primary) === "ARCHIVE", ctx) ??
    pickForSlot(ranked, () => true, ctx);
  place(9, "lighter_or_archive_or_callback", lighterPick);

  // Sequence each mode's selected stories against its configured editorial
  // mix. Preserve every selected story and purpose; the mix only changes the
  // order in which news, analysis, and feature beats play.
  const beatFor = (entry: RunningOrderEntry): "news" | "analysis" | "feature" => {
    const family = storyFamily(entry.group!.primary);
    if (family === "RESULT") return "news";
    if (family === "LEAGUE" || family === "FORM") return "analysis";
    return "feature";
  };
  const remaining = [...entries];
  const sequenced: RunningOrderEntry[] = [];
  for (const beat of pacing.contentMix) {
    const index = remaining.findIndex(entry => beatFor(entry) === beat);
    if (index >= 0) sequenced.push(remaining.splice(index, 1)[0]);
  }
  entries.splice(0, entries.length, ...sequenced, ...remaining);

  // ── Quiet-Edition backfill ────────────────────────────────────────────
  // Show Bible v1 §1's own Quiet Edition row: "Calmer; archive, spotlight,
  // table state, predictor if useful" — several calmer beats, not the
  // single one 11.1's template names. On a genuinely quiet month, slots
  // 4/6/7/8 all correctly come back empty (isFlashbackFamily's own header,
  // above, excludes ARCHIVE/FILLER from claiming them), which made slot 9
  // the ONLY way any of FILLER's real, always-available content
  // (SHADOW_BOT_PROMO, FEATURE_SPOTLIGHT, PRACTICE_ACTIVITY) could ever
  // reach a segment — real content the pool already has sat unused rather
  // than being spent. That was fine while evaluateQualityGate's
  // MIN_MEANINGFUL_SEGMENTS counted raw segment count (the fixed opening/
  // closing/what-to-watch-fallback padded a thin Edition over the bar on
  // their own) — but now that it counts only story-backed segments
  // (director-math.ts's own header on that change, made specifically so a
  // day with nothing real couldn't dress itself up as a full show), a
  // genuinely quiet month capped at ONE lighter segment plus maybe one
  // LEAGUE story can fall short of 4 real segments and get held back
  // entirely — repeating a stale Edition, which reads as "the show has
  // gone bare/stuck" to a viewer, exactly the real report that prompted
  // this fix.
  //
  // This first version of the fix let the bonus loop pull from EITHER
  // ARCHIVE or FILLER (isFlashbackFamily's own union) — which put a
  // second and third ARCHIVE story into the same Edition. ARCHIVE
  // (LAST_MEETING/HISTORICAL_H2H/SEASON_COMPARISON) is, unlike FILLER,
  // never about the present: each candidate names a DIFFERENT old
  // season/pairing on its own terms, so airing several of them back to
  // back doesn't read as "a few calmer beats" the way several FILLER
  // beats do — it reads as several unrelated old seasons stitched into
  // one channel, which is the exact "clump of all seasons" shape slot 6's
  // own comment above names as the original real bug report this whole
  // single-slot confinement was built to prevent, and it's what a live
  // viewer flagged the moment this shipped. FILLER's three detectors, by
  // contrast, are ALL present-tense (a live feature promo, a live
  // spotlight registry row, a live practice-mode plug — see
  // story-detectors-filler.ts) — several of THOSE in one Edition is
  // exactly the Quiet Edition's "archive, spotlight, ..." row read
  // plurally, with no old-season content involved at all. So the bonus
  // loop below is FILLER-only: slot 9's own pick above still gets first
  // claim on the ONE ARCHIVE story an Edition may ever carry (unchanged
  // from before this fix), and only the leftover FILLER pool backs a
  // thin Edition up further — never a second old season. Mirrors slot 2's
  // headline entries' own "many entries, one purpose" shape (same slot
  // number and purpose, one segment each) and is capped so it can never
  // turn a single quiet story into a padded-out show pretending to be busy.
  const MIN_REAL_ENTRIES_BEFORE_BACKFILL = 4;
  const MAX_BONUS_LIGHTER_ENTRIES = 3;
  for (let bonusCount = 0; entries.length < MIN_REAL_ENTRIES_BEFORE_BACKFILL && bonusCount < MAX_BONUS_LIGHTER_ENTRIES; bonusCount++) {
    const bonusLighterPick = pickForSlot(ranked, c => storyFamily(c.group.primary) === "FILLER", ctx);
    if (!bonusLighterPick) break;
    place(9, "lighter_or_archive_or_callback", bonusLighterPick);
  }

  // Slot 1 — opening: a fixed ~20-30s desk sign-on with no story of its own
  // (Show Bible v1 section 4/5 — "explain why this Edition matters," not a
  // templated claim about any specific story, so it carries no group and
  // never counts against the exposure/airtime tallies above). edition-
  // engine.ts renders it from a small fixed line pool exactly like slot 11's
  // closing sign-off.
  const openingEntry: RunningOrderEntry = { slot: 1, purpose: "opening", group: null, treatment: "utility", carryForwardState: null };

  // Slot 2 — headlines: a brief tease of up to 3 of the stories
  // ALREADY placed above (highest score first) — never new content of its
  // own, and exempt from the exposure/airtime tallies above (10.4's caps
  // are explicitly about "full-segment time," and a headline tease isn't a
  // full segment — see 9.3's own separate headline_ticker treatment tier).
  const storyEntries = entries.slice(0, pacing.maxStorySegments);
  const headlineSources = storyEntries
    .filter(e => e.group !== null)
    .slice()
    .sort((a, b) => b.group!.primary.score - a.group!.primary.score)
    .slice(0, pacing.maxHeadlineTeases);
  const headlineEntries: RunningOrderEntry[] = headlineSources.map(e => ({
    slot: 2, purpose: "headlines", group: e.group, treatment: "headline_ticker", carryForwardState: e.carryForwardState,
  }));

  // Slot 10 — what_to_watch (required): an UNRESOLVED LEAGUE-family
  // question — something a viewer would actually keep watching for. Prefer
  // a not-yet-used LEAGUE candidate; failing that, legitimately re-reference
  // the best LEAGUE candidate already placed elsewhere (recapping the open
  // question is real content, not duplication, since it airs in a
  // structurally different slot). If the ENTIRE pool has no LEAGUE-family
  // story at all — realistically only possible in the first few days of a
  // brand-new season, before any standings-based story has ever been
  // detected — this slot is left with no group; edition-engine.ts's quality
  // gate (MIN_MEANINGFUL_SEGMENTS) is what correctly holds back publishing
  // an Edition that thin, rather than this file inventing a question from
  // data it was never given.
  //
  // CHAMPION and SEASON_RECAP are LEAGUE-family but are the opposite of an
  // open question — the season is OVER, there is nothing left to watch for.
  // A real user report named the exact symptom this caused: the champion
  // being mentioned "multiple times" in one Edition. Root cause, confirmed
  // against a real captured Edition (id 3, 4 Sep): CHAMPION legitimately won
  // an earlier slot (analysis_or_predictor, still a LEAGUE story), then —
  // because no OTHER open LEAGUE question existed this quiet week —
  // unusedLeaguePick came back empty and the old fallback below picked
  // "the best LEAGUE candidate overall" with no exclusion at all, landing
  // on that same already-used CHAMPION story a second time (on top of its
  // own headline tease, a third appearance). Excluding closed-matter types
  // from BOTH branches here — not just the reuse fallback — closes this for
  // good: a freshly-picked what_to_watch could hit the same trap on its
  // first use if CHAMPION were the only unused LEAGUE story left.
  const CLOSED_LEAGUE_MATTER_TYPES = new Set<StoryType>(["CHAMPION", "SEASON_RECAP"]);
  const isOpenLeagueQuestion = (c: RankedCandidate) =>
    storyFamily(c.group.primary) === "LEAGUE" && !CLOSED_LEAGUE_MATTER_TYPES.has(c.group.primary.storyType as StoryType);
  // what_to_watch is a story-backed body segment whenever it carries a
  // group, so it shares the same configured story-segment budget as slots
  // 3-9 rather than silently exceeding the producer's cap.
  const storyBudgetRemaining = storyEntries.length < pacing.maxStorySegments;
  const unusedLeaguePick = storyBudgetRemaining ? pickForSlot(ranked, isOpenLeagueQuestion, ctx) : null;
  let whatToWatchEntry: RunningOrderEntry;
  if (unusedLeaguePick) {
    commit(unusedLeaguePick, ctx);
    whatToWatchEntry = { slot: 10, purpose: "what_to_watch", group: unusedLeaguePick.group, treatment: unusedLeaguePick.treatment, carryForwardState: unusedLeaguePick.carryForwardState };
  } else {
    const bestLeagueOverall = storyBudgetRemaining ? (ranked.find(isOpenLeagueQuestion) ?? null) : null;
    whatToWatchEntry = bestLeagueOverall
      ? { slot: 10, purpose: "what_to_watch", group: bestLeagueOverall.group, treatment: bestLeagueOverall.treatment, carryForwardState: bestLeagueOverall.carryForwardState }
      : { slot: 10, purpose: "what_to_watch", group: null, treatment: "utility", carryForwardState: null };
  }

  // Slot 11 — closing: a short sign-off — still no SEGMENT of its own (this
  // entry's own `group` never gets a commit() call, never counts against
  // 10.4's exposure/airtime caps, and edition-engine.ts keeps the resulting
  // segment's storyId/storyType/leagueType/facts all null exactly as
  // before). What CAN change, direct response to player feedback wanting
  // the show to feel like something worth coming back for rather than "a
  // constant same episode loop": when a genuinely forward-looking storyline
  // is still live — the same LEAGUE story already driving slot 10's "what to
  // watch" recap, or (failing that) the best still-open win/loss streak in
  // the pool — attach it here too, so edition-engine.ts's own closing-tease-
  // math.ts can flavor the sign-off with a real, fact-checked tease
  // ("keep an eye on the title race...") instead of always repeating the
  // same handful of fixed lines. This is presenter narration ABOUT a story
  // already given its own real segment elsewhere, not a second segment
  // about it — see edition-engine.ts's own header on buildClosingSegment.
  const streakTeaseCandidate = ranked.find(c => c.group.primary.storyType === "WIN_STREAK" || c.group.primary.storyType === "LOSS_STREAK") ?? null;
  const closingTeaseGroup = whatToWatchEntry.group ?? streakTeaseCandidate?.group ?? null;
  const closingEntry: RunningOrderEntry = { slot: 11, purpose: "closing", group: closingTeaseGroup, treatment: "utility", carryForwardState: null };

  // Order here is BUILD order, not display order — edition-engine.ts renders
  // each entry's dialogue (and records its phrase usage into broadcast_memory)
  // in this exact sequence, then routes/broadcast.ts re-partitions the result
  // by `purpose` for display (headlines vs. body), which doesn't care where
  // in this array a headline entry sat. That distinction matters here because
  // a headline tease is, by 9.3's own design, a re-use of a story ALREADY
  // placed in a full slot above (or slot 10's own "recap" fallback re-uses one
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
    runningOrder: [openingEntry, ...storyEntries, whatToWatchEntry, ...headlineEntries, closingEntry],
    mergedGroups: merged,
  };
}
