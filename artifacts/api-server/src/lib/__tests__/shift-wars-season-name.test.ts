import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldUseTeamLeadershipName } from "../shift-wars-season-name.ts";

test("Team Shift Leader keeps its name for seasons before November 2026", () => {
  assert.equal(shouldUseTeamLeadershipName("2026-10-01"), false);
  assert.equal(shouldUseTeamLeadershipName("2026-10-31"), false);
});

test("Team Leadership starts with the November 2026 season", () => {
  assert.equal(shouldUseTeamLeadershipName("2026-11-01"), true);
  assert.equal(shouldUseTeamLeadershipName("2026-11-03"), true);
});
