import { test } from "node:test";
import assert from "node:assert/strict";
import { unlockState, nextUnlockLine } from "../../features/career/unlocks-rules.ts";

test("unlock as you go: extras open with events played; season 2 opens everything; unknown pages are always open", () => {
  const s1 = { currentSeason: 1, status: "ACTIVE" as const };
  const fresh = unlockState(s1, 0);
  assert.equal(fresh.isOpen("road-trips"), false);
  assert.equal(fresh.isOpen("club" as never), true, "pages without a rule are never hidden");
  assert.equal(nextUnlockLine(fresh.next, 0), "Road trips open after your next event.");
  const three = unlockState(s1, 3);
  assert.deepEqual(["road-trips", "pro-am", "cam-league", "sponsors", "streaming"].map(k => three.isOpen(k as never)), [true, true, true, true, false]);
  assert.equal(nextUnlockLine(three.next, 3), "DartCast streaming opens after 2 more events.");
  assert.equal(unlockState({ currentSeason: 2, status: "ACTIVE" }, 0).isOpen("streaming"), true);
  assert.equal(unlockState({ currentSeason: 2, status: "ACTIVE" }, 0).next, null);
});

import { matchFormatLine } from "../../features/career/model.ts";
test("a match's format reads as one plain line", () => {
  assert.equal(matchFormatLine({ startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "LEGS", bestOfLegs: 5 }), "501, best of 5 legs. Finish on a double.");
  assert.equal(matchFormatLine({ startingScore: 501, inRule: "DOUBLE", outRule: "DOUBLE", unit: "SETS", bestOfSets: 7, bestOfLegsPerSet: 5 }),
    "501, best of 7 sets (each set best of 5 legs). Finish on a double. Start each leg with a double.");
});
