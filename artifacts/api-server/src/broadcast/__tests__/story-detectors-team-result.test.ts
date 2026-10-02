import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { detectTeamResult } from "../story-detectors-team-result.ts";

describe("detectTeamResult", () => {
  test("keeps the full recorded side names and every participant subject", () => {
    const story = detectTeamResult({
      resultRef: "singles-team:41",
      resultKind: "uneven_team",
      leagueType: "singles",
      matchId: 41,
      anchorMatchId: 41,
      seasonId: 9,
      playedAt: new Date("2026-10-02T18:00:00Z"),
      winnerName: "Kyle & Jamie",
      loserName: "Graeme",
      winnerEntityIds: [14, 15],
      loserEntityIds: [16],
      stake: 20,
    });

    assert.equal(story.storyType, "TEAM_RESULT");
    assert.deepEqual(story.subjectKeys, ["singles:14", "singles:15", "singles:16"]);
    assert.equal(story.facts.winnerName, "Kyle & Jamie");
    assert.equal(story.facts.loserName, "Graeme");
    assert.equal(story.facts.resultRef, "singles-team:41");
  });

  test("uses the supplied synthetic anchor for a multi-team table", () => {
    const story = detectTeamResult({
      resultRef: "doubles-multi:7",
      resultKind: "doubles_multi",
      leagueType: "doubles",
      matchId: 7,
      anchorMatchId: -72,
      seasonId: 12,
      playedAt: new Date("2026-10-02T19:00:00Z"),
      winnerName: "Perfect Pair",
      loserName: "Old Rivalry + The Outsiders",
      winnerEntityIds: [3],
      loserEntityIds: [4, 5],
      stake: 30,
    });

    assert.equal(story.anchorMatchId, -72);
    assert.deepEqual(story.facts.loserEntityIds, [4, 5]);
    assert.ok(story.tags.includes("doubles_multi"));
  });
});
