import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("road progression map keeps the route, Tour Card and Worlds stages explicit and data-backed", () => {
  const road = source("../../features/career/pages/road.tsx");
  assert.match(road, /aria-label="Progression overview"/);
  assert.match(road, /p\.tourCard\?\.offer/);
  assert.match(road, /w\.place/);
  assert.match(road, /c\.cards/);
  assert.match(road, /BREAKOUT_ROUTES\[w\.place\.route\]/);
  assert.match(road, /className="rt-journey__rail"/);
});

test("career era cards reuse authored arena plates and retain loading/error states", () => {
  const eras = source("../../features/career/pages/career-trends.tsx");
  assert.match(eras, /PLATES\[era\.venue\]/);
  assert.match(eras, /cards\.isLoading \|\| facts\.isLoading/);
  assert.match(eras, /if \(facts\.error\) return <CareerError/);
  assert.match(eras, /"Televised stage"/);
});

test("performance charts expose honest empty states and plot recorded ranking/results only", () => {
  const trends = source("../../features/career/pages/career-trends.tsx");
  assert.match(trends, /No published ranking history recorded yet/);
  assert.match(trends, /Completed event results will appear here as your Career progresses/);
  assert.match(trends, /ranking\.data\?\.seasonHighs/);
  assert.match(trends, /facts\.data\?\.results/);
  assert.match(trends, /Only completed results and published ranking records are shown/);
});
