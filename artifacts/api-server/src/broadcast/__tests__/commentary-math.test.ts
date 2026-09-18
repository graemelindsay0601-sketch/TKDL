/**
 * Tests for commentary-math.ts — the Commentary Engine's pure math
 * (handover doc section 12, plus 17.2's record-claim rule).
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  BLUEPRINTS, blueprintNamesForTreatment, resolveTurnsForTreatment, chooseBlueprint, commentaryRng,
  interpolateTemplate, templatePlaceholderKeys, MissingFactError,
  phraseFactsSatisfied, phraseTemplateSatisfiable, isPhraseOffCooldown, isPhraseEligible,
  containsRecordClaimLanguage, isRecordClaimCompliant, VERIFIED_RECORD_CLAIM_FACT_KEY,
  dialogueHoldSeconds, isNegativeBanterAllowed, shouldPreferCreditTemplate, toneMixReport,
  preferredPhrasesForMode, isConversationPhraseAvailable, isPhraseSafeForMode, formatCountedNoun,
  scalarIdNameKey, arrayIdNamesJoinedKey, probabilityPctKey,
  type Phrase,
} from "../commentary-math.ts";

describe("blueprintNamesForTreatment (12.6 turn-count targets)", () => {
  test("supporting only allows QUICK_HIT (its sole blueprint)", () => {
    assert.deepEqual(blueprintNamesForTreatment("supporting"), ["QUICK_HIT"]);
  });

  test("featured allows every 3-4 turn blueprint", () => {
    const names = blueprintNamesForTreatment("featured");
    assert.deepEqual([...names].sort(), ["AGREEMENT", "ANALYST_LEADS", "CALLBACK", "DISAGREEMENT", "PUNDIT_LEADS"]);
  });

  test("major allows a curated subset of longer blueprints", () => {
    assert.ok(blueprintNamesForTreatment("major").length > 0);
  });

  test("headline_ticker/archive fall back to QUICK_HIT rather than throwing", () => {
    assert.deepEqual(blueprintNamesForTreatment("headline_ticker"), ["QUICK_HIT"]);
    assert.deepEqual(blueprintNamesForTreatment("archive"), ["QUICK_HIT"]);
  });
});

describe("resolveTurnsForTreatment", () => {
  test("supporting (QUICK_HIT) yields exactly 3 turns (fact, reaction, and the required banter handoff)", () => {
    const turns = resolveTurnsForTreatment("supporting", BLUEPRINTS.QUICK_HIT);
    assert.equal(turns.length, 3);
    assert.deepEqual(turns.map(t => t.intent), ["quick_fact", "quick_reaction", "banter"]);
    // The banter turn is deliberately NOT optional (unlike, say,
    // ANALYST_LEADS's own closer) — an optional turn gets stripped for
    // every non-major/featured treatment right here in this function, and
    // Supporting is exactly the treatment this turn exists for. See
    // commentary-math.ts's own comment on BLUEPRINTS.QUICK_HIT.
    assert.equal(turns.every(t => !t.optional), true);
  });

  test("every exchange is explicitly shaped as setup, reaction/counterpoint, and a resolving beat", () => {
    for (const blueprint of Object.values(BLUEPRINTS)) {
      const beats = blueprint.turns.map(t => t.beat);
      assert.equal(beats[0], "setup", blueprint.name);
      assert.ok(beats.includes("reaction") || beats.includes("counterpoint"), blueprint.name);
      assert.ok(["counterpoint", "punchline", "handoff"].includes(beats.at(-1)!), blueprint.name);
    }
  });

  test("featured keeps a blueprint's own turn count including its optional turns, within [3,4]", () => {
    const turns = resolveTurnsForTreatment("featured", BLUEPRINTS.ANALYST_LEADS);
    assert.ok(turns.length >= 3 && turns.length <= 4);
  });

  test("major with a short (<4 turn) blueprint gets a QUICK_HIT coda appended, capped at 6", () => {
    const shortBlueprint = { name: "QUICK_HIT" as const, turns: BLUEPRINTS.QUICK_HIT.turns };
    const turns = resolveTurnsForTreatment("major", shortBlueprint);
    assert.ok(turns.length >= 4 && turns.length <= 6);
  });

  test("major with an already-4-turn blueprint doesn't grow further", () => {
    const turns = resolveTurnsForTreatment("major", BLUEPRINTS.DISAGREEMENT);
    assert.equal(turns.length, BLUEPRINTS.DISAGREEMENT.turns.length);
  });

  test("never exceeds 6 turns for major", () => {
    for (const name of Object.keys(BLUEPRINTS) as (keyof typeof BLUEPRINTS)[]) {
      assert.ok(resolveTurnsForTreatment("major", BLUEPRINTS[name]).length <= 6);
    }
  });
});

describe("commentaryRng / chooseBlueprint (12.5 determinism)", () => {
  test("same (slotKey, storyKey, commentaryVersion) picks the same blueprint every time", () => {
    const names = ["ANALYST_LEADS", "PUNDIT_LEADS", "AGREEMENT"] as const;
    const a = chooseBlueprint(names, commentaryRng("2026-09-02:evening", "key1", 1));
    const b = chooseBlueprint(names, commentaryRng("2026-09-02:evening", "key1", 1));
    assert.equal(a, b);
  });

  test("a different storyKey can pick a different blueprint", () => {
    const names = ["ANALYST_LEADS", "PUNDIT_LEADS", "AGREEMENT", "DISAGREEMENT", "CALLBACK"] as const;
    const picks = new Set<string>();
    for (let i = 0; i < 30; i++) {
      picks.add(chooseBlueprint(names, commentaryRng("2026-09-02:evening", `key${i}`, 1)));
    }
    assert.ok(picks.size > 1, "expected variety across many different storyKeys");
  });
});

describe("interpolateTemplate (17.1 fact firewall)", () => {
  test("substitutes a present key", () => {
    assert.equal(interpolateTemplate("{{winnerName}} won it", { winnerName: "Alex" }), "Alex won it");
  });

  test("throws MissingFactError for a key not present in facts", () => {
    assert.throws(() => interpolateTemplate("{{winnerName}} won it", {}), MissingFactError);
  });

  test("throws for a null or undefined fact value, even if the key exists in the object", () => {
    assert.throws(() => interpolateTemplate("{{x}}", { x: null as unknown as string }), MissingFactError);
  });

  test("handles multiple distinct placeholders", () => {
    assert.equal(
      interpolateTemplate("{{a}} beat {{b}} {{a}} again", { a: "Alex", b: "Mick" }),
      "Alex beat Mick Alex again",
    );
  });

  test("a template with no placeholders passes through unchanged", () => {
    assert.equal(interpolateTemplate("plain text", {}), "plain text");
  });
});

describe("templatePlaceholderKeys", () => {
  test("extracts every distinct key referenced", () => {
    assert.deepEqual(templatePlaceholderKeys("{{a}} and {{b}} and {{a}} again"), ["a", "b", "a"]);
  });

  test("empty for a template with no placeholders", () => {
    assert.deepEqual(templatePlaceholderKeys("no placeholders here"), []);
  });
});

function phrase(overrides: Partial<Phrase> = {}): Phrase {
  return {
    id: "p1", speaker: "A", intent: "fact", template: "{{winnerName}} won it",
    sentiment: "neutral", cooldownEditions: 2,
    ...overrides,
  };
}

describe("phraseFactsSatisfied", () => {
  test("no requires/forbids -> always satisfied", () => {
    assert.equal(phraseFactsSatisfied(phrase(), new Set()), true);
  });

  test("a missing required key fails", () => {
    assert.equal(phraseFactsSatisfied(phrase({ requires: ["stake"] }), new Set(["winnerName"])), false);
  });

  test("a present required key passes", () => {
    assert.equal(phraseFactsSatisfied(phrase({ requires: ["stake"] }), new Set(["stake"])), true);
  });

  test("a present forbidden key fails", () => {
    assert.equal(phraseFactsSatisfied(phrase({ forbids: ["isEliminated"] }), new Set(["isEliminated"])), false);
  });

  test("an absent forbidden key passes", () => {
    assert.equal(phraseFactsSatisfied(phrase({ forbids: ["isEliminated"] }), new Set(["winnerName"])), true);
  });
});

describe("phraseTemplateSatisfiable", () => {
  test("fails when a template placeholder has no matching fact key", () => {
    assert.equal(phraseTemplateSatisfiable(phrase(), new Set()), false);
  });

  test("passes when every placeholder is covered", () => {
    assert.equal(phraseTemplateSatisfiable(phrase(), new Set(["winnerName"])), true);
  });
});

describe("isPhraseOffCooldown", () => {
  test("never used before (null) is always off cooldown", () => {
    assert.equal(isPhraseOffCooldown(phrase({ cooldownEditions: 5 }), null), true);
  });

  test("fewer editions than cooldownEditions -> still on cooldown", () => {
    assert.equal(isPhraseOffCooldown(phrase({ cooldownEditions: 5 }), 2), false);
  });

  test("exactly cooldownEditions editions -> off cooldown", () => {
    assert.equal(isPhraseOffCooldown(phrase({ cooldownEditions: 5 }), 5), true);
  });
});

describe("isPhraseEligible", () => {
  test("all conditions must hold at once", () => {
    const p = phrase({ speaker: "A", intent: "fact", requires: ["stake"], cooldownEditions: 2 });
    assert.equal(isPhraseEligible({
      phrase: p, turnSpeaker: "A", turnIntent: "fact",
      availableFactKeys: new Set(["winnerName", "stake"]), editionsSinceLastUse: null,
    }), true);
  });

  test("wrong speaker fails even if everything else matches", () => {
    const p = phrase({ speaker: "A", intent: "fact" });
    assert.equal(isPhraseEligible({
      phrase: p, turnSpeaker: "B", turnIntent: "fact",
      availableFactKeys: new Set(["winnerName"]), editionsSinceLastUse: null,
    }), false);
  });

  test("wrong intent fails", () => {
    const p = phrase({ speaker: "A", intent: "fact" });
    assert.equal(isPhraseEligible({
      phrase: p, turnSpeaker: "A", turnIntent: "reaction",
      availableFactKeys: new Set(["winnerName"]), editionsSinceLastUse: null,
    }), false);
  });

  test("still on cooldown fails", () => {
    const p = phrase({ cooldownEditions: 3 });
    assert.equal(isPhraseEligible({
      phrase: p, turnSpeaker: "A", turnIntent: "fact",
      availableFactKeys: new Set(["winnerName"]), editionsSinceLastUse: 1,
    }), false);
  });
});

describe("format energy and in-exchange cooldowns", () => {
  const measured = phrase({ id: "measured", tone: "commentary" });
  const warm = phrase({ id: "warm", tone: "personality" });
  const funny = phrase({ id: "funny", tone: "humour" });

  test("NEWS prefers measured commentary while MAGAZINE prefers chemistry", () => {
    assert.deepEqual(preferredPhrasesForMode([warm, measured, funny], "NEWS").map(p => p.id), ["measured"]);
    assert.deepEqual(preferredPhrasesForMode([warm, measured, funny], "MAGAZINE").map(p => p.id), ["warm", "funny"]);
  });

  test("format preference falls back rather than dropping a valid turn", () => {
    assert.deepEqual(preferredPhrasesForMode([warm], "NEWS").map(p => p.id), ["warm"]);
    assert.deepEqual(preferredPhrasesForMode([measured], "MAGAZINE").map(p => p.id), ["measured"]);
  });

  test("SEASON_REVIEW excludes language that makes historical results sound live", () => {
    for (const template of [
      "A result for Richard tonight.",
      "Sean is flying right now.",
      "Nobody can touch him at the minute.",
      "This week changed everything.",
      "Five straight wins and counting.",
      "Give it another fortnight.",
      "There is plenty brewing at the bottom.",
    ]) {
      assert.equal(isPhraseSafeForMode(phrase({ template }), "SEASON_REVIEW"), false);
    }
    assert.equal(isPhraseSafeForMode(phrase({ template: "That result changed the season." }), "SEASON_REVIEW"), true);
    assert.equal(isPhraseSafeForMode(phrase({ template: "A result tonight." }), "NEWS"), true);
    assert.equal(isPhraseSafeForMode(phrase({ template: "A result tonight." }), "NEWS", true), false);
    assert.equal(isPhraseSafeForMode(phrase({ template: "That's the fun of live sport." }), "BALANCED", true), false);
  });

  test("counted nouns use singular grammar at one and plural grammar otherwise", () => {
    assert.equal(formatCountedNoun(1, "loss", "losses"), "1 loss");
    assert.equal(formatCountedNoun(2, "loss", "losses"), "2 losses");
    assert.equal(formatCountedNoun("1", "loss", "losses"), null);
  });

  test("the same phrase cannot repeat within one exchange", () => {
    assert.equal(isConversationPhraseAvailable(measured, new Set(["measured"]), 0), false);
  });

  test("a player/team cannot receive two negative lines in one exchange", () => {
    const negative = phrase({ id: "negative", sentiment: "negative" });
    assert.equal(isConversationPhraseAvailable(negative, new Set(), 0), true);
    assert.equal(isConversationPhraseAvailable(negative, new Set(), 1), false);
    assert.equal(isConversationPhraseAvailable(measured, new Set(), 1), true);
  });
});

describe("containsRecordClaimLanguage / isRecordClaimCompliant (17.2)", () => {
  test("detects each banned-without-verification word", () => {
    for (const word of ["first", "best", "worst", "record", "ever", "highest", "lowest", "career-best"]) {
      assert.equal(containsRecordClaimLanguage(`this is the ${word} one`), true, word);
    }
  });

  test("case-insensitive", () => {
    assert.equal(containsRecordClaimLanguage("a BEST performance"), true);
  });

  test("plain factual language with none of those words is unaffected", () => {
    assert.equal(containsRecordClaimLanguage("{{winnerName}} won by a wide margin"), false);
  });

  test("a record-claim phrase WITHOUT the verified-record requirement is non-compliant", () => {
    const p = phrase({ template: "{{playerName}}'s best scoring match yet" });
    assert.equal(isRecordClaimCompliant(p), false);
  });

  test("a record-claim phrase WITH the verified-record requirement is compliant", () => {
    const p = phrase({ template: "{{playerName}}'s best scoring match yet", requires: [VERIFIED_RECORD_CLAIM_FACT_KEY] });
    assert.equal(isRecordClaimCompliant(p), true);
  });

  test("a plain phrase with no record-claim language is compliant regardless of requires", () => {
    assert.equal(isRecordClaimCompliant(phrase({ template: "{{winnerName}} took it in style" })), true);
  });
});

describe("dialogueHoldSeconds (12.6)", () => {
  test("clamps to a minimum of 3.5 seconds for very short text", () => {
    assert.equal(dialogueHoldSeconds("Hi"), 3.5);
  });

  test("clamps to a maximum of 9.0 seconds for very long text", () => {
    const longText = Array.from({ length: 100 }, () => "word").join(" ");
    assert.equal(dialogueHoldSeconds(longText), 9.0);
  });

  test("matches the documented formula for a mid-length line", () => {
    const text = Array.from({ length: 16 }, () => "word").join(" "); // 16 words
    const expected = 1.2 + 16 / 3.2; // = 6.2
    assert.ok(Math.abs(dialogueHoldSeconds(text) - expected) < 1e-9);
  });
});

describe("isNegativeBanterAllowed (12.7)", () => {
  const clean = {
    candidateSentiment: "negative" as const,
    negativeJokesAlreadyThisEditionForSubject: 0,
    fullSegmentsSinceLastNegativeJokeForSubject: null,
    editionsSinceLastNegativeJokeForSubject: null,
  };

  test("non-negative sentiment is always allowed", () => {
    assert.equal(isNegativeBanterAllowed({ ...clean, candidateSentiment: "positive" }), true);
    assert.equal(isNegativeBanterAllowed({ ...clean, candidateSentiment: "neutral" }), true);
  });

  test("a clean slate (never joked about this subject) is allowed", () => {
    assert.equal(isNegativeBanterAllowed(clean), true);
  });

  test("already one negative joke this Edition blocks a second", () => {
    assert.equal(isNegativeBanterAllowed({ ...clean, negativeJokesAlreadyThisEditionForSubject: 1 }), false);
  });

  test("fewer than 4 full segments since the last negative joke blocks another", () => {
    assert.equal(isNegativeBanterAllowed({ ...clean, fullSegmentsSinceLastNegativeJokeForSubject: 2 }), false);
    assert.equal(isNegativeBanterAllowed({ ...clean, fullSegmentsSinceLastNegativeJokeForSubject: 4 }), true);
  });

  test("fewer than 1 Edition since the last negative joke blocks another", () => {
    assert.equal(isNegativeBanterAllowed({ ...clean, editionsSinceLastNegativeJokeForSubject: 0 }), false);
    assert.equal(isNegativeBanterAllowed({ ...clean, editionsSinceLastNegativeJokeForSubject: 1 }), true);
  });
});

describe("shouldPreferCreditTemplate", () => {
  test("true only when both a recent negative story AND material improvement hold", () => {
    assert.equal(shouldPreferCreditTemplate({ subjectHadRecentNegativeStory: true, candidateMaterialImprovement: true }), true);
    assert.equal(shouldPreferCreditTemplate({ subjectHadRecentNegativeStory: true, candidateMaterialImprovement: false }), false);
    assert.equal(shouldPreferCreditTemplate({ subjectHadRecentNegativeStory: false, candidateMaterialImprovement: true }), false);
  });
});

describe("toneMixReport", () => {
  test("empty input reports all zeros", () => {
    assert.deepEqual(toneMixReport([]), { commentary: 0, humour: 0, personality: 0 });
  });

  test("computes exact shares matching the 70/20/10 target shape", () => {
    const tones = [
      ...Array(7).fill("commentary" as const),
      ...Array(2).fill("humour" as const),
      ...Array(1).fill("personality" as const),
    ];
    const report = toneMixReport(tones);
    assert.ok(Math.abs(report.commentary - 0.7) < 1e-9);
    assert.ok(Math.abs(report.humour - 0.2) < 1e-9);
    assert.ok(Math.abs(report.personality - 0.1) < 1e-9);
  });
});

describe("scalarIdNameKey (name-resolution convention)", () => {
  test("a scalar id key resolves to its Name counterpart", () => {
    assert.equal(scalarIdNameKey("winnerId"), "winnerName");
    assert.equal(scalarIdNameKey("loserId"), "loserName");
    assert.equal(scalarIdNameKey("subjectId"), "subjectName");
  });

  test("a non-id-shaped key passes through as null (already display-ready)", () => {
    assert.equal(scalarIdNameKey("stake"), null);
    assert.equal(scalarIdNameKey("points"), null);
    assert.equal(scalarIdNameKey("streakLength"), null);
  });

  test("a plural Ids key is not matched by the scalar rule", () => {
    assert.equal(scalarIdNameKey("tiedEntityIds"), null);
    assert.equal(scalarIdNameKey("viableEntityIds"), null);
  });

  test("seasonId/matchId are internal row references, not entity references — never resolved to a name", () => {
    assert.equal(scalarIdNameKey("seasonId"), null);
    assert.equal(scalarIdNameKey("matchId"), null);
    assert.equal(scalarIdNameKey("anchorMatchId"), null);
    assert.equal(scalarIdNameKey("lastMeetingMatchId"), null);
  });
});

describe("arrayIdNamesJoinedKey (name-resolution convention)", () => {
  test("a plural id-array key resolves to its NamesJoined counterpart", () => {
    assert.equal(arrayIdNamesJoinedKey("tiedEntityIds"), "tiedEntityNamesJoined");
    assert.equal(arrayIdNamesJoinedKey("viableEntityIds"), "viableEntityNamesJoined");
  });

  test("a scalar id key is not matched by the array rule", () => {
    assert.equal(arrayIdNamesJoinedKey("winnerId"), null);
    assert.equal(arrayIdNamesJoinedKey("loserId"), null);
  });

  test("a non-id key passes through as null", () => {
    assert.equal(arrayIdNamesJoinedKey("stake"), null);
  });
});

describe("probabilityPctKey (percentage-display convenience)", () => {
  test("a Probability-suffixed key gets a Pct counterpart", () => {
    assert.equal(probabilityPctKey("winnerProbability"), "winnerProbabilityPct");
    assert.equal(probabilityPctKey("titleProbability"), "titleProbabilityPct");
  });

  test("the bare 'probability' key (LEAGUE's NEW_FAVOURITE) also resolves, case-insensitively", () => {
    assert.equal(probabilityPctKey("probability"), "probabilityPct");
  });

  test("a non-probability key passes through as null", () => {
    assert.equal(probabilityPctKey("stake"), null);
    assert.equal(probabilityPctKey("winnerId"), null);
  });
});
