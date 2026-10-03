// TKDL LIVE — Weekly Highlights Reel: a genuinely REPACKAGED special (task's
// own "a repackaged edition stitching the week's top segments into a 'best
// of the week' show"), not a fresh detection pass the way an ordinary
// Edition or even director-season-review.ts's own Season Review are. Every
// other special this folder builds (Season Review, the catch-up rundown)
// still runs real stories through the Commentary Engine for the first time;
// this one instead picks ALREADY-AIRED ProgrammeSegment objects straight out
// of the last 7 days' own PUBLISHED Editions and re-airs them verbatim — same
// dialogue, same facts, same graphic — because "best of the week" means
// exactly that: a highlight reel, not a second opinion on the week's news.
//
// Pure selection logic only (no DB access, same convention as this folder's
// other director-*.ts files) — edition-engine.ts's own createWeeklyHighlights
// Episode is what fetches the source Editions and wraps the result in a
// fresh opening/closing and persists it.
import type { ProgrammeSegment } from "./director-math.ts";

export type WeeklySourceEdition = {
  id: number;
  publishedAt: Date;
  segments: readonly ProgrammeSegment[];
};

/** How many of the week's top segments the reel carries, and how many any
 * one league can contribute — the same "one busy corner of the club
 * shouldn't crowd out the others" reasoning director-season-review.ts's own
 * MAX_HIGHLIGHTS_PER_LEAGUE already documents, scaled down for a single
 * highlight reel rather than a full retrospective special. */
export const MAX_WEEKLY_HIGHLIGHTS = 8;
const MAX_PER_LEAGUE = 4;

/** Treatment order a highlight reel actually wants — the week's loudest
 * moments first, same ranking theme.ts's own VisualTier research already
 * established (major > featured > supporting), with the two tease/archive
 * tiers folded into the same "not really a standalone highlight" bucket. */
const IMPORTANCE_RANK: Record<string, number> = {
  major: 3, featured: 2, supporting: 1, headline_ticker: 0, archive: 0, utility: 0,
};

/**
 * Picks this week's real highlight segments from the week's own already-
 * published Editions — never a fresh detection pass, never a fabricated
 * recap. A story that aired more than once this week (its own facts
 * updated, say, after a second result) keeps only its LATEST airing: that's
 * the freshest, most complete version of that moment, and the one a viewer
 * who only catches the weekly reel should actually see. Ranked by how loud
 * the Story Engine itself judged the moment (`importance`) at the time it
 * aired, tie-broken by recency, capped per league so one league's busy week
 * can't fill every slot.
 */
export function selectWeeklyHighlightSegments(editions: readonly WeeklySourceEdition[]): ProgrammeSegment[] {
  const newestFirst = [...editions].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  const latestByStoryId = new Map<number, { segment: ProgrammeSegment; publishedAt: Date }>();
  for (const edition of newestFirst) {
    for (const segment of edition.segments) {
      // storyId === null covers every fixed utility slot (opening, closing,
      // what-to-watch, the leaderboard-movement/Season-Finale boards) — none
      // of those are "a highlight," they're this Edition's OWN wraparound,
      // which the reel builds fresh for itself below. "headlines" is the
      // same story a later full segment already covers in this same
      // Edition — a tease, not the moment itself.
      if (segment.storyId === null || segment.purpose === "headlines") continue;
      if (latestByStoryId.has(segment.storyId)) continue; // newest-first order already gave us this story's latest airing
      latestByStoryId.set(segment.storyId, { segment, publishedAt: edition.publishedAt });
    }
  }

  const ranked = [...latestByStoryId.values()].sort((a, b) => {
    const rankDiff = (IMPORTANCE_RANK[b.segment.importance] ?? 0) - (IMPORTANCE_RANK[a.segment.importance] ?? 0);
    return rankDiff !== 0 ? rankDiff : b.publishedAt.getTime() - a.publishedAt.getTime();
  });

  const perLeagueCount = new Map<string, number>();
  const picked: ProgrammeSegment[] = [];
  for (const { segment } of ranked) {
    if (picked.length >= MAX_WEEKLY_HIGHLIGHTS) break;
    const leagueKey = segment.leagueType ?? "none";
    const count = perLeagueCount.get(leagueKey) ?? 0;
    if (count >= MAX_PER_LEAGUE) continue;
    picked.push(segment);
    perLeagueCount.set(leagueKey, count + 1);
  }
  return picked;
}
