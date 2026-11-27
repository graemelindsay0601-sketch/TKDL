import { test } from "node:test";
import assert from "node:assert/strict";
import { expired, validateNewCallout, canPredict, calloutLine, OPEN_DAYS, ACCEPTED_DAYS } from "../community-callouts.ts";

const days = (n: number) => new Date(Date.UTC(2026, 10, 1) + n * 86400000).toISOString();
const now = new Date(Date.UTC(2026, 10, 1));

test("open call-outs lapse after 7 days, accepted after 21 from acceptance", () => {
  assert.equal(expired({ status: "open", createdAt: days(-OPEN_DAYS + 1) }, now), false);
  assert.equal(expired({ status: "open", createdAt: days(-OPEN_DAYS - 1) }, now), true);
  assert.equal(expired({ status: "accepted", createdAt: days(-30), respondedAt: days(-ACCEPTED_DAYS + 1) }, now), false);
  assert.equal(expired({ status: "accepted", createdAt: days(-30), respondedAt: days(-ACCEPTED_DAYS - 1) }, now), true);
  assert.equal(expired({ status: "settled", createdAt: days(-99) }, now), false);
});

test("new call-out checks", () => {
  assert.equal(validateNewCallout(1, 2, true, 0), null);
  assert.match(validateNewCallout(1, 1, true, 0)!, /yourself/);
  assert.match(validateNewCallout(1, 2, false, 0)!, /isn't in the league/);
  assert.match(validateNewCallout(1, 2, true, 1)!, /already/);
});

test("predictions: not the two players, only one of them, only while live", () => {
  const m = { status: "accepted" as const, challengerId: 1, targetId: 2 };
  assert.equal(canPredict(m, 3, 2), null);
  assert.match(canPredict(m, 1, 2)!, /yourself/);
  assert.match(canPredict(m, 3, 9)!, /one of the two/);
  assert.match(canPredict({ ...m, status: "settled" }, 3, 2)!, /closed/);
});

test("feed line", () => {
  assert.equal(calloutLine({ challengerName: "Kyle", targetName: "Sean", game: "Cricket" }), "Kyle called out Sean to Cricket.");
  assert.equal(calloutLine({ challengerName: "Kyle", targetName: "Sean", game: null }), "Kyle called out Sean.");
});
