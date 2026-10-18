import { test } from "node:test";
import assert from "node:assert/strict";
import { formFrom, attributeForAverage, DEFAULT_SKILL_AVERAGE, AVERAGE_NEEDS_DARTS } from "../../career/form/human.ts";

const none = { sessions: 0, darts: 0, average: null };

test("no history: an estimated pub-level skill, steady form, settled confidence", () => {
  const f = formFrom({ liveAverages: [], results: [], practice: none });
  assert.deepEqual([f.skillAverage, f.estimated, f.formLabel, f.confidence], [DEFAULT_SKILL_AVERAGE, true, "Steady", 50]);
  assert.equal(f.average, null, "a new Career shows no average");
});

test("the average only shows once enough live darts are thrown", () => {
  const few = formFrom({ liveAverages: [60, 62], liveDarts: AVERAGE_NEEDS_DARTS - 1, results: [], practice: { sessions: 3, darts: 900, average: 70 } });
  assert.equal(few.average, null);
  assert.deepEqual(few.averageDarts, { thrown: AVERAGE_NEEDS_DARTS - 1, needed: AVERAGE_NEEDS_DARTS });
  const enough = formFrom({ liveAverages: [60, 62], liveDarts: AVERAGE_NEEDS_DARTS, results: [], practice: none });
  assert.equal(enough.average, enough.skillAverage);
  assert.equal(formFrom({ liveAverages: [], liveDarts: 0, results: [], practice: { sessions: 5, darts: 900, average: 70 } }).average, null, "practice alone never makes a Career average");
});

test("skill follows recent live averages over the longer run", () => {
  const f = formFrom({ liveAverages: [50, 50, 50, 50, 50, 60, 60, 60, 60, 60], results: [], practice: none });
  assert.equal(f.estimated, false);
  assert.ok(f.skillAverage > 55 && f.skillAverage < 60, String(f.skillAverage));
  assert.ok(f.form > 0, "averages trending up lift form");
});

test("one win is not a hot streak; a run of wins is", () => {
  const one = formFrom({ liveAverages: [], results: [true], practice: none });
  const run = formFrom({ liveAverages: [], results: [true, true, true, true, true, true], practice: none });
  const slump = formFrom({ liveAverages: [], results: [false, false, false, false, false, false], practice: none });
  assert.ok(one.confidence < 65, `one win: ${one.confidence}`);
  assert.ok(run.confidence >= 80 && run.formLabel !== "Steady", `run: ${run.confidence} ${run.formLabel}`);
  assert.ok(slump.confidence <= 22 && slump.form < -0.2, `slump: ${slump.confidence}`);
});

test("a week of practice sharpens form; the simulator level matches the average", () => {
  const rested = formFrom({ liveAverages: [55, 55, 55], results: [], practice: none });
  const practised = formFrom({ liveAverages: [55, 55, 55], results: [], practice: { sessions: 5, darts: 900, average: 60 } });
  assert.ok(practised.form > rested.form);
  assert.ok(Math.abs(24 + attributeForAverage(60) * 0.67 - 60) < 0.01);
});
