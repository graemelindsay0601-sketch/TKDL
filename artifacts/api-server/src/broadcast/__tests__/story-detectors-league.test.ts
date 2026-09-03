/**
 * Tests for story-detectors-league.ts — the LEAGUE family (Appendix A /
 * section 9.4): NEW_LEADER, LEAD_TIGHTENS, LEAD_WIDENS, TITLE_SWING,
 * NEW_FAVOURITE, DEAD_HEAT, TITLE_RACE, CHAMPION, TIE_PENDING. Cross-league
 * — every detector takes a `leagueType` and every test exercises it
 * generically (a couple of tests specifically check TIE_PENDING's
 * Singles-only restriction).
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  detectNewLeader,
  detectLeadTightens,
  detectLeadWidens,
  detectTitleSwing,
  detectNewFavourite,
  detectDeadHeat,
  detectTitleRace,
  detectChampion,
  detectTiePending,
  detectSeasonKickoff,
  detectSeasonRecap,
  detectLeagueStories,
  type LeagueStandingsFacts,
  type LeagueEntityStanding,
  type SeasonRecapFacts,
} from "../story-detectors-league.ts";

function entity(overrides: Partial<LeagueEntityStanding> = {}): LeagueEntityStanding {
  return { entityId: 1, points: 25, titleProbability: 0.25, isEliminated: false, ...overrides };
}

function baseFacts(overrides: Partial<LeagueStandingsFacts> = {}): LeagueStandingsFacts {
  return {
    leagueType: "singles",
    seasonId: 1,
    current: [
      entity({ entityId: 1, points: 30, titleProbability: 0.4 }),
      entity({ entityId: 2, points: 25, titleProbability: 0.3 }),
      entity({ entityId: 3, points: 20, titleProbability: 0.2 }),
    ],
    previous: [
      entity({ entityId: 1, points: 28, titleProbability: 0.4 }),
      entity({ entityId: 2, points: 25, titleProbability: 0.3 }),
      entity({ entityId: 3, points: 20, titleProbability: 0.2 }),
    ],
    singlesTiePending: false,
    seasonJustEnded: false,
    championEntityId: null,
    seasonJustStarted: false,
    seasonName: "September 2026",
    ...overrides,
  };
}

describe("detectNewLeader (9.4: points leader changes)", () => {
  test("no previous snapshot -> nothing to compare, no trigger", () => {
    assert.deepEqual(detectNewLeader(baseFacts({ previous: null })), []);
  });

  test("same leader in both snapshots does not trigger", () => {
    assert.deepEqual(detectNewLeader(baseFacts()), []);
  });

  test("leader changes -> triggers, naming both entities", () => {
    const facts = baseFacts({
      current: [entity({ entityId: 2, points: 40 }), entity({ entityId: 1, points: 30 })],
      previous: [entity({ entityId: 1, points: 28 }), entity({ entityId: 2, points: 25 })],
    });
    const stories = detectNewLeader(facts);
    assert.equal(stories.length, 1);
    assert.equal(stories[0].facts.newLeaderEntityId, 2);
    assert.equal(stories[0].facts.previousLeaderEntityId, 1);
  });

  test("leagueType flows through to the story for a team league", () => {
    const stories = detectNewLeader(baseFacts({
      leagueType: "doubles",
      current: [entity({ entityId: 2, points: 40 }), entity({ entityId: 1, points: 30 })],
      previous: [entity({ entityId: 1, points: 28 }), entity({ entityId: 2, points: 25 })],
    }));
    assert.equal(stories[0].leagueType, "doubles");
    assert.deepEqual(stories[0].subjectKeys.sort(), ["doubles:1", "doubles:2"]);
  });
});

describe("detectLeadTightens / detectLeadWidens (Appendix A: top gap materially changes)", () => {
  test("gap unchanged triggers neither", () => {
    const facts = baseFacts({
      current: [entity({ entityId: 1, points: 30 }), entity({ entityId: 2, points: 25 })],
      previous: [entity({ entityId: 1, points: 28 }), entity({ entityId: 2, points: 23 })],
    });
    assert.deepEqual(detectLeadTightens(facts), []);
    assert.deepEqual(detectLeadWidens(facts), []);
  });

  test("gap shrinks materially -> LEAD_TIGHTENS only", () => {
    const facts = baseFacts({
      current: [entity({ entityId: 1, points: 30 }), entity({ entityId: 2, points: 29 })], // gap 1
      previous: [entity({ entityId: 1, points: 30 }), entity({ entityId: 2, points: 24 })], // gap 6
    });
    assert.equal(detectLeadTightens(facts).length, 1);
    assert.deepEqual(detectLeadWidens(facts), []);
  });

  test("gap grows materially -> LEAD_WIDENS only", () => {
    const facts = baseFacts({
      current: [entity({ entityId: 1, points: 35 }), entity({ entityId: 2, points: 25 })], // gap 10
      previous: [entity({ entityId: 1, points: 30 }), entity({ entityId: 2, points: 28 })], // gap 2
    });
    assert.deepEqual(detectLeadTightens(facts), []);
    assert.equal(detectLeadWidens(facts).length, 1);
  });

  test("fewer than two non-eliminated entities means no gap to measure", () => {
    const facts = baseFacts({
      current: [entity({ entityId: 1, points: 30 }), entity({ entityId: 2, points: 25, isEliminated: true })],
      previous: [entity({ entityId: 1, points: 28 }), entity({ entityId: 2, points: 25 })],
    });
    assert.deepEqual(detectLeadTightens(facts), []);
    assert.deepEqual(detectLeadWidens(facts), []);
  });
});

describe("detectTitleSwing (9.4: probability moves >=10pp since previous Edition)", () => {
  test("small moves for every entity trigger nothing", () => {
    assert.deepEqual(detectTitleSwing(baseFacts()), []);
  });

  test("one entity swings >=10pp -> one candidate for that entity", () => {
    const facts = baseFacts({
      current: [entity({ entityId: 1, titleProbability: 0.55 }), entity({ entityId: 2, titleProbability: 0.20 })],
      previous: [entity({ entityId: 1, titleProbability: 0.40 }), entity({ entityId: 2, titleProbability: 0.20 })],
    });
    const stories = detectTitleSwing(facts);
    assert.equal(stories.length, 1);
    assert.equal(stories[0].facts.entityId, 1);
    assert.equal(stories[0].sentiment, "positive");
  });

  test("two entities both swing >=10pp in the same Edition -> two independent candidates", () => {
    const facts = baseFacts({
      current: [entity({ entityId: 1, titleProbability: 0.55 }), entity({ entityId: 2, titleProbability: 0.10 })],
      previous: [entity({ entityId: 1, titleProbability: 0.40 }), entity({ entityId: 2, titleProbability: 0.25 })],
    });
    const stories = detectTitleSwing(facts);
    assert.equal(stories.length, 2);
  });

  test("a drop of >=10pp is negative-leaning (neutral), not positive", () => {
    const facts = baseFacts({
      current: [entity({ entityId: 1, titleProbability: 0.20 })],
      previous: [entity({ entityId: 1, titleProbability: 0.40 })],
    });
    const stories = detectTitleSwing(facts);
    assert.equal(stories[0].sentiment, "neutral");
  });

  test("an entity with no prior snapshot entry (newly appeared) is skipped, not treated as an infinite swing", () => {
    const facts = baseFacts({
      current: [entity({ entityId: 1 }), entity({ entityId: 99, titleProbability: 0.5 })],
      previous: [entity({ entityId: 1 })],
    });
    const stories = detectTitleSwing(facts);
    assert.equal(stories.find(s => s.facts.entityId === 99), undefined);
  });
});

describe("detectNewFavourite (9.4: highest title-probability entity changes)", () => {
  test("same favourite in both snapshots does not trigger", () => {
    assert.deepEqual(detectNewFavourite(baseFacts()), []);
  });

  test("favourite changes -> triggers", () => {
    const facts = baseFacts({
      current: [entity({ entityId: 1, titleProbability: 0.3 }), entity({ entityId: 2, titleProbability: 0.5 })],
      previous: [entity({ entityId: 1, titleProbability: 0.5 }), entity({ entityId: 2, titleProbability: 0.3 })],
    });
    const stories = detectNewFavourite(facts);
    assert.equal(stories.length, 1);
    assert.equal(stories[0].facts.newFavouriteEntityId, 2);
  });
});

describe("detectDeadHeat (9.4: top two title probabilities within 5 points)", () => {
  test("a clear gap at the top does not trigger", () => {
    const facts = baseFacts({ current: [entity({ entityId: 1, titleProbability: 0.6 }), entity({ entityId: 2, titleProbability: 0.3 })] });
    assert.deepEqual(detectDeadHeat(facts), []);
  });

  test("top two within 5 points triggers", () => {
    const facts = baseFacts({ current: [entity({ entityId: 1, titleProbability: 0.42 }), entity({ entityId: 2, titleProbability: 0.40 })] });
    const stories = detectDeadHeat(facts);
    assert.equal(stories.length, 1);
  });

  test("fewer than two entities cannot be a dead heat", () => {
    assert.deepEqual(detectDeadHeat(baseFacts({ current: [entity({ entityId: 1 })] })), []);
  });
});

describe("detectTitleRace (Appendix A: multiple viable entities)", () => {
  test("only one viable entity does not trigger", () => {
    const facts = baseFacts({ current: [entity({ entityId: 1, titleProbability: 0.8 }), entity({ entityId: 2, titleProbability: 0.02 })] });
    assert.deepEqual(detectTitleRace(facts), []);
  });

  test("two or more viable entities triggers, naming all of them as subjects", () => {
    const facts = baseFacts({
      current: [
        entity({ entityId: 1, titleProbability: 0.4 }),
        entity({ entityId: 2, titleProbability: 0.3 }),
        entity({ entityId: 3, titleProbability: 0.02 }),
      ],
    });
    const stories = detectTitleRace(facts);
    assert.equal(stories.length, 1);
    assert.deepEqual(stories[0].facts.viableEntityIds, [1, 2]);
  });
});

describe("detectChampion (Appendix A: official season champion state)", () => {
  test("season not yet ended does not trigger", () => {
    assert.deepEqual(detectChampion(baseFacts({ seasonJustEnded: false, championEntityId: 1 })), []);
  });

  test("season ended with a champion triggers", () => {
    const stories = detectChampion(baseFacts({ seasonJustEnded: true, championEntityId: 1 }));
    assert.equal(stories.length, 1);
    assert.equal(stories[0].components.competitiveImportance, 25);
  });

  test("carries the season name through to facts — several champions from different months must be tellable apart", () => {
    const stories = detectChampion(baseFacts({ seasonJustEnded: true, championEntityId: 1, seasonName: "March 2026" }));
    assert.equal(stories[0].facts.seasonName, "March 2026");
  });
});

function recapFacts(overrides: Partial<SeasonRecapFacts> = {}): SeasonRecapFacts {
  return { leagueType: "singles", seasonId: 1, seasonName: "March 2026", matchesPlayed: 12, topEntityId: 1, topWins: 5, ...overrides };
}

describe("detectSeasonRecap (a real look-back at the season that just closed)", () => {
  test("no matches played means nothing real to recap — No Fake Urgency", () => {
    assert.deepEqual(detectSeasonRecap(recapFacts({ matchesPlayed: 0, topEntityId: null, topWins: 0 })), []);
  });

  test("real matches played triggers, carrying the season's own numbers through to facts", () => {
    const stories = detectSeasonRecap(recapFacts());
    assert.equal(stories.length, 1);
    assert.equal(stories[0].facts.matchesPlayed, 12);
    assert.equal(stories[0].facts.topEntityId, 1);
    assert.equal(stories[0].facts.topWins, 5);
    assert.equal(stories[0].facts.seasonName, "March 2026");
  });

  test("CHAMPION still outscores its own recap — the outcome matters more than the summary of how it happened", () => {
    const championStories = detectChampion(baseFacts({ seasonJustEnded: true, championEntityId: 1 }));
    const recapStories = detectSeasonRecap(recapFacts());
    assert.ok(championStories[0].components.competitiveImportance > recapStories[0].components.competitiveImportance);
  });
});

describe("detectSeasonKickoff (a fresh season just began)", () => {
  test("season not just started does not trigger", () => {
    assert.deepEqual(detectSeasonKickoff(baseFacts({ seasonJustStarted: false })), []);
  });

  test("season just started triggers, carrying the season name and entrant count", () => {
    const facts = baseFacts({ seasonJustStarted: true, seasonName: "September 2026" });
    const stories = detectSeasonKickoff(facts);
    assert.equal(stories.length, 1);
    assert.equal(stories[0].facts.seasonName, "September 2026");
    assert.equal(stories[0].facts.entrantCount, facts.current.length);
    assert.deepEqual(stories[0].subjectKeys, []); // about the season itself, not any one entity
  });
});

describe("detectTiePending (Appendix A: Singles points tie requiring official tiebreak)", () => {
  test("not Singles -> never triggers, even with singlesTiePending true", () => {
    const facts = baseFacts({ leagueType: "doubles", singlesTiePending: true });
    assert.deepEqual(detectTiePending(facts), []);
  });

  test("Singles but no tie pending does not trigger", () => {
    assert.deepEqual(detectTiePending(baseFacts({ singlesTiePending: false })), []);
  });

  test("Singles with a tie pending triggers, naming the tied entities", () => {
    const facts = baseFacts({
      singlesTiePending: true,
      current: [entity({ entityId: 1, points: 30 }), entity({ entityId: 2, points: 30 }), entity({ entityId: 3, points: 20 })],
    });
    const stories = detectTiePending(facts);
    assert.equal(stories.length, 1);
    assert.deepEqual((stories[0].facts.tiedEntityIds as number[]).sort(), [1, 2]);
  });
});

describe("detectLeagueStories (runs the full LEAGUE family together)", () => {
  test("an unremarkable Edition with no previous snapshot triggers only what needs no comparison", () => {
    const facts = baseFacts({ previous: null });
    const types = detectLeagueStories(facts).map(s => s.storyType).sort();
    // TITLE_RACE (3 viable entities at 0.4/0.3/0.2) is the only thing that
    // needs no prior snapshot to evaluate in this fixture.
    assert.deepEqual(types, ["TITLE_RACE"]);
  });

  test("a season that just started runs SEASON_KICKOFF alongside the normal standings-based detectors", () => {
    const facts = baseFacts({ previous: null, seasonJustStarted: true });
    const types = detectLeagueStories(facts).map(s => s.storyType).sort();
    assert.deepEqual(types, ["SEASON_KICKOFF", "TITLE_RACE"]);
  });
});
