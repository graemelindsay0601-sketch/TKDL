// TKDL LIVE — data model for PosterRevealGraphic.tsx. Shares its
// FORMAT_LABELS table with team-result-graphic.ts (imported, not
// duplicated) so a resultKind label never drifts between the two —
// PosterRevealGraphic is the ONLY graphic kind a MATCH_RESULT story (plain
// Singles) ever reaches, on top of every TEAM_RESULT resultKind
// TeamResultGraphic already knows how to label.
import type { GraphicData } from "../types";
import { FORMAT_LABELS } from "./team-result-graphic";

export type PosterRevealModel = {
  winnerName: string;
  loserName: string;
  stake: number;
  formatLabel: string;
};

function text(data: GraphicData, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * api-shapes.ts only ever routes a segment to this graphic kind for a
 * "major"-treatment MATCH_RESULT or TEAM_RESULT story (see its own
 * serializeSegment comment), so `data` is always one of those two facts
 * shapes: MATCH_RESULT's winnerId/loserId have already been resolved to
 * winnerName/loserName strings by commentary-engine.ts's buildGraphicFacts
 * by the time a graphic ever sees them (same resolution TeamResultGraphic
 * already relies on for TEAM_RESULT's own winnerName/loserName). Returns
 * null — never a half-filled poster — for anything that doesn't carry both
 * names and a numeric stake, same defensive contract every other
 * graphics/*.tsx model in this folder already follows.
 */
export function buildPosterRevealModel(data: GraphicData): PosterRevealModel | null {
  const winnerName = text(data, "winnerName");
  const loserName = text(data, "loserName");
  const stake = data.stake;
  if (!winnerName || !loserName || typeof stake !== "number" || !Number.isFinite(stake)) return null;

  const resultKind = text(data, "resultKind") ?? "singles";
  return {
    winnerName,
    loserName,
    stake,
    formatLabel: FORMAT_LABELS[resultKind] ?? resultKind.replaceAll("_", " "),
  };
}
