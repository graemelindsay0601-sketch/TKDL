// TKDL LIVE — small shared helpers every scenes/*.tsx file uses: turning a
// Segment's own `graphic` into the right graphics/*.tsx element, and slicing
// its dialogue down to "only the turns played so far" (BroadcastPlayer.tsx's
// own computeTimedPosition()-derived turnIndex, translated by the caller
// into a 1-based count — scenes themselves stay ignorant of the shared
// clock, they just render whatever slice of dialogue they're handed).
import { GRAPHIC_COMPONENTS } from "../graphics";
import { humanizeStoryType, visualTierForImportance, type VisualTier } from "../theme";
import type { Segment } from "../types";

export type SceneProps = {
  segment: Segment;
  /** How many of `segment.dialogue`'s turns to reveal, most-recent-last (1-based; always at least 1 once a segment has begun playing). */
  turnsPlayed: number;
};

/** theme.ts's own visualTierForImportance(), reading from the segment's real Treatment (Segment.importance) — the one place every scene derives its own hierarchy-by-treatment tier from, so DeskScene/ResultScene/AnalysisScene/GraphicScene/HeadlinesScene can't drift out of sync on how "major" is computed. */
export function tierForSegment(segment: Segment): VisualTier {
  return visualTierForImportance(segment.importance);
}

export function renderGraphic(segment: Segment, opts?: { compact?: boolean }) {
  if (!segment.graphic) return null;
  const GraphicComponent = GRAPHIC_COMPONENTS[segment.graphic.kind];
  return (
    <div data-broadcast-region="graphic" className="min-w-0 max-w-full">
      <GraphicComponent leagueType={segment.leagueType} data={segment.graphic.data} compact={opts?.compact} />
    </div>
  );
}

/**
 * A readable subject line for a segment that has no dialogue yet to lean
 * on, or as a scene's own headline — "NEW_LEADER" -> "New Leader". Falls
 * back to the segment's purpose-derived `type` field for the rare no-story
 * segments (api-shapes.ts's `type: segment.storyType ?? segment.purpose`,
 * covering director.ts's own slot-9/slot-10/etc. no-story fallbacks).
 *
 * That purpose fallback is NOT always a single plain word like "desk" —
 * director-math.ts's RunningOrderSlotPurpose includes multi-word lowercase
 * values ("what_to_watch", "lighter_or_archive_or_callback",
 * "third_league_current_state" and others), and the previous ALL-CAPS-only
 * gate here (`/^[A-Z0-9_]+$/`) let every one of those straight through
 * unhumanized — real user feedback: "what_to_watch" and
 * "lighter_or_archive_or_callback" rendering verbatim as on-screen titles.
 * Both `storyType` and `purpose` are always identifier-shaped (letters,
 * digits, underscores — never free text, since dialogue/headline copy
 * comes from elsewhere), so matching either case here and always routing
 * through humanizeStoryType() is safe and correct for both sources.
 */
export function headlineFor(segment: Segment): string {
  return /^[A-Za-z0-9_]+$/.test(segment.type) ? humanizeStoryType(segment.type) : segment.type;
}

export function visibleTurns(segment: Segment, turnsPlayed: number) {
  return segment.dialogue.slice(0, Math.max(1, Math.min(turnsPlayed, segment.dialogue.length)));
}
