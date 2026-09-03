// TKDL LIVE — the closing "what's coming up" hook. Direct response to
// player feedback: "I want this to be fun and something players look
// forward to watching... not just a constant same episode loop" — the
// required slot 10 sign-off (11.1) previously always used the exact same
// three fixed, fact-free lines every single Edition (edition-engine.ts's
// own CLOSING_DIALOGUE_OPTIONS), which is exactly the "generic chat, move
// on" pattern players called out. This file is the pure template pool that
// lets the sign-off's B-line become a genuine, fact-checked tease for
// whatever storyline is still open — a title race, a streak on the line —
// instead of always repeating a generic goodbye.
//
// Pure template data + one lookup helper only, zero @workspace/db imports,
// same reason every other *-math.ts file in this folder is split out this
// way (see story-engine-math.ts's own header) — so this stays directly
// unit-testable via `node --test` with no database involved. The DB-facing
// parts (resolving an id fact to a display name via buildTemplateFacts,
// and the actual interpolateTemplate call) stay in edition-engine.ts,
// which is this file's only real caller (director.ts decides WHICH story,
// if any, gets attached to the closing slot — see its own header on slot
// 10 — and hands the choice to edition-engine.ts to render).
//
// ── Why only these eight story types ──────────────────────────────────────
// Deliberately covers only story types that are genuinely still OPEN going
// forward — an unresolved title race, a streak that could end any time —
// not "something just happened" stories like NEW_LEADER's own sibling
// TITLE_SWING or a plain RESULT story, which are past-tense recaps with
// nothing left to tease. NEW_LEADER itself is included because "there's a
// new leader" doubles as "will it stick" the moment it's phrased that way.
//
// ── Why every template is safe to air verbatim ────────────────────────────
// Every placeholder used below comes straight from that exact story type's
// own established `_REQUIRES` fact set in commentary-library.ts (WIN_STREAK,
// LOSS_STREAK, NEW_LEADER, LEAD_TIGHTENS, LEAD_WIDENS, NEW_FAVOURITE,
// DEAD_HEAT, TITLE_RACE) — never a fact that story type doesn't actually
// carry, so interpolation can never fail for a story of the right type.
// Every template is also hand-checked against the same two rules
// commentary-library.ts's own phrases are held to (17.2's record-claim
// language — first/best/worst/record/ever/highest/lowest/career-best — and
// 12.7's banned-topic language), and against edition-engine.ts's own
// FUTURE_MATCH_LANGUAGE_PATTERN (no "next match/fixture/game" or "will
// face/play/meet" — TKDL has no fixture list to tease a *specific* game
// from, so every line below teases a STORYLINE, never a scheduled match).
// __tests__/closing-tease-math.test.ts runs the mechanical version of all
// three checks over this exact pool.
import type { StoryType } from "./story-types.ts";

export const CLOSING_TEASE_TEMPLATES: Partial<Record<StoryType, readonly string[]>> = {
  NEW_LEADER: [
    "Keep an eye on {{newLeaderEntityName}} at the top — plenty of season left for that to change again.",
    "Question now is whether {{previousLeaderEntityName}} answers back before the gap grows.",
  ],
  LEAD_TIGHTENS: [
    "That gap's down to {{currentGap}} now — worth checking in on how long {{leaderEntityName}} holds on.",
    "A lead that tight rarely stays settled for long.",
  ],
  LEAD_WIDENS: [
    "{{currentGap}} points clear at the top now — worth watching whether that cushion keeps growing.",
    "Plenty of the season left yet for that lead to be tested.",
  ],
  NEW_FAVOURITE: [
    "{{newFavouriteEntityName}}'s the one to watch now the model's shifted.",
    "See whether {{previousFavouriteEntityName}} can win that spot back.",
  ],
  DEAD_HEAT: [
    "{{firstEntityName}} and {{secondEntityName}} — keep watching that one, it's finely poised.",
    "That title picture could tip either way from here.",
  ],
  TITLE_RACE: [
    "Still wide open between {{viableEntityNamesJoined}} — worth staying tuned for how that shakes out.",
    "Plenty still to play for among that group.",
  ],
  WIN_STREAK: [
    "Worth keeping an eye on whether {{playerName}} keeps that run going.",
    "{{playerName}}'s run stays the one to watch for now.",
  ],
  LOSS_STREAK: [
    "Whether {{playerName}} turns that run around is the one worth watching.",
    "See if {{playerName}} can find a way out of that run.",
  ],
};

export function hasClosingTease(storyType: StoryType): boolean {
  return storyType in CLOSING_TEASE_TEMPLATES;
}
