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

/** Per closed league — enough real storylines to feel like an actual retrospective without one league's history swallowing the whole special. */
const MAX_HIGHLIGHTS_PER_LEAGUE = 4;

function storyFamily(story: Pick<BroadcastStory, "storyType">) {
  return familyForStoryType(story.storyType as StoryType);
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
  let nextSlot = 3; // 1 = opening, 2 = headlines (both assembled last, below)

  function place(purpose: RunningOrderSlotPurpose, story: BroadcastStory | null): void {
    if (!story || usedStoryIds.has(story.id)) return;
    usedStoryIds.add(story.id);
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
  // there until the next one starts).
  const closedLeagueTypes = new Set(input.closedSeasons.map(c => c.leagueType));
  const stillOpenLeagueStory = [...input.pool]
    .filter(s => !usedStoryIds.has(s.id) && storyFamily(s) === "LEAGUE" && !closedLeagueTypes.has(s.leagueType as LeagueType))
    .sort((a, b) => b.score - a.score)[0] ?? null;
  const whatToWatchEntry: RunningOrderEntry = stillOpenLeagueStory
    ? toEntry(nextSlot, "what_to_watch", stillOpenLeagueStory)
    : { slot: nextSlot, purpose: "what_to_watch", group: null, treatment: "utility", carryForwardState: null };
  nextSlot += 1;

  const openingEntry: RunningOrderEntry = { slot: 1, purpose: "opening", group: null, treatment: "utility", carryForwardState: null };
  const closingEntry: RunningOrderEntry = { slot: nextSlot, purpose: "closing", group: null, treatment: "utility", carryForwardState: null };

  return [openingEntry, ...headlineEntries, ...bodyEntries, whatToWatchEntry, closingEntry];
}
