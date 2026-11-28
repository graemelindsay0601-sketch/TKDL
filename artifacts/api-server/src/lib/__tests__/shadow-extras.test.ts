import { test } from "node:test";
import assert from "node:assert/strict";
import { legendLabel, legendWindow, validateHaunt, MAX_OPEN_HAUNTS } from "../shadow-extras.ts";
import { possessedBossIndex } from "../../shared/darts-rules/index.ts";

const d = (at: string, n: number) => Array.from({ length: n }, () => ({ at, phase: "scoring" }));

test("legend profiles use the season's darts when there are enough, else everything up to the season end", () => {
  const darts = [...d("2026-01-10T10:00:00Z", 30), ...d("2026-02-10T10:00:00Z", 70), ...d("2026-04-01T10:00:00Z", 50)];
  assert.equal(legendWindow(darts, "2026-02-01", "2026-02-28").length, 70);
  assert.equal(legendWindow(darts.slice(0, 50), "2026-02-01", "2026-02-28").length, 50); // only 20 in season: fall back
  assert.equal(legendLabel("May 2026", 2), "May 2026 runner-up");
});

test("haunts: no self, no doubles, a cap on open ones", () => {
  assert.match(validateHaunt(1, 1, true, false, 0)!, /yourself/);
  assert.match(validateHaunt(1, 2, true, true, 0)!, /already/);
  assert.ok(validateHaunt(1, 2, true, false, MAX_OPEN_HAUNTS));
  assert.equal(validateHaunt(1, 2, true, false, 0), null);
});

test("the possessed boss stays put for the week and is in range", () => {
  assert.equal(possessedBossIndex("2026-11-23", 7), possessedBossIndex("2026-11-23", 7));
  for (const w of ["2026-11-23", "2026-11-30", "2026-12-07"]) { const i = possessedBossIndex(w, 7); assert.ok(i >= 0 && i < 7); }
});
