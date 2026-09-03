/**
 * Tests for closing-tease-math.ts — the pure template pool behind the
 * closing slot's "what's coming up" hook. Mirrors commentary-library.
 * test.ts's own mechanical checks (17.2 record-claim language, 12.7
 * banned-topic language) plus this pool's own two extra invariants: no
 * future-fixture wording (TKDL has no schedule to tease a specific match
 * from — edition-engine.ts's own FUTURE_MATCH_LANGUAGE_PATTERN scans final
 * rendered dialogue for exactly this, so this pool must never trip it) and
 * every placeholder actually belonging to the story type it's filed under
 * (the same "requires" fact set commentary-library.ts's own phrases for
 * that type declare — see FACT_KEYS_BY_STORY_TYPE below).
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CLOSING_TEASE_TEMPLATES, hasClosingTease } from "../closing-tease-math.ts";
import type { StoryType } from "../story-types.ts";

function allTemplates(): { storyType: StoryType; template: string }[] {
  const out: { storyType: StoryType; template: string }[] = [];
  for (const [storyType, templates] of Object.entries(CLOSING_TEASE_TEMPLATES)) {
    for (const template of templates ?? []) out.push({ storyType: storyType as StoryType, template });
  }
  return out;
}

describe("CLOSING_TEASE_TEMPLATES coverage", () => {
  test("every covered story type has at least one template", () => {
    for (const [storyType, templates] of Object.entries(CLOSING_TEASE_TEMPLATES)) {
      assert.ok((templates?.length ?? 0) > 0, `expected at least one template for ${storyType}`);
    }
  });

  test("hasClosingTease agrees exactly with which story types are covered", () => {
    const covered = new Set(Object.keys(CLOSING_TEASE_TEMPLATES));
    for (const storyType of covered) assert.equal(hasClosingTease(storyType as StoryType), true);
    // A handful of representative NOT-covered types (past-tense recaps with
    // nothing forward-looking left to tease) confirm this isn't vacuously true.
    for (const storyType of ["TITLE_SWING", "CHAMPION", "UPSET", "SEASON_KICKOFF"] as StoryType[]) {
      assert.equal(hasClosingTease(storyType), false, `${storyType} should not have a closing tease`);
    }
  });
});

// Same pattern commentary-math.ts's own (private) RECORD_CLAIM_PATTERN
// uses — duplicated here rather than exported, the same way commentary-
// library.test.ts's own BANNED_TOPIC_PATTERN is a local literal rather than
// a shared import: these hooks never have a verifiedRecordClaim fact to
// license record language the way SEASON_BEST/PERSONAL_BEST phrases can,
// so the bar here is simpler — none of these words are ever appropriate.
const RECORD_CLAIM_PATTERN = /\b(first|best|worst|record|ever|highest|lowest|career-best)\b/i;

describe("17.2 record-claim compliance", () => {
  test("no closing tease template contains record-claim language", () => {
    const offenders = allTemplates().filter(t => RECORD_CLAIM_PATTERN.test(t.template));
    assert.deepEqual(offenders, []);
  });
});

// Identical list to commentary-library.test.ts's own BANNED_TOPIC_PATTERN —
// see that file's header for why "race" and "straight" are deliberately
// left out of the bare scan (ordinary darts-commentary usage here too:
// "title race", never the ethnicity sense).
const BANNED_TOPIC_PATTERN = new RegExp(
  "\\b(" + [
    "wife", "husband", "girlfriend", "boyfriend", "spouse", "married", "divorce", "kids", "children", "daughter", "son",
    "religion", "religious", "church", "mosque", "synagogue", "god",
    "politic", "election", "government", "vote",
    "racist", "ethnic",
    "gender", "sexist", "sexual orientation", "orientation", "gay", "trans",
    "disab", "wheelchair",
    "salary", "wage", "income", "money problem", "debt", "bankrupt",
    "sick", "illness", "disease", "diagnos", "depress", "anxiety", "mental health",
    "stupid", "idiot", "dumb", "unintelligent",
    "fat", "ugly", "overweight", "bald",
    "elderly",
  ].join("|") + ")\\b",
  "i",
);

describe("12.7 banned-topic language scan", () => {
  test("no closing tease template contains banned-topic keywords", () => {
    const offenders = allTemplates().filter(t => BANNED_TOPIC_PATTERN.test(t.template));
    assert.deepEqual(offenders, []);
  });
});

// edition-engine.ts's own guard against future-fixture language — TKDL has
// no schedule, so nothing here may ever imply a specific upcoming game.
const FUTURE_MATCH_LANGUAGE_PATTERN = /\b(will (face|play|meet)|next (match|fixture|game)|upcoming (match|fixture|game)|is (scheduled|set) to (play|face)|forthcoming (match|fixture))\b/i;

describe("no future-fixture language", () => {
  test("no closing tease template implies a specific scheduled match", () => {
    const offenders = allTemplates().filter(t => FUTURE_MATCH_LANGUAGE_PATTERN.test(t.template));
    assert.deepEqual(offenders, []);
  });
});

describe("every placeholder belongs to its story type's own established fact set", () => {
  // Exactly commentary-library.ts's own *_REQUIRES constants for these
  // eight story types (plus each one's derived display-key convention:
  // an "...Id" fact also unlocks "...Name", an "...Ids" fact unlocks
  // "...NamesJoined", and a "...probability"-suffixed fact unlocks
  // "...ProbabilityPct" — the exact derivation commentary-engine.ts's own
  // buildTemplateFacts implements and commentary-library.test.ts's own
  // "template placeholders are always derivable from requires" describe
  // block already verifies for the main phrase library).
  const DERIVABLE_KEYS_BY_STORY_TYPE: Partial<Record<StoryType, readonly string[]>> = {
    NEW_LEADER: ["newLeaderEntityId", "newLeaderEntityName", "previousLeaderEntityId", "previousLeaderEntityName", "points"],
    LEAD_TIGHTENS: ["leaderEntityId", "leaderEntityName", "previousGap", "currentGap"],
    LEAD_WIDENS: ["leaderEntityId", "leaderEntityName", "previousGap", "currentGap"],
    NEW_FAVOURITE: ["newFavouriteEntityId", "newFavouriteEntityName", "previousFavouriteEntityId", "previousFavouriteEntityName", "probability", "probabilityPct"],
    DEAD_HEAT: ["firstEntityId", "firstEntityName", "firstProbability", "firstProbabilityPct", "secondEntityId", "secondEntityName", "secondProbability", "secondProbabilityPct"],
    TITLE_RACE: ["viableEntityIds", "viableEntityNamesJoined"],
    WIN_STREAK: ["playerId", "playerName", "currentWinStreak"],
    LOSS_STREAK: ["playerId", "playerName", "currentLossStreak"],
  };

  test("every {{placeholder}} in every template resolves to that story type's own derivable fact keys", () => {
    const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;
    const offenders: { storyType: string; template: string; unresolvable: string[] }[] = [];
    for (const [storyType, templates] of Object.entries(CLOSING_TEASE_TEMPLATES)) {
      const available = new Set(DERIVABLE_KEYS_BY_STORY_TYPE[storyType as StoryType] ?? []);
      for (const template of templates ?? []) {
        const placeholders = [...template.matchAll(PLACEHOLDER_PATTERN)].map(m => m[1]);
        const unresolvable = placeholders.filter(key => !available.has(key));
        if (unresolvable.length > 0) offenders.push({ storyType, template, unresolvable });
      }
    }
    assert.deepEqual(offenders, []);
  });
});
