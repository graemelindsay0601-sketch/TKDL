// TKDL LIVE — the cold open: a brief, high-energy flash of this Edition's
// single most dramatic result, aired BEFORE the formal sign-on (slot 1's
// own "opening") — standard sports-broadcast convention (hook with the
// moment, then cut to titles) the show never had. Exactly mirrors
// closing-tease-math.ts's own shape and own safety reasoning (pure template
// data + one lookup helper, zero @workspace/db imports, directly
// unit-testable via `node --test`), with one deliberate difference: where
// the closing tease covers only story types that are still OPEN going
// forward, a cold open is the opposite — it exists only for a story that has
// ALREADY happened and is dramatic enough to earn BreakingScene's own
// heaviest chrome a few seconds later, so it needs a two-line (A/B)
// exchange, not just a single flavor line.
//
// BREAKING_WORTHY_STORY_TYPES (story-types.ts) is the exact same set
// api-shapes.ts's own sceneForSegment already reserves for that chrome.
// COLD_OPEN_TEASE_TEMPLATES below is typed as a full Record over that exact
// set (not Partial, unlike CLOSING_TEASE_TEMPLATES's deliberately narrower
// subset) — TypeScript refuses to compile if that shared list ever changes
// without this file being revisited too: a cold open that teased a story
// BreakingScene wouldn't actually render as breaking would be a broken
// promise to the viewer.
//
// The DB-facing parts (resolving an id fact to a display name via
// buildTemplateFacts, and the actual interpolateTemplate calls) stay in
// edition-engine.ts's own buildColdOpenSegment, which is this file's only
// real caller — exactly the same split closing-tease-math.ts already uses.
//
// ── Why every template is safe to air verbatim ──────────────────────────
// Every placeholder below comes straight from that exact story type's own
// established *_REQUIRES fact set in commentary-library.ts (UPSET_REQUIRES
// for MAJOR_UPSET/MODEL_SHOCK, LEADER_BEATEN_REQUIRES, STREAK_BREAKER_
// REQUIRES, TITLE_SWING_REQUIRES, SHIFT_COMEBACK_REQUIRES) — never a fact
// that story type doesn't actually carry, so interpolation can never fail
// for a story of the right type. Every line is also hand-checked against
// the same two rules commentary-library.ts's own phrases are held to (17.2's
// record-claim language — first/best/worst/record/ever/highest/lowest/
// career-best — and 12.7's banned-topic language), and against
// edition-engine.ts's own FUTURE_MATCH_LANGUAGE_PATTERN: every line below
// describes something that has already happened, never a scheduled match
// TKDL (which has no fixture list) could not actually promise.
import type { StoryType } from "./story-types.ts";
import { BREAKING_WORTHY_STORY_TYPES } from "./story-types.ts";

type ColdOpenPair = { a: string; b: string };

export const COLD_OPEN_TEASE_TEMPLATES: Record<(typeof BREAKING_WORTHY_STORY_TYPES)[number], readonly ColdOpenPair[]> = {
  MAJOR_UPSET: [
    { a: "Before we get into tonight's running order — a major upset just landed on the board.", b: "{{winnerName}} was rated only {{winnerProbabilityPct}}% against {{loserName}}. We'll show you exactly how, in a moment." },
    { a: "Hold the opening titles — {{winnerName}} has just produced a genuine shock result.", b: "{{loserName}} was the strong favourite coming in. Stay with us." },
  ],
  MODEL_SHOCK: [
    { a: "Quick flash before we're properly on air: the model just got this one badly wrong.", b: "{{winnerName}} at only {{winnerProbabilityPct}}%, beating {{loserName}} regardless. Full story shortly." },
    { a: "Before tonight's programme gets underway — a genuine model shock to tell you about.", b: "{{winnerName}} defied the numbers completely against {{loserName}}. More in a moment." },
  ],
  LEADER_BEATEN: [
    { a: "One line before we start properly: the points leader has fallen.", b: "{{loserName}} came in on {{leaderPointsBefore}} points at the top — beaten by {{winnerName}} regardless. We'll have it in full shortly." },
    { a: "Hold on — before the show gets going, the top of the table just moved.", b: "{{winnerName}} has beaten league leader {{loserName}}. Stay tuned." },
  ],
  STREAK_BREAKER: [
    { a: "Before we're properly underway — a serious run has just come to an end.", b: "{{winnerName}} stops {{loserName}}'s run of {{brokenWinStreak}} straight wins. We'll show you shortly." },
    { a: "Quick heads up before tonight's programme starts: that winning run is over.", b: "{{loserName}}'s {{brokenWinStreak}}-match streak, ended by {{winnerName}}. More in a moment." },
  ],
  TITLE_SWING: [
    { a: "Before we start properly — the title picture has just shifted, and shifted hard.", b: "{{entityName}}'s title chance has moved to {{currentProbabilityPct}}%, up from {{previousProbabilityPct}}%. We'll get into it shortly." },
    { a: "Hold the sign-on a moment — the title model has had a serious rethink.", b: "{{entityName}} now sits at {{currentProbabilityPct}}% after a {{deltaPoints}}-point swing. Stay with us." },
  ],
  SHIFT_COMEBACK: [
    { a: "One thing before tonight's programme gets going — a proper fightback in Shift Wars.", b: "{{teamName}} have cut their deficit from {{deficitBefore}} down to {{deficitNow}} in {{matches}} matches. Full story shortly." },
    { a: "Before we start properly: keep an eye on this Shift Wars turnaround.", b: "{{teamName}}'s deficit is down to just {{deficitNow}}, from {{deficitBefore}}. More in a moment." },
  ],
};

export function hasColdOpenTease(storyType: StoryType): boolean {
  return (BREAKING_WORTHY_STORY_TYPES as readonly string[]).includes(storyType);
}
