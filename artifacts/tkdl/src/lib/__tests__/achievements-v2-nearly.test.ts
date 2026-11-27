import { test } from "node:test";
import assert from "node:assert/strict";
import { nearest } from "../../components/achievements-v2/nearly-logic.ts";

const t = (key: string, value: number, level: number, levels: number[], progress: number, unit: "%" | "rank" | null = null) =>
  ({ key, title: key, value, level, levels, metal: null, next: `goal ${key}`, nextTarget: levels[level] ?? null, progress, unit, scorer: false });

test("nudges pick tracks at least half way and a few away (or within 10%), closest first", () => {
  const areas = [{ area: "LEAGUE" as const, tracks: [
    t("wins", 23, 3, [1, 5, 10, 25, 50], 0.87),       // 2 away
    t("matches", 60, 4, [5, 10, 25, 50, 100], 0.2),    // too far
    t("stakes", 460, 5, [25, 50, 100, 200, 350, 500, 1000], 0.73), // 40 away, but within 10% of 500
    t("done", 50, 5, [1, 5, 10, 25, 50], 1),           // complete
  ] }, { area: "CAREER" as const, tracks: [t("ranking", 18, 2, [64, 32, 16, 8, 1], 0.88, "rank")] }];
  assert.deepEqual(nearest(areas, undefined, 5).map(x => [x.key, x.left]), [["ranking", 2], ["wins", 2], ["stakes", 40]]);
  assert.deepEqual(nearest(areas, ["LEAGUE"]).map(x => x.key), ["wins", "stakes"]);
});
