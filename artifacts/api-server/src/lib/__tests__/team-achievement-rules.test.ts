import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  doublesTeamResultAchievementKeys,
  shiftWarsTeamResultAchievementKeys,
} from "../team-achievement-rules.ts";

describe("doublesTeamResultAchievementKeys", () => {
  test("awards only facts explicitly established by persisted results", () => {
    assert.deepEqual(doublesTeamResultAchievementKeys({
      wonSoloOutnumbered: true,
      wonMultiTeam: false,
      wonAsDefendingChampions: false,
    }), ["DBL_SOLO_OUTNUMBERED"]);

    assert.deepEqual(doublesTeamResultAchievementKeys({
      wonSoloOutnumbered: false,
      wonMultiTeam: true,
      wonAsDefendingChampions: true,
    }), ["DBL_MULTI_SURVIVOR", "DBL_DEFENDING_CHAMP_WIN"]);
  });

  test("does not infer an award when no team-result fact is present", () => {
    assert.deepEqual(doublesTeamResultAchievementKeys({
      wonSoloOutnumbered: false,
      wonMultiTeam: false,
      wonAsDefendingChampions: false,
    }), []);
  });
});

describe("shiftWarsTeamResultAchievementKeys", () => {
  test("maps solo and multi-team wins independently", () => {
    assert.deepEqual(shiftWarsTeamResultAchievementKeys({
      wonSoloOutnumbered: true,
      wonMultiTeam: true,
    }), ["SW_SOLO_OUTNUMBERED", "SW_MULTI_SURVIVOR"]);
    assert.deepEqual(shiftWarsTeamResultAchievementKeys({
      wonSoloOutnumbered: false,
      wonMultiTeam: false,
    }), []);
  });
});
