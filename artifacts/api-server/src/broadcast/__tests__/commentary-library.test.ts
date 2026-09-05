/**
 * Library-validation tests for commentary-library.ts. These are the
 * mechanical checks this file's own header promises: every Appendix A v1
 * story type is covered, every phrase is 17.2 record-claim compliant, every
 * phrase avoids 12.7's banned-topic language, and — the check that would
 * have caught a real bug during authoring (NEW_FAVOURITE's bare
 * "probability" key not resolving to "probabilityPct" until
 * commentary-math.ts's probabilityPctKey was made case-insensitive) — every
 * template placeholder a phrase uses is actually derivable from that
 * phrase's own declared `requires`, so a phrase can never reach production
 * silently unable to interpolate.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isRecordClaimCompliant, templatePlaceholderKeys,
  scalarIdNameKey, arrayIdNamesJoinedKey, probabilityPctKey, COUNTED_LOSS_FACT_KEYS,
  type Phrase,
} from "../commentary-math.ts";
import { COMMENTARY_LIBRARY, UNIVERSAL_CALLBACK_PHRASES, UNIVERSAL_BANTER_PHRASES, allLibraryPhrases } from "../commentary-library.ts";
import {
  RESULT_STORY_TYPES, FORM_STORY_TYPES, H2H_STORY_TYPES, PERFORMANCE_STORY_TYPES,
  LEAGUE_STORY_TYPES, MILESTONE_STORY_TYPES, DOUBLES_STORY_TYPES, SHIFT_WARS_STORY_TYPES,
  ARCHIVE_STORY_TYPES, FILLER_STORY_TYPES, type StoryType,
} from "../story-types.ts";

const ALL_STORY_TYPES: readonly StoryType[] = [
  ...RESULT_STORY_TYPES, ...FORM_STORY_TYPES, ...H2H_STORY_TYPES, ...PERFORMANCE_STORY_TYPES,
  ...LEAGUE_STORY_TYPES, ...MILESTONE_STORY_TYPES, ...DOUBLES_STORY_TYPES, ...SHIFT_WARS_STORY_TYPES,
  ...ARCHIVE_STORY_TYPES,
  // FILLER postdates Appendix A's own v1 catalogue (story-types.ts's own
  // header), which is why it's listed separately from the rest rather than
  // folded silently into one of the families above — but it's real,
  // user-facing dialogue content once wired into story-engine.ts, so it
  // gets the exact same coverage guarantee as everything else here rather
  // than staying a silent exception forever.
  ...FILLER_STORY_TYPES,
];

describe("COMMENTARY_LIBRARY coverage", () => {
  test("every Appendix A v1 story type (plus FILLER) has at least one phrase", () => {
    const missing = ALL_STORY_TYPES.filter(t => !COMMENTARY_LIBRARY[t] || COMMENTARY_LIBRARY[t]!.length === 0);
    assert.deepEqual(missing, []);
  });

  test("every covered story type has at least one A-speaker and one B-speaker phrase (both blueprint sides get a voice)", () => {
    const oneSided = ALL_STORY_TYPES.filter(t => {
      const phrases = COMMENTARY_LIBRARY[t] ?? [];
      return !phrases.some(p => p.speaker === "A") || !phrases.some(p => p.speaker === "B");
    });
    assert.deepEqual(oneSided, []);
  });

  test("every covered story type includes a QUICK_HIT pair (quick_fact + quick_reaction) — Supporting treatment's only blueprint", () => {
    const missingQuickHit = ALL_STORY_TYPES.filter(t => {
      const phrases = COMMENTARY_LIBRARY[t] ?? [];
      return !phrases.some(p => p.intent === "quick_fact") || !phrases.some(p => p.intent === "quick_reaction");
    });
    assert.deepEqual(missingQuickHit, []);
  });
});

describe("17.2 record-claim compliance", () => {
  test("every phrase in the library is record-claim compliant", () => {
    const nonCompliant = allLibraryPhrases().filter(p => !isRecordClaimCompliant(p)).map(p => p.id);
    assert.deepEqual(nonCompliant, []);
  });
});

// 12.7: "Never reference appearance, age, intelligence, health, family,
// relationships, religion, politics, race, gender, sexuality, disability,
// job performance, finance, sickness/absence or non-TKDL personal
// information." A literal keyword scan can't verify semantic intent, but it
// mechanically catches the obvious failure mode — the same "mechanically
// enforced, not just documented" standard the fact firewall and record-
// claim rule hold themselves to elsewhere in this file.
//
// Two of 12.7's own category names are also completely ordinary darts-
// commentary vocabulary, so their bare form is deliberately left OUT of
// this scan rather than producing permanent false positives: "race" (every
// "title race"/"dead heat" phrase in this library uses the competition
// sense, never the ethnicity sense — verified by hand across every current
// occurrence) and "straight" (used throughout only as "N straight
// wins/losses," never as a reference to sexual orientation). Both are
// still covered by their unambiguous relatives below (racist/ethnic;
// sexuality/orientation) — if a future phrase ever needs "race" or
// "straight" in a genuinely banned sense, only a human review of new
// phrases catches that, same as any other subtle wording choice a keyword
// scan can't fully replace.
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
  test("no phrase template contains banned-topic keywords", () => {
    const offenders = allLibraryPhrases()
      .filter(p => BANNED_TOPIC_PATTERN.test(p.template))
      .map(p => ({ id: p.id, match: p.template.match(BANNED_TOPIC_PATTERN)?.[0] }));
    assert.deepEqual(offenders, []);
  });
});

describe("template placeholders are always derivable from `requires`", () => {
  function derivableKeysFrom(requires: readonly string[]): Set<string> {
    const keys = new Set<string>(requires);
    const countedLossKeys = new Set<string>(COUNTED_LOSS_FACT_KEYS);
    for (const key of requires) {
      const name = scalarIdNameKey(key);
      if (name) keys.add(name);
      const namesJoined = arrayIdNamesJoinedKey(key);
      if (namesJoined) keys.add(namesJoined);
      const pct = probabilityPctKey(key);
      if (pct) keys.add(pct);
      if (countedLossKeys.has(key)) keys.add(`${key}Label`);
    }
    return keys;
  }

  test("every placeholder in every phrase's template is satisfiable from that phrase's own `requires`", () => {
    const offenders: { id: string; unresolvable: string[] }[] = [];
    for (const phrase of allLibraryPhrases()) {
      const available = derivableKeysFrom(phrase.requires ?? []);
      const unresolvable = templatePlaceholderKeys(phrase.template).filter(key => !available.has(key));
      if (unresolvable.length > 0) offenders.push({ id: phrase.id, unresolvable });
    }
    assert.deepEqual(offenders, []);
  });
});

describe("phrase id uniqueness", () => {
  test("no two phrases in the library share an id", () => {
    const ids = allLibraryPhrases().map(p => p.id);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(duplicates, []);
  });
});

describe("UNIVERSAL_CALLBACK_PHRASES", () => {
  test("covers all three CALLBACK turns (callback_reference, admit_or_defend, current_evidence)", () => {
    const intents = new Set(UNIVERSAL_CALLBACK_PHRASES.map((p: Phrase) => p.intent));
    assert.ok(intents.has("callback_reference"));
    assert.ok(intents.has("admit_or_defend"));
    assert.ok(intents.has("current_evidence"));
  });
});

describe("UNIVERSAL_BANTER_PHRASES (QUICK_HIT's required 3rd turn)", () => {
  test("every phrase is speaker A, intent banter — matching BLUEPRINTS.QUICK_HIT's 3rd turn exactly", () => {
    assert.ok(UNIVERSAL_BANTER_PHRASES.length > 0);
    for (const p of UNIVERSAL_BANTER_PHRASES) {
      assert.equal(p.speaker, "A");
      assert.equal(p.intent, "banter");
    }
  });

  test("no phrase declares `requires` — this turn must be eligible for every story type, with zero facts", () => {
    const withRequires = UNIVERSAL_BANTER_PHRASES.filter(p => p.requires && p.requires.length > 0);
    assert.deepEqual(withRequires.map(p => p.id), []);
  });

  test("never negative sentiment — this turn talks about the show, not any one result", () => {
    const negative = UNIVERSAL_BANTER_PHRASES.filter(p => p.sentiment === "negative");
    assert.deepEqual(negative.map(p => p.id), []);
  });

  test("at least one non-humour phrase survives broadcast_banter_level 0 (eligiblePhrasesForTurn drops humour+negative there) — QUICK_HIT is Supporting's only blueprint and this turn is required, so an all-humour pool would silently drop every Supporting segment's dialogue at the quieter setting", () => {
    const nonHumour = UNIVERSAL_BANTER_PHRASES.filter(p => p.tone !== "humour");
    assert.ok(nonHumour.length > 0);
  });
});
