import { test } from "node:test";
import assert from "node:assert/strict";
import { qualificationStakeLines } from "../../features/career/model.ts";

test("event stakes describe authored qualification cut lines and target season", () => {
  assert.deepEqual(qualificationStakeLines([
    { maxPosition: 3, entitlementType: "EVENT_ENTRY", targetKey: "world-championship", targetSeason: "SAME" },
    { maxPosition: 2, entitlementType: "EVENT_ENTRY", targetKey: "open-championship", targetSeason: "NEXT" },
  ]), [
    "Finish in the top 3 to earn a World Championship place this season.",
    "Reach the final to earn Open Championship entry next season.",
  ]);
});

test("event stakes use clear wording for a finish-based circuit pass", () => {
  assert.deepEqual(qualificationStakeLines([
    { maxPosition: 1000, entitlementType: "SERIES_ACCESS", targetKey: "challenger-tour", targetSeason: "SAME" },
    { maxPosition: 9, entitlementType: "STAGE_ENTRY", targetKey: "q-school-final:UK_IRELAND", targetSeason: "SAME" },
  ]), [
    "Finish the event to earn Challenger Tour access this season.",
    "Finish in the top 9 to earn a Q-School Final Stage place this season.",
  ]);
});
