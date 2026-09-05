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

/** A readable subject line for a segment that has no dialogue yet to lean on, or as a scene's own headline — "NEW_LEADER" -> "New Leader". Falls back to the segment's purpose-derived `type` field for the rare no-story segments (director.ts's own slot-9 fallback), which is already a plain word like "desk" rather than a SCREAMING_CASE story type. */
export function headlineFor(segment: Segment): string {
  return /^[A-Z0-9_]+$/.test(segment.type) ? humanizeStoryType(segment.type) : segment.type;
}

export function visibleTurns(segment: Segment, turnsPlayed: number) {
  return segment.dialogue.slice(0, Math.max(1, Math.min(turnsPlayed, segment.dialogue.length)));
}
