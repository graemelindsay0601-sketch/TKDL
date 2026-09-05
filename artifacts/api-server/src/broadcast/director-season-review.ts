// TKDL LIVE — Season Review: the dedicated multi-segment special edition
// built when one or more leagues' seasons close. Real user feedback named
// the gap precisely: CHAMPION (one segment) and SEASON_RECAP (one
// aggregate-stats segment — director.ts's own recent addition) together
// still read as "just a 2 min show... not covering all the topics or any
// of the matches from the league at all." Neither one is an actual match
// or storyline FROM the season; this file is what actually builds a
// retrospective around real ones.
//
// Structurally separate from directorSelect()'s NORMAL_RUNNING_ORDER_
// TEMPLATE (director.ts/director-math.ts) rather than a bigger version of
// the same 11 slots — a real look-back needs several highlight-shaped
// slots, which the normal template deliberately never allows (its own
// "clump of all seasons" fix confines ARCHIVE/FILLER to exactly one slot
// for good reason — see director.ts's isFlashbackFamily comment). This
// file owns none of that machinery; it builds its own running order from
// scratch and hands it to edition-engine.ts's buildEdition(), which
// renders every entry through the exact same buildSegmentForEntry pipeline
// a normal Edition uses — same commentary engine, same phrase library,
// same graphic-building. This file's only real job is selecting WHICH real
// stories fill the running order and in what shape.
import { treatmentForScore } from "./story-engine-math.ts";
import { familyForStoryType, type StoryType } from "./story-types.ts";
import type { MergedStoryGroup, RunningOrderSlotPurpose } from "./director-math.ts";
import type { RunningOrderEntry } from "./director.ts";
import type { ClosedLeagueSeason } from "./story-engine.ts";
import type { BroadcastStory, LeagueType } from "@workspace/db/schema";

/** Per closed league — enough real storylines to feel like an actual retrospective without one league's history swallowing the whole special. Raised from an earlier 4: a real user report ("2/3 [segments] is nowhere near what I wanted") named both this cap and the missing open-league coverage below as too thin for what "dedicated multi-segment special" was meant to mean. story-engine.ts's own per-subject diversity cap (collectSeasonHighlights) still prevents one dominant player from filling every extra slot this opens up. */
const MAX_HIGHLIGHTS_PER_LEAGUE = 6;

/** Every league this show runs — not imported from @workspace/db/schema's own LEAGUE_TYPES, matching director.ts's own local copy (its own header: zero @workspace/db RUNTIME imports, this file's LeagueType is a type-only import already). */
const ALL_LEAGUE_TYPES: readonly LeagueType[] = ["singles", "doubles", "shift_wars"];

function storyFamily(story: Pick<BroadcastStory, "storyType">) {
  return familyForStoryType(story.storyType as StoryType);
}

/** ARCHIVE/FILLER content would misrepresent old material as a league's CURRENT state — the same exclusion director.ts's own (private) isFlashbackFamily applies to its slot 8 (third_league_current_state) pick, re-applied here since this file can't reach that private helper. */
function isFlashbackFamily(story: Pick<BroadcastStory, "storyType">): boolean {
  const family = storyFamily(story);
  return family === "ARCHIVE" || family === "FILLER";
}

/**
 * A Shadow Bot / practice-mode encouragement beat. A real user report named
 * this gap directly, in the same breath as the season-recap ask itself:
 * "...give a section about encouraging people to use the app for shadow
 * bots so the shadow league could start." A Season Review airs exactly at
 * the moment a season has just ended and the next one hasn't started —
 * precisely the gap worth pointing players at Shadow Bot for, since a
 * future shadow league needs real Shadow Bot activity to exist first.
 *
 * The content itself already exists and is real (story-detectors-filler.ts —
 * SHADOW_BOT_PROMO is upserted unconditionally every batch, never
 * fabricated here); what was actually missing is that director-season-
 * review.ts's own running order has no equivalent of a normal Edition's
 * slot 9 (director.ts's "lighter_or_archive_or_callback", the one home
 * FILLER content is allowed to fill) at all — isFlashbackFamily above
 * exists only to keep flashback content OUT of the current-state loop
 * below, not to give it a home of its own the way director.ts's slot 9
 * does. This function is that home, reused verbatim rather than
 * reinvented: same purpose value, same story types, just explicitly
 * placed instead of left to slot 9's normal "one FILLER story, if it
 * outscores ARCHIVE this batch" lottery (a Season Review has no slot 9 to
 * compete for in the first place).
 *
 * Prefers SHADOW_BOT_PROMO by name — the user's own explicit ask — and
 * falls back to PRACTICE_ACTIVITY only if Shadow Bot's evergreen story is
 * somehow missing from the pool. Never fabricates a segment: if neither
 * exists, this returns null and the running order simply has one fewer
 * beat, exactly like every other optional slot in this file.
 */
function pickFillerPromo(pool: readonly BroadcastStory[], usedStoryIds: ReadonlySet<number>): BroadcastStory | null {
  const filler = pool.filter(s => storyFamily(s) === "FILLER" && !usedStoryIds.has(s.id));
  return filler.find(s => s.storyType === "SHADOW_BOT_PROMO")
    ?? filler.find(s => s.storyType === "PRACTICE_ACTIVITY")
    ?? null;
}

export type SeasonReviewInput = {
  /** One entry per league whose season closed this batch — story-engine.ts's own resolveClosedLeagueSeasons. */
  closedSeasons: readonly ClosedLeagueSeason[];
  /** The current, cross-league "new and active" pool a normal Edition also uses — supplies each closed league's own CHAMPION/SEASON_RECAP stories (already upserted this same batch) and any STILL-open league's own LEAGUE-family story for the "what's next" close. */
  pool: readonly BroadcastStory[];
  /** Real per-league highlight candidates, already ranked and diversity-capped by story-engine.ts's own collectSeasonHighlights (score order, at most 2 per subject) — this file only decides how many of each to actually use and where they sit. */
  highlightsByLeague: ReadonlyMap<LeagueType, readonly BroadcastStory[]>;
};

function toEntry(slot: number, purpose: RunningOrderSlotPurpose, story: BroadcastStory): RunningOrderEntry {
  // A minimal, single-member MergedStoryGroup — buildSegmentForEntry
  // (edition-engine.ts) only ever reads `.primary` off this, so there's
  // nothing for `.supporting` to fold in here the way a normal Edition's
  // real merge step (grouping several stories about the same match/subject)
  // does; every highlight this file selects is already its own distinct
  // story.
  const group: MergedStoryGroup = { groupKey: `season-review:${story.id}`, primary: story, supporting: [] };
  return { slot, purpose, group, treatment: treatmentForScore(story.score), carryForwardState: null };
}

/** The CHAMPION/SEASON_RECAP row this exact closed season already has sitting in `pool` (both were upserted earlier in this same batch — see story-engine.ts's processLeagueFamily) — matched on seasonId, not just leagueType, since CHAMPION is never resolved/archived and an older season's champion for the SAME league can still be sitting in the pool too (the "clump of all seasons" failure mode director.ts's own header warns about). */
function findSeasonStory(pool: readonly BroadcastStory[], storyType: "CHAMPION" | "SEASON_RECAP", closed: ClosedLeagueSeason): BroadcastStory | null {
  return pool.find(s => s.storyType === storyType && s.leagueType === closed.leagueType && s.facts.seasonId === closed.seasonId) ?? null;
}

export function selectSeasonReviewRunningOrder(input: SeasonReviewInput): RunningOrderEntry[] {
  const bodyEntries: RunningOrderEntry[] = [];
  const usedStoryIds = new Set<number>();
  const usedAnchoredMatches = new Set<string>();
  let nextSlot = 3; // 1 = opening, 2 = headlines (both assembled last, below)

  function place(purpose: RunningOrderSlotPurpose, story: BroadcastStory | null): void {
    if (!story || usedStoryIds.has(story.id)) return;
    // Separate detectors can describe the same result (for example REVENGE
    // and FIRST_H2H_WIN). A retrospective should deepen that moment once,
    // not replay the same match as two nominally different highlights.
    const anchorKey = story.anchorMatchId === null
      ? null
      : `${story.leagueType}:${story.anchorMatchId}`;
    if (anchorKey !== null && usedAnchoredMatches.has(anchorKey)) return;
    usedStoryIds.add(story.id);
    if (anchorKey !== null) usedAnchoredMatches.add(anchorKey);
    bodyEntries.push(toEntry(nextSlot, purpose, story));
    nextSlot += 1;
  }

  // The actual outcome always leads a Season Review, exactly like a normal
  // Edition's main_story is always its single highest-priority story —
  // only the FIRST champion gets that lead purpose (editionTitle,
  // api-shapes.ts, reads its title suffix off the main_story segment); any
  // further closed leagues' champions still air, just as supporting beats.
  let firstChampionPlaced = false;
  for (const closed of input.closedSeasons) {
    const champion = findSeasonStory(input.pool, "CHAMPION", closed);
    if (!champion) continue;
    place(firstChampionPlaced ? "supporting_story_or_checkin" : "main_story", champion);
    firstChampionPlaced = true;
  }

  // The real storylines — actual matches and topics from the season, the
  // exact gap a real user report named.
  for (const closed of input.closedSeasons) {
    const highlights = input.highlightsByLeague.get(closed.leagueType) ?? [];
    for (const story of highlights.slice(0, MAX_HIGHLIGHTS_PER_LEAGUE)) {
      place("season_highlight", story);
    }
  }

  // The season's own numbers — matches played, who won the most.
  for (const closed of input.closedSeasons) {
    place("supporting_story_or_checkin", findSeasonStory(input.pool, "SEASON_RECAP", closed));
  }

  // Every league that DIDN'T close still gets its own real, dedicated
  // moment — not just a single shared "what's next" mention. A real user
  // report ("did you actually make it have multiple sections... 2/3 is
  // nowhere near what I wanted") traced back to exactly this gap: only the
  // closed league got genuine depth, while the other one or two leagues
  // — still very much live — got at most one shared line between them.
  // "Cover all three leagues" (the user's own explicit direction) means
  // every league, not only the one whose season happens to have ended.
  // Reuses director.ts's own "third_league_current_state" purpose/shape —
  // a league's best real, non-flashback current storyline — one segment
  // per still-open league rather than director.ts's own single "at most
  // one, if a normal Edition still has room" version of it.
  const closedLeagueTypes = new Set(input.closedSeasons.map(c => c.leagueType));
  for (const league of ALL_LEAGUE_TYPES) {
    if (closedLeagueTypes.has(league)) continue;
    const currentStateStory = input.pool
      .filter(s => s.leagueType === league && !usedStoryIds.has(s.id) && !isFlashbackFamily(s))
      .sort((a, b) => b.score - a.score)[0] ?? null;
    place("third_league_current_state", currentStateStory);
  }

  // A Shadow Bot / practice-mode encouragement beat — see pickFillerPromo's
  // own header. Placed once, after every league's own real content, using
  // the same "lighter/callback" home a normal Edition's slot 9 gives this
  // exact content — never fabricated, skipped entirely if neither
  // SHADOW_BOT_PROMO nor PRACTICE_ACTIVITY exists in the pool.
  place("lighter_or_archive_or_callback", pickFillerPromo(input.pool, usedStoryIds));

  // Headlines — a brief tease of what's already been placed above, the
  // exact same shape a normal Edition's own slot 2 uses (director.ts's own
  // header on "many entries, one purpose").
  const headlineSources = bodyEntries
    .slice()
    .sort((a, b) => b.group!.primary.score - a.group!.primary.score)
    .slice(0, 3);
  const headlineEntries: RunningOrderEntry[] = headlineSources.map(e => ({
    slot: 2, purpose: "headlines", group: e.group, treatment: "headline_ticker", carryForwardState: null,
  }));

  // What's next — a STILL-OPEN league's own live storyline, never the
  // league that just closed (its season is over; nothing left to watch
  // there until the next one starts). Prefer a not-yet-used LEAGUE story;
  // the per-open-league current-state loop above will usually have already
  // used the best one, so fall back to legitimately re-referencing it
  // (director.ts's own documented what_to_watch allowance: "recapping the
  // open question is real content, not duplication, since it airs in a
  // structurally different slot") rather than degrading to the generic
  // fixed fallback line just because it already got its own segment.
  const openLeagueStoriesByScore = [...input.pool]
    .filter(s => storyFamily(s) === "LEAGUE" && !closedLeagueTypes.has(s.leagueType as LeagueType))
    .sort((a, b) => b.score - a.score);
  const stillOpenLeagueStory =
    openLeagueStoriesByScore.find(s => !usedStoryIds.has(s.id)) ?? openLeagueStoriesByScore[0] ?? null;
  const whatToWatchEntry: RunningOrderEntry = stillOpenLeagueStory
    ? toEntry(nextSlot, "what_to_watch", stillOpenLeagueStory)
    : { slot: nextSlot, purpose: "what_to_watch", group: null, treatment: "utility", carryForwardState: null };
  nextSlot += 1;

  const openingEntry: RunningOrderEntry = { slot: 1, purpose: "opening", group: null, treatment: "utility", carryForwardState: null };
  const closingEntry: RunningOrderEntry = { slot: nextSlot, purpose: "closing", group: null, treatment: "utility", carryForwardState: null };

  return [openingEntry, ...headlineEntries, ...bodyEntries, whatToWatchEntry, closingEntry];
}
