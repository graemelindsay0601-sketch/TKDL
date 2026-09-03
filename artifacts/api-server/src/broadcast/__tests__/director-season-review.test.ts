/**
 * Tests for director-season-review.ts's selectSeasonReviewRunningOrder — the
 * pure running-order builder behind the Season Review special (see that
 * file's own header for why it exists: a normal Edition's CHAMPION +
 * SEASON_RECAP pairing read as "just a 2 min show" to a real user, missing
 * any actual matches/storylines from the closed season).
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { selectSeasonReviewRunningOrder } from "../director-season-review.ts";
import type { ClosedLeagueSeason } from "../story-engine.ts";
import type { BroadcastStory, LeagueType } from "@workspace/db/schema";

let nextId = 1;
function story(overrides: Partial<BroadcastStory> = {}): BroadcastStory {
  return {
    id: nextId++,
    storyKey: `key-${nextId}`,
    leagueType: "singles",
    storyType: "UPSET",
    subjectKeys: ["singles:1"],
    anchorMatchId: null,
    seasonId: null,
    detectedAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: new Date("2026-09-01T00:00:00Z"),
    resolvedAt: null,
    lifecycle: "RESOLVED",
    score: 60,
    confidence: 80,
    sentiment: "neutral",
    facts: {},
    tags: [],
    lastFullEditionId: null,
    lastHeadlineEditionId: null,
    fullCount: 0,
    headlineCount: 0,
    ...overrides,
  } as BroadcastStory;
}

function closedSeason(overrides: Partial<ClosedLeagueSeason> = {}): ClosedLeagueSeason {
  return {
    leagueType: "singles",
    seasonId: 1,
    seasonName: "Autumn 2026",
    seasonStart: new Date("2026-06-01T00:00:00Z"),
    seasonEndExclusive: new Date("2026-09-01T00:00:00Z"),
    championEntityId: 7,
    matchesPlayed: 42,
    topEntityId: 7,
    topWins: 12,
    ...overrides,
  };
}

describe("selectSeasonReviewRunningOrder", () => {
  test("opening and closing bookend every running order, with no group attached", () => {
    const closed = closedSeason();
    const champion = story({ storyType: "CHAMPION", leagueType: "singles", facts: { seasonId: 1 } });
    const order = selectSeasonReviewRunningOrder({
      closedSeasons: [closed], pool: [champion], highlightsByLeague: new Map(),
    });
    assert.equal(order[0].purpose, "opening");
    assert.equal(order[0].group, null);
    assert.equal(order.at(-1)!.purpose, "closing");
    assert.equal(order.at(-1)!.group, null);
  });

  test("the closed season's own CHAMPION (matched by leagueType + facts.seasonId) leads as main_story", () => {
    const closed = closedSeason({ leagueType: "singles", seasonId: 5 });
    const thisSeasonChampion = story({ id: 100, storyType: "CHAMPION", leagueType: "singles", facts: { seasonId: 5 } });
    // A stale CHAMPION row for the same league from an older season — must never be picked instead.
    const oldChampion = story({ id: 101, storyType: "CHAMPION", leagueType: "singles", facts: { seasonId: 4 } });
    const order = selectSeasonReviewRunningOrder({
      closedSeasons: [closed], pool: [oldChampion, thisSeasonChampion], highlightsByLeague: new Map(),
    });
    const mainStory = order.find(e => e.purpose === "main_story");
    assert.ok(mainStory);
    assert.equal(mainStory!.group!.primary.id, 100);
  });

  test("a second closed league's CHAMPION still airs, but as a supporting beat rather than a second main_story", () => {
    const singlesClosed = closedSeason({ leagueType: "singles", seasonId: 1 });
    const doublesClosed = closedSeason({ leagueType: "doubles", seasonId: 2 });
    const singlesChampion = story({ id: 200, storyType: "CHAMPION", leagueType: "singles", facts: { seasonId: 1 } });
    const doublesChampion = story({ id: 201, storyType: "CHAMPION", leagueType: "doubles", facts: { seasonId: 2 } });
    const order = selectSeasonReviewRunningOrder({
      closedSeasons: [singlesClosed, doublesClosed],
      pool: [singlesChampion, doublesChampion],
      highlightsByLeague: new Map(),
    });
    assert.equal(order.filter(e => e.purpose === "main_story").length, 1);
    assert.equal(order.find(e => e.purpose === "main_story")!.group!.primary.id, 200);
    const supporting = order.filter(e => e.purpose === "supporting_story_or_checkin");
    assert.ok(supporting.some(e => e.group!.primary.id === 201));
  });

  test("real per-league highlights are placed as season_highlight entries, capped at MAX_HIGHLIGHTS_PER_LEAGUE (4)", () => {
    const closed = closedSeason({ leagueType: "singles", seasonId: 1 });
    const highlights = Array.from({ length: 6 }, (_, i) => story({ id: 300 + i, storyType: "UPSET", leagueType: "singles", score: 90 - i }));
    const order = selectSeasonReviewRunningOrder({
      closedSeasons: [closed], pool: [], highlightsByLeague: new Map([["singles" as LeagueType, highlights]]),
    });
    const highlightEntries = order.filter(e => e.purpose === "season_highlight");
    assert.equal(highlightEntries.length, 4);
    assert.deepEqual(highlightEntries.map(e => e.group!.primary.id), [300, 301, 302, 303]);
  });

  test("highlights from every closed league appear — a real multi-league retrospective, not just one", () => {
    const singlesClosed = closedSeason({ leagueType: "singles", seasonId: 1 });
    const doublesClosed = closedSeason({ leagueType: "doubles", seasonId: 2 });
    const shiftWarsClosed = closedSeason({ leagueType: "shift_wars", seasonId: 3 });
    const singlesHighlight = story({ id: 400, storyType: "UPSET", leagueType: "singles" });
    const doublesHighlight = story({ id: 401, storyType: "DOUBLES_UPSET", leagueType: "doubles" });
    const shiftWarsHighlight = story({ id: 402, storyType: "SHIFT_WARS_UPSET", leagueType: "shift_wars" });
    const order = selectSeasonReviewRunningOrder({
      closedSeasons: [singlesClosed, doublesClosed, shiftWarsClosed],
      pool: [],
      highlightsByLeague: new Map([
        ["singles" as LeagueType, [singlesHighlight]],
        ["doubles" as LeagueType, [doublesHighlight]],
        ["shift_wars" as LeagueType, [shiftWarsHighlight]],
      ]),
    });
    const highlightIds = order.filter(e => e.purpose === "season_highlight").map(e => e.group!.primary.id);
    assert.deepEqual(new Set(highlightIds), new Set([400, 401, 402]));
  });

  test("each closed season's own SEASON_RECAP (matched by leagueType + facts.seasonId) is placed as a supporting beat", () => {
    const closed = closedSeason({ leagueType: "singles", seasonId: 9 });
    const recap = story({ id: 500, storyType: "SEASON_RECAP", leagueType: "singles", facts: { seasonId: 9 } });
    const staleRecap = story({ id: 501, storyType: "SEASON_RECAP", leagueType: "singles", facts: { seasonId: 8 } });
    const order = selectSeasonReviewRunningOrder({
      closedSeasons: [closed], pool: [staleRecap, recap], highlightsByLeague: new Map(),
    });
    const supportingIds = order.filter(e => e.purpose === "supporting_story_or_checkin").map(e => e.group!.primary.id);
    assert.ok(supportingIds.includes(500));
    assert.ok(!supportingIds.includes(501));
  });

  test("headlines tease the top 3 highest-scoring body entries", () => {
    const closed = closedSeason({ leagueType: "singles", seasonId: 1 });
    const champion = story({ id: 600, storyType: "CHAMPION", leagueType: "singles", facts: { seasonId: 1 }, score: 100 });
    const recap = story({ id: 601, storyType: "SEASON_RECAP", leagueType: "singles", facts: { seasonId: 1 }, score: 30 });
    const highlights = [
      story({ id: 602, storyType: "UPSET", leagueType: "singles", score: 95 }),
      story({ id: 603, storyType: "UPSET", leagueType: "singles", score: 20 }),
    ];
    const order = selectSeasonReviewRunningOrder({
      closedSeasons: [closed], pool: [champion, recap], highlightsByLeague: new Map([["singles" as LeagueType, highlights]]),
    });
    const headlineIds = order.filter(e => e.purpose === "headlines").map(e => e.group!.primary.id);
    assert.equal(headlineIds.length, 3);
    assert.deepEqual(headlineIds, [600, 602, 601]);
    assert.ok(order.every(e => e.purpose !== "headlines" || e.treatment === "headline_ticker"));
  });

  test("no story is placed twice in the BODY — a story used as champion/recap never also gets reused as a highlight (headlines are exempt, same as edition-engine.ts's own findDuplicateStoryIds convention — a brief tease of an already-placed story is expected, not a duplicate)", () => {
    const closed = closedSeason({ leagueType: "singles", seasonId: 1 });
    const champion = story({ id: 700, storyType: "CHAMPION", leagueType: "singles", facts: { seasonId: 1 } });
    const order = selectSeasonReviewRunningOrder({
      closedSeasons: [closed], pool: [champion], highlightsByLeague: new Map([["singles" as LeagueType, [champion]]]),
    });
    const bodyIds = order.filter(e => e.group && e.purpose !== "headlines").map(e => e.group!.primary.id);
    assert.equal(bodyIds.length, new Set(bodyIds).size);
  });

  test("what_to_watch points at a STILL-OPEN league's own LEAGUE story, never one from a closed league", () => {
    const singlesClosed = closedSeason({ leagueType: "singles", seasonId: 1 });
    const closedLeagueStanding = story({ id: 800, storyType: "TITLE_RACE", leagueType: "singles", score: 80 });
    const openLeagueStanding = story({ id: 801, storyType: "TITLE_RACE", leagueType: "doubles", score: 50 });
    const order = selectSeasonReviewRunningOrder({
      closedSeasons: [singlesClosed], pool: [closedLeagueStanding, openLeagueStanding], highlightsByLeague: new Map(),
    });
    const whatToWatch = order.find(e => e.purpose === "what_to_watch");
    assert.ok(whatToWatch);
    assert.equal(whatToWatch!.group!.primary.id, 801);
  });

  test("what_to_watch falls back to a group-less utility entry when no still-open league has a LEAGUE story", () => {
    const singlesClosed = closedSeason({ leagueType: "singles", seasonId: 1 });
    const order = selectSeasonReviewRunningOrder({
      closedSeasons: [singlesClosed], pool: [], highlightsByLeague: new Map(),
    });
    const whatToWatch = order.find(e => e.purpose === "what_to_watch");
    assert.ok(whatToWatch);
    assert.equal(whatToWatch!.group, null);
    assert.equal(whatToWatch!.treatment, "utility");
  });

  test("slot numbers are sequential starting at 1, with headlines fixed at slot 2 regardless of body length", () => {
    const closed = closedSeason({ leagueType: "singles", seasonId: 1 });
    const champion = story({ id: 900, storyType: "CHAMPION", leagueType: "singles", facts: { seasonId: 1 } });
    const order = selectSeasonReviewRunningOrder({
      closedSeasons: [closed], pool: [champion], highlightsByLeague: new Map(),
    });
    assert.equal(order[0].slot, 1);
    assert.ok(order.filter(e => e.purpose === "headlines").every(e => e.slot === 2));
    const slots = order.map(e => e.slot);
    assert.deepEqual(slots, [...slots].sort((a, b) => a - b));
  });
});
