import test from "node:test";
import assert from "node:assert/strict";
import { scoringVisit, isPossibleVisit, finishVisit, finishOptions } from "../visit-synth.ts";

const sum = (ds: { value: number }[]) => ds.reduce((s, d) => s + d.value, 0);

test("every possible visit total becomes three darts that add up, with no doubles", () => {
  for (let t = 0; t <= 180; t++) {
    const ds = scoringVisit(t);
    if (!ds) continue;
    assert.equal(ds.length, 3, `total ${t}`);
    assert.equal(sum(ds), t, `total ${t}`);
    assert.ok(ds.every(d => d.multiplier !== 2), `no doubles in ${t}`);
  }
});

test("impossible three-dart scores are rejected", () => {
  for (const t of [163, 166, 169, 172, 173, 175, 176, 178, 179, 181, -1, 2.5]) assert.equal(isPossibleVisit(t), false, String(t));
  for (const t of [0, 1, 26, 60, 100, 140, 171, 174, 177, 180]) assert.equal(isPossibleVisit(t), true, String(t));
});

test("a finish ends on a double, uses the darts said, and misses fill the extra darts at a double", () => {
  const ds = finishVisit(40, 3, 3)!;
  assert.deepEqual(ds.map(d => d.label), ["Miss", "Miss", "D20"]);
  const big = finishVisit(170, 3, 1)!;
  assert.equal(sum(big), 170);
  assert.equal(big[2].label, "DB");
  const two = finishVisit(100, 2, 1)!;
  assert.equal(sum(two), 100); assert.equal(two.length, 2); assert.equal(two[1].multiplier, 2);
  assert.equal(finishVisit(41, 1, 1), null); // odd number can't go out in one dart
  assert.equal(finishVisit(171, 3, 1), null);
});

test("every remaining from 2 to 170 that is a real checkout has at least one option", () => {
  const bogey = new Set([159, 162, 163, 165, 166, 168, 169]);
  for (let r = 2; r <= 170; r++) {
    const opts = finishOptions(r);
    assert.equal(opts.length > 0, !bogey.has(r), `remaining ${r}`);
    for (const o of opts) {
      const ds = finishVisit(r, o.dartsUsed, o.atDouble)!;
      assert.equal(sum(ds), r); assert.equal(ds.length, o.dartsUsed);
      // never leaves 1 or zero before the last dart
      let left = r; for (const d of ds.slice(0, -1)) { left -= d.value; assert.ok(left >= 2, `r ${r} ${JSON.stringify(o)}`); }
    }
  }
});

test("straight out finishes on any dart", () => {
  const ds = finishVisit(57, 1, 0, false)!;
  assert.equal(sum(ds), 57); assert.equal(ds.length, 1);
});
