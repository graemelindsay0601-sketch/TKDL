import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildTeamResultGraphicModel } from "../../features/broadcast/graphics/team-result-graphic.ts";

describe("buildTeamResultGraphicModel", () => {
  test("describes an uneven player-team result and retains complete side names", () => {
    const model = buildTeamResultGraphicModel("singles", {
      resultKind: "uneven_team",
      winnerName: "Kyle & Jamie",
      loserName: "Graeme",
      winnerEntityIds: [14, 15],
      loserEntityIds: [16],
      stake: 20,
    });
    assert.deepEqual(model, {
      formatLabel: "Uneven Player Teams",
      contextLabel: "2 players versus 1 player",
      valueLabel: "Stake",
      value: 20,
      winnerName: "Kyle & Jamie",
      loserName: "Graeme",
      winnerCount: 2,
      loserCount: 1,
    });
  });

  test("labels combined and multi-team values as pots", () => {
    const combined = buildTeamResultGraphicModel("doubles", {
      resultKind: "doubles_combined",
      winnerName: "Perfect Pair",
      loserName: "Checkout Crew + The Outsiders",
      winnerEntityIds: [3],
      loserEntityIds: [4, 5],
      stake: 30,
    });
    const multi = buildTeamResultGraphicModel("shift_wars", {
      resultKind: "shift_multi",
      winnerName: "North",
      loserName: "South + East",
      winnerEntityIds: [1],
      loserEntityIds: [2, 3],
      stake: 45,
    });
    assert.equal(combined?.formatLabel, "Combined Doubles");
    assert.equal(combined?.valueLabel, "Pot");
    assert.equal(combined?.contextLabel, "1 team beat 2 teams");
    assert.equal(multi?.formatLabel, "Multi-Team Shift Wars");
    assert.equal(multi?.contextLabel, "3 teams contested the result");
  });

  test("rejects an incomplete payload so the generic fact renderer can take over", () => {
    assert.equal(buildTeamResultGraphicModel("singles", { resultKind: "uneven_team" }), null);
  });
});
