import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("road progression map keeps the route, Tour Card and Worlds stages explicit and data-backed", () => {
  const road = source("../../features/career/pages/road.tsx");
  assert.match(road, /aria-label="Progression map from amateur routes to Tour Card and World Championship"/);
  assert.match(road, /p\.tourCard\?\.offer/);
  assert.match(road, /w\.place/);
  assert.match(road, /c\.cards/);
  assert.match(road, /BREAKOUT_ROUTES\[w\.place\.route\]/);
  assert.match(road, /PLATES\[pro \? "professional-floor" : "community-hall"\]/);
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
  assert.match(trends, /No World Ranking history yet/);
  assert.match(trends, /No completed event results yet/);
  assert.match(trends, /ranking\.data\?\.seasonHighs/);
  assert.match(trends, /facts\.data\?\.results/);
  assert.match(trends, /no gaps are filled and no values are estimated/);
});
