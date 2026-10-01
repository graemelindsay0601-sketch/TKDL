import assert from "node:assert/strict";
import test from "node:test";
import { buildMatchResultNotifications } from "../match-result-notifications.ts";

test("Singles creates one win and one loss result with the same wager", () => {
  const rows = buildMatchResultNotifications({
    format: "singles", winnerLabel: "Graeme", loserLabel: "Robert",
    winnerPlayerIds: [16], loserPlayerIds: [4], stake: 20, eloChange: 14,
  });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => row.playerId), [16, 4]);
  assert.match(rows[0].body, /\+14 ELO.*20 pts/);
  assert.match(rows[1].body, /-14 ELO.*20 pts/);
});

test("Doubles and uneven teams notify every selected player exactly once", () => {
  for (const format of ["doubles", "team"] as const) {
    const rows = buildMatchResultNotifications({
      format, winnerLabel: "Graeme & Scott", loserLabel: "Jamie & Kyle",
      winnerPlayerIds: [1, 2], loserPlayerIds: [3, 4, 5], stake: 21, eloChange: 9,
    });
    assert.deepEqual(rows.map(row => row.playerId), [1, 2, 3, 4, 5]);
    assert.equal(new Set(rows.map(row => row.playerId)).size, 5);
    assert.ok(rows.every(row => row.body.includes("21 pts")));
  }
});

test("Shift Wars remains points-only and covers both department rosters", () => {
  const rows = buildMatchResultNotifications({
    format: "shift_wars", winnerLabel: "Fresh", loserLabel: "Twilight",
    winnerPlayerIds: [1, 2, 3], loserPlayerIds: [4, 5], stake: 10,
  });
  assert.equal(rows.length, 5);
  assert.ok(rows.every(row => !row.body.includes("ELO")));
  assert.deepEqual(rows.map(row => row.data.result), ["win", "win", "win", "loss", "loss"]);
});
