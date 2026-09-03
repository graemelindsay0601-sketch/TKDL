// TKDL LIVE — shared, non-visual-design palette/label constants for the
// data-driven components this phase DOES build (LiveTicker, LiveInsertOverlay,
// graphics/*). These are the same league accent colours 15.3 already
// mandates for the whole feature ("Singles accent magenta/red; Doubles
// electric blue; Shift Wars gold/amber. Gold remains reserved for title/
// champion/special moments.") — not a new design decision, just centralising
// the three literal values so every component agrees on them. Presenter/
// studio visual design itself (Presenter.tsx, LowerThird.tsx, presenters/
// presenter-config.ts, background art, portraits) lives in those files, not
// here — this file stays the shared palette/label constants only.
import type { LeagueType, Scene } from "./types";

// ── Visual hierarchy by treatment (real darts-broadcast research) ─────────
// TKDL LIVE's own scenes used to render every segment at the same visual
// volume — a routine Supporting story ("STREAK BREAKER") got the exact same
// huge centred headline as a genuinely major one. Real UK darts coverage
// (Sky Sports) doesn't work that way: the scoring overlay stays small and
// restrained through routine play, and the bigger, more animated graphic
// treatment (a checkout/nine-darter animation) is spent ONLY on the
// milestone moments that actually earn it. This maps a segment's own real
// Treatment (director-math.ts, carried on Segment.importance) onto that
// same idea — "quiet" is the default every routine Supporting/ticker/archive
// segment gets, "major" is reserved for the rare big one. Deliberately only
// three buckets, not five: Featured sits between them rather than getting
// its own fully bespoke scale, since the actual visual difference that
// matters is "routine" vs "this is the moment," not five finely graded
// steps nobody would consciously notice.
export type VisualTier = "major" | "featured" | "quiet";

export function visualTierForImportance(importance: string): VisualTier {
  if (importance === "major") return "major";
  if (importance === "featured") return "featured";
  return "quiet"; // supporting, headline_ticker, archive, utility, and any future/unrecognised value
}

export const LEAGUE_ACCENT: Record<LeagueType, string> = {
  singles: "#ff005c",
  doubles: "#0066ff",
  shift_wars: "#ffd24a",
};

export const LEAGUE_LABEL: Record<LeagueType, string> = {
  singles: "Singles",
  doubles: "Doubles",
  shift_wars: "Shift Wars",
};

export const OVERLAY_CLASS_LABEL = { just_in: "JUST IN", breaking: "BREAKING" } as const;
export const OVERLAY_CLASS_ACCENT = { just_in: "#0066ff", breaking: "#ff005c" } as const;

/** BroadcastPlayer.tsx's persistent corner label — a short, human name for whichever scene is currently on screen, in place of the raw Scene identifier. */
export const SCENE_LABEL: Record<Scene, string> = {
  desk: "On the Desk",
  analysis: "Analysis",
  graphic: "From the Archive",
  result: "Check-in",
  headlines: "Coming Up",
  breaking: "Breaking",
  spotlight: "Spotlight",
  champion: "Champion",
};

/** "NEW_LEADER" -> "New Leader", "180_MILESTONE" -> "180 Milestone" — the exact same transform api-shapes.ts's own humanizeStoryType() applies backend-side, mirrored here for display of a `Segment.type`/`LiveOverlayItem.storyType` value the frontend receives as a raw identifier. */
export function humanizeStoryType(storyType: string): string {
  return storyType
    .split("_")
    .map(word => (/^\d+$/.test(word) ? word : word.charAt(0) + word.slice(1).toLowerCase()))
    .join(" ");
}

/** "winStreak" -> "Win Streak", "titleProbability" -> "Title Probability" — the same general camelCase/underscore -> Title Case transform, applied here to a story's raw fact keys so graphics/* can render `data`'s own keys generically without a hand-authored label per key. */
export function humanizeFactKey(key: string): string {
  const spaced = key
    // A resolved entity-name key (commentary-engine.ts's buildGraphicFacts,
    // mirroring scalarIdNameKey's own *Id -> *Name convention) can carry a
    // single-letter disambiguator with no lowercase before it — "playerAName"
    // (from playerAId) — where the plain camelCase rule below only ever
    // splits a lowercase->uppercase boundary and leaves "AName" fused into
    // one word ("Player AName"). This first pass splits an uppercase RUN
    // right before the capitalized word it introduces ("A" + "Name"), so
    // that ordinary run-together acronym-like fact keys read as separate
    // words the same way a plain camelCase key already does.
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // camelCase -> spaced
    .replace(/_/g, " ");
  return spaced
    .split(" ")
    .filter(Boolean)
    .map(word => (/^\d+$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

// Fact keys shaped as a 0-1 fraction across the whole story catalogue, not
// just the "xProbability" convention this already covered — story-
// detectors-archive.ts's *WinRate, story-detectors-form.ts's seasonRate/
// recentRate, and story-detectors-performance.ts's checkoutRate/
// ownBaselineCheckoutRate/checkoutPercentile/scoringPercentile are all
// genuinely 0-1 (a percentile here is stored as a 0-1 rank, not already a
// 0-100 number) and were rendering as a bare "0.5" instead of "50%" before
// this existed. Deliberately anchored to end-of-string so a rate that ISN'T
// a plain fraction, like scoringRate30 (scoring events per 30 darts — can
// exceed 1), never matches.
const PERCENT_SHAPED_KEY = /(?:probability|rate|percentile)$/i;

/** A fact value formatted for display: booleans as Yes/No, a 0-1 fraction-shaped number (probability/rate/percentile — see PERCENT_SHAPED_KEY) as a percentage, everything else passed through String(). Heuristic, not authoritative — story facts are a loosely-typed bag (GraphicData), so this is a best-effort generic renderer rather than a per-key-typed formatter. */
export function formatFactValue(key: string, value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (PERCENT_SHAPED_KEY.test(key) && value >= 0 && value <= 1) return `${Math.round(value * 100)}%`;
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (Array.isArray(value)) return value.map(v => String(v)).join(", ");
  if (value === null || value === undefined) return "—";
  return String(value);
}
