/** The Career inbox: wording rules (the service is checked against live saves through the API). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { INBOX_CATEGORIES, seriesName, voiced } from "../../career/inbox/model.ts";

test("inbox: a series is one item, a manager speaks in their own voice, five categories in order", () => {
  assert.equal(seriesName("Q-School UK & Ireland First Stage — Day 3"), "Q-School UK & Ireland First Stage");
  assert.equal(seriesName("Glasgow Open"), "Glasgow Open");
  const item = { key: "k", category: "WAITING" as const, title: "t", body: "Oche Energy want you.", action: null, week: 3, expiresWeek: null };
  assert.equal(voiced(null, item).from, "Career"); assert.equal(voiced(null, item).body, "Oche Energy want you.");
  const m = voiced({ name: "Northgate Sports Management" }, item);
  assert.equal(m.from, "Northgate Sports Management"); assert.match(m.body, /^I've had a call\. Oche Energy/);
  assert.deepEqual(Object.keys(INBOX_CATEGORIES), ["QUALIFIED", "OPEN", "WAITING", "CLOSING", "MILESTONE"]);
});
