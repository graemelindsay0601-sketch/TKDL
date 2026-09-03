// TKDL LIVE — API response shaping (handover doc sections 14.4/14.5). Pure
// mapping from the internal, persisted programme shape (director-math.ts's
// ProgrammeSegment/EditionProgramme — designed for build-time assembly and
// live-events.ts's own validity-rule re-evaluation) to the PUBLIC response
// shape routes/broadcast.ts actually serves. Zero @workspace/db runtime
// imports (same convention as every other *-math.ts file in this folder),
// so this stays directly unit-testable via `node --test`.
//
// ── Why this is a separate file from director-math.ts ───────────────────
// director-math.ts's ProgrammeSegment shape is what BOTH edition-engine.ts
// (writer) and live-events.ts (reader, via programmeSegmentId) need to agree
// on for the *internal*, persisted representation — adding API-only concerns
// (scene chrome, which graphic component renders a story, a human-readable
// title) to that type would blur "what got persisted" with "how a client
// should render it," and would force every internal consumer to carry fields
// only routes/broadcast.ts ever reads. This file owns exactly that second,
// API-facing translation, and only that.
//
// ── scene/graphic — real, complete mappings, not a placeholder default ───
// 14.5 documents a small fixed `scene` enum and a `graphic.kind` naming one
// of 15.1's own listed graphics/*.tsx components. Both are derived below
// from data this codebase already has in full: RunningOrderSlotPurpose (an
// exhaustive union, director-math.ts) for scene, and StoryType (an
// exhaustive union, story-types.ts) for graphic kind — GRAPHIC_KIND_BY_STORY
// _TYPE is a `Record<StoryType, GraphicKind>` literal, so TypeScript itself
// refuses to compile if a story type is ever added to the catalogue without
// a graphic-kind decision being made for it here. Nothing here is a stand-in
// for later visual-design work: `scene` and `graphic.kind` are just NAMES
// picked from the already-fixed catalogues in 15.1/15.4 (choosing which
// existing scene/graphic component a segment routes to), not any pixel,
// layout, or asset decision — those remain paused for host-design
// collaboration exactly as task 135 already documents.
//
// ── graphic.data — the story's own already-verified facts, not a bespoke
// per-type shape ─────────────────────────────────────────────────────────
// story-types.ts's own StoryCandidate comment is explicit: `facts` holds
// "Verified, display-ready numbers backing this story's claim" — the fact
// firewall (17.1) already guarantees nothing reaches a story's facts object
// that isn't a real, traceable query result. Handing that same object
// straight through as `graphic.data` (rather than hand-authoring a distinct,
// bespoke payload shape per StoryType, on top of the ~40-entry mapping this
// file already needs for `graphic.kind`) is a complete, deliberate contract
// — whichever graphic component ends up reading a given kind's data reads
// the exact fact keys that story's own detector (story-detectors-*.ts)
// already documents, not a second, narrower re-projection of them that could
// drift out of sync with the detector's own real output.
import type { ProgrammeSegment, EditionProgramme, RunningOrderSlotPurpose } from "./director-math.ts";
import type { StoryType } from "./story-types.ts";
import { familyForStoryType, type StoryFamily } from "./story-types.ts";
import type { SlotType } from "@workspace/db/schema";

// ═══════════════════════════════════════════════════════════════════════
// 14.5 scene
// ═══════════════════════════════════════════════════════════════════════

export type Scene = "desk" | "analysis" | "graphic" | "result" | "headlines" | "breaking" | "spotlight" | "champion";

/**
 * Story types dramatic enough that a MAJOR-treatment segment about one earns
 * the "breaking" scene's heavier chrome even as a normally-scheduled,
 * prepared segment — distinct from (and unrelated to) 11.4's live-overlay
 * "breaking" classification, which is about an unplanned mid-programme
 * insert, not a prepared segment's own visual treatment. Deliberately a
 * short, named set rather than "every RESULT-family story": most upsets are
 * routine content, not "stop the show" moments — only the ones the Story
 * Engine itself already scores as its most dramatic within each family
 * (MAJOR/MODEL-prefixed, a beaten leader, a broken streak, a swung title
 * race, a shift-wars comeback) qualify.
 */
const BREAKING_WORTHY_STORY_TYPES = new Set<StoryType>([
  "MAJOR_UPSET", "MODEL_SHOCK", "LEADER_BEATEN", "STREAK_BREAKER", "TITLE_SWING", "SHIFT_COMEBACK",
]);

type SceneInput = Pick<ProgrammeSegment, "purpose" | "storyType" | "storyId" | "importance">;

export function sceneForSegment(segment: SceneInput): Scene {
  if (segment.purpose === "opening_headlines") return "headlines";
  if (segment.purpose === "closing") return "desk";
  if (segment.storyType === "CHAMPION") return "champion";
  // storyId === null only ever happens for slot 9's documented no-LEAGUE-
  // story fallback (director.ts) — a hand-written "nothing to report on the
  // title front" line reads naturally from the presenters' desk.
  if (segment.storyId === null) return "desk";

  if (segment.importance === "major" && BREAKING_WORTHY_STORY_TYPES.has(segment.storyType as StoryType)) return "breaking";

  switch (segment.purpose) {
    case "analysis_or_predictor":
    case "what_to_watch":
      return "analysis";
    case "form_h2h_or_spotlight":
      return "spotlight";
    case "third_league_current_state":
    case "supporting_story_or_checkin":
      return "result";
    case "lighter_or_archive_or_callback":
      return segment.storyType !== null && familyForStoryType(segment.storyType as StoryType) === "ARCHIVE" ? "graphic" : "spotlight";
    case "main_story":
    case "second_major_story":
    default:
      return "desk";
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 14.5 graphic.kind — one of 15.1's own listed graphics/*.tsx components
// ═══════════════════════════════════════════════════════════════════════

export type GraphicKind =
  | "LeagueTableGraphic" | "TitlePredictorGraphic" | "MatchContextGraphic"
  | "HeadToHeadGraphic" | "FormWatchGraphic" | "WagerGraphic" | "ResultGraphic";

/**
 * Every StoryType maps to exactly one graphic kind — a TypeScript object
 * literal typed `Record<StoryType, GraphicKind>` rather than a switch with a
 * default, so adding a new story type to the Appendix A catalogue without
 * also deciding its graphic kind here is a compile error, not a silent
 * fallback. See this file's own header for why the mapping itself (rather
 * than the graphic components) is in scope for this phase.
 */
export const GRAPHIC_KIND_BY_STORY_TYPE: Record<StoryType, GraphicKind> = {
  // RESULT
  UPSET: "MatchContextGraphic",
  MAJOR_UPSET: "MatchContextGraphic",
  MODEL_SHOCK: "MatchContextGraphic",
  HIGH_STAKE_WIN: "WagerGraphic",
  HIGH_STAKE_LOSS: "WagerGraphic",
  ELIMINATION: "ResultGraphic",
  LEADER_BEATEN: "MatchContextGraphic",
  STREAK_BREAKER: "MatchContextGraphic",
  DROUGHT_ENDED: "ResultGraphic",
  FIRST_H2H_WIN: "HeadToHeadGraphic",
  REVENGE: "HeadToHeadGraphic",

  // FORM
  WIN_STREAK: "FormWatchGraphic",
  LOSS_STREAK: "FormWatchGraphic",
  FORM_REVERSAL: "FormWatchGraphic",
  QUIET_CLIMBER: "FormWatchGraphic",
  FREEFALL: "FormWatchGraphic",
  ABOVE_BASELINE: "FormWatchGraphic",

  // H2H
  H2H_DOMINANCE: "HeadToHeadGraphic",
  RIVALRY: "HeadToHeadGraphic",
  RIVALRY_SWING: "HeadToHeadGraphic",

  // PERFORMANCE
  CLINICAL_FINISHING: "ResultGraphic",
  DOUBLE_TROUBLE: "ResultGraphic",
  SCORING_POWER: "ResultGraphic",
  SCORING_WITHOUT_FINISHING: "ResultGraphic",
  SEASON_BEST: "ResultGraphic",
  PERSONAL_BEST: "ResultGraphic",

  // LEAGUE
  NEW_LEADER: "LeagueTableGraphic",
  LEAD_TIGHTENS: "LeagueTableGraphic",
  LEAD_WIDENS: "LeagueTableGraphic",
  TITLE_SWING: "TitlePredictorGraphic",
  NEW_FAVOURITE: "TitlePredictorGraphic",
  DEAD_HEAT: "TitlePredictorGraphic",
  TITLE_RACE: "TitlePredictorGraphic",
  CHAMPION: "LeagueTableGraphic",
  TIE_PENDING: "LeagueTableGraphic",

  // MILESTONE
  CAREER_MATCH_MILESTONE: "ResultGraphic",
  CAREER_WIN_MILESTONE: "ResultGraphic",
  "180_MILESTONE": "ResultGraphic",
  ELIMINATION_MILESTONE: "ResultGraphic",

  // DOUBLES
  UNBEATEN_PAIR: "FormWatchGraphic",
  PAIR_SURGE: "FormWatchGraphic",
  PAIR_UPSET: "MatchContextGraphic",
  PAIR_ELIMINATED: "ResultGraphic",

  // SHIFT_WARS
  SHIFT_LEAD_CHANGE: "LeagueTableGraphic",
  SHIFT_MOMENTUM: "LeagueTableGraphic",
  SHIFT_COMEBACK: "MatchContextGraphic",
  SHIFT_DOMINANCE: "FormWatchGraphic",

  // ARCHIVE
  LAST_MEETING: "MatchContextGraphic",
  SEASON_COMPARISON: "ResultGraphic",
  HISTORICAL_H2H: "HeadToHeadGraphic",

  // FILLER — none of these carry a match/season shape worth a bespoke
  // graphic; ResultGraphic already renders any facts object generically
  // (this file's own header, "graphic.data" section), which is all these
  // three need.
  PRACTICE_ACTIVITY: "ResultGraphic",
  SHADOW_BOT_PROMO: "ResultGraphic",
  FEATURE_SPOTLIGHT: "ResultGraphic",
};

// familyForStoryType/StoryFamily are re-exercised (not just imported) by
// this file's own test suite to prove GRAPHIC_KIND_BY_STORY_TYPE's keys
// stay in sync with the live catalogue — see api-shapes.test.ts.
export type { StoryFamily };
export { familyForStoryType };

// ═══════════════════════════════════════════════════════════════════════
// 14.5 full segment shape
// ═══════════════════════════════════════════════════════════════════════

export type ApiDialogueTurn = { speaker: "A" | "B"; text: string; holdSeconds: number };
export type ApiSegment = {
  id: string;
  type: string;
  leagueType: "singles" | "doubles" | "shift_wars" | null;
  storyId: number | null;
  /** The real underlying value, which can also be "headline_ticker" or "archive" (Treatment's own full range, director-math.ts) — 14.5's own doc example lists only the four most common values, not an exhaustive contract; narrowing this to that literal four-value union would make it impossible to represent a real, already-existing segment. */
  importance: string;
  scene: Scene;
  dialogue: ApiDialogueTurn[];
  graphic: { kind: GraphicKind; data: Record<string, unknown> } | null;
  validityRules: unknown[];
  estimatedSeconds: number;
};

/** Sum of every dialogue turn's own already-computed reading-pace hold time (12.6) — no separate estimate needed since this IS the real, deterministic time the player will actually spend on this segment. */
function estimatedSecondsForSegment(dialogue: readonly { holdSeconds: number }[]): number {
  return dialogue.reduce((total, turn) => total + turn.holdSeconds, 0);
}

export function serializeSegment(segment: ProgrammeSegment, segmentId: string): ApiSegment {
  // CHAMPION never carries a graphic, in headlines or anywhere else: its
  // facts are just {seasonId, championEntityId} — internal references with
  // nothing yet resolved into a displayable name or table — and
  // ChampionScene.tsx itself was deliberately built with no card slot at
  // all (see that file's own header) after an earlier version of exactly
  // this card grew tall enough to land on the hosts standing below it.
  // GRAPHIC_KIND_BY_STORY_TYPE still maps CHAMPION to a kind (LeagueTable
  // Graphic) purely to satisfy that Record's exhaustiveness check; it's
  // never actually used for this story type.
  const graphic = segment.storyType !== null && segment.storyType !== "CHAMPION" && segment.facts !== null
    ? { kind: GRAPHIC_KIND_BY_STORY_TYPE[segment.storyType as StoryType], data: segment.facts }
    : null;

  return {
    id: segmentId,
    type: segment.storyType ?? segment.purpose,
    leagueType: segment.leagueType,
    storyId: segment.storyId,
    importance: segment.importance,
    scene: sceneForSegment(segment),
    dialogue: segment.dialogue,
    graphic,
    validityRules: segment.validityRules,
    estimatedSeconds: estimatedSecondsForSegment(segment.dialogue),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 14.4 edition title
// ═══════════════════════════════════════════════════════════════════════

const SLOT_TYPE_LABELS: Record<Exclude<SlotType, "manual">, string> = {
  midday: "Midday", evening: "Evening", night: "Late Night",
};

/** "NEW_LEADER" -> "New Leader", "180_MILESTONE" -> "180 Milestone" — a fully general transform (no per-type table, unlike graphic.kind above) because turning a story-type identifier into readable words needs no per-type judgement call the way "which existing graphic component" or "which existing scene" does. */
export function humanizeStoryType(storyType: string): string {
  return storyType
    .split("_")
    .map(word => (/^\d+$/.test(word) ? word : word.charAt(0) + word.slice(1).toLowerCase()))
    .join(" ");
}

export type EditionTitleInput = { slotType: SlotType; scheduledFor: Date };

/**
 * A real, content-derived title built entirely from data this build already
 * has — the slot's own date/type plus (when one exists) the headline
 * subject of the programme's own main_story segment — rather than a
 * generic, unchanging placeholder string. No dedicated title-writing system
 * exists elsewhere in this codebase (commentary-library.ts's phrases are
 * spoken dialogue, not a listings-style title), so this is deliberately
 * scoped to what's honestly derivable without inventing new natural-
 * language commentary content.
 */
export function editionTitle(edition: EditionTitleInput, programme: EditionProgramme): string {
  const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "Europe/London" }).format(edition.scheduledFor);
  const slotLabel = edition.slotType === "manual" ? "Special" : SLOT_TYPE_LABELS[edition.slotType];
  const headline = programme.segments.find((s): s is ProgrammeSegment & { storyType: string } => s.purpose === "main_story" && s.storyType !== null);
  const suffix = headline ? `: ${humanizeStoryType(headline.storyType)}` : "";
  return `TKDL LIVE — ${slotLabel} Edition, ${dateLabel}${suffix}`;
}

// Re-exported purely so routes/broadcast.ts and its tests can name this
// union without a second import from director-math.ts for one type.
export type { RunningOrderSlotPurpose };
