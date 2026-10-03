// TKDL LIVE — data model for StatOfTheNightGraphic.tsx. api-shapes.ts only
// ever routes a SEASON_BEST or PERSONAL_BEST story here when the Story
// Engine scored it "major" (the rare, genuinely-record-setting case, per
// that file's own comment) — every other SEASON_BEST/PERSONAL_BEST keeps
// the quieter ResultGraphic card. `metric`/`value`/`recordScope` are exactly
// story-detectors-performance.ts's own detectSeasonBest/detectPersonalBest
// facts (the latter added specifically so this graphic can tell the two
// story types apart — see that file's own comment).
import type { GraphicData } from "../types";
import { humanizeFactKey } from "../theme";

export type StatOfTheNightModel = {
  playerName: string;
  metricLabel: string;
  valueLabel: string;
  scopeLabel: "Season Best" | "Career Best";
};

function str(data: GraphicData, key: string): string | null {
  const v = data[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** story-detectors-performance.ts's own only metric so far — not a percent-
 * shaped rate by name (it's scoring events per 30 darts, which can exceed
 * 1), so it's shown as a plain number, one decimal place for readability. */
function formatMetricValue(metric: string, value: number): string {
  if (metric === "scoringRate30") return value.toFixed(1);
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function buildStatOfTheNightModel(data: GraphicData): StatOfTheNightModel | null {
  const playerName = str(data, "playerName");
  const metric = str(data, "metric");
  const value = data.value;
  if (!playerName || !metric || typeof value !== "number" || !Number.isFinite(value)) return null;

  return {
    playerName,
    metricLabel: humanizeFactKey(metric),
    valueLabel: formatMetricValue(metric, value),
    scopeLabel: str(data, "recordScope") === "career" ? "Career Best" : "Season Best",
  };
}
