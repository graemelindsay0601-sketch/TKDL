import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateMatch, firstRound, bracketOrder, revealDays, roundName, callVisit } from "../shadow-cup.ts";

const pro = { primarySeg: 20, treblePct: 0.45, singlePct: 0.45, doubleHitPct: 0.45, computedAvg: 90, scoringDist: [{ seg: 20, mult: 3, n: 45 }, { seg: 20, mult: 1, n: 45 }, { seg: 5, mult: 1, n: 10 }] };
const pub = { primarySeg: 20, treblePct: 0.05, singlePct: 0.45, doubleHitPct: 0.08, computedAvg: 35, scoringDist: [{ seg: 20, mult: 1, n: 45 }, { seg: 1, mult: 1, n: 30 }, { seg: 0, mult: 0, n: 25 }] };

test("a match is legal 501 double-out and replays the same from its seed", () => {
  const m = simulateMatch(pro, pub, "w1:m1");
  assert.equal(Math.max(...m.score), 3);
  assert.deepEqual(simulateMatch(pro, pub, "w1:m1"), m);
  for (const leg of m.legs) {
    const left = [501, 501];
    for (const v of leg.visits) {
      if (!v.bust) left[v.p] -= v.darts.reduce((s, d) => s + d.val, 0);
      assert.equal(left[v.p], v.left);
      assert.ok(v.left >= 0 && v.left !== 1);
      if (v.checkout) { assert.equal(v.left, 0); assert.equal(v.darts[v.darts.length - 1].mult, 2); }
    }
    assert.equal(leg.visits[leg.visits.length - 1].p, leg.winner);
    assert.ok(leg.visits[leg.visits.length - 1].checkout);
  }
});

test("the better shadow wins most of the time", () => {
  let wins = 0;
  for (let i = 0; i < 40; i++) if (simulateMatch(pro, pub, `s${i}`).winner === 0) wins++;
  assert.ok(wins >= 34, `pro won ${wins}/40`);
});

test("bracket: seeds 1 and 2 on opposite halves, byes for top seeds", () => {
  assert.deepEqual(bracketOrder(8), [0, 7, 3, 4, 1, 6, 2, 5]);
  const r = firstRound([5, 9, 7, 3, 8, 1].map(avg => ({ avg })));
  assert.equal(r.length, 4);
  assert.deepEqual(r[0].map(x => x?.avg ?? null), [9, null]);
  assert.deepEqual(r[2].map(x => x?.avg ?? null), [8, null]);
});

test("reveal days end on Friday; round names; commentary", () => {
  assert.deepEqual(revealDays(3), [0, 2, 4]);
  assert.deepEqual(revealDays(4), [0, 1, 3, 4]);
  assert.equal(roundName(1), "Final"); assert.equal(roundName(4), "Round of 16");
  assert.equal(callVisit("Shadow Kyle", { p: 0, darts: [], score: 180, left: 321 }), "ONE HUNDRED AND EIGHTY! Shadow Kyle.");
  assert.equal(callVisit("Shadow Kyle", { p: 0, darts: [], score: 121, left: 0, checkout: true }), "Shadow Kyle takes out 121!");
});
