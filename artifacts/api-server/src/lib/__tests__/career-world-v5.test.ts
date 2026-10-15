import { test } from "node:test";
import assert from "node:assert/strict";
import { CAREER_VERSIONS } from "../../career/config.ts";
import { generateInitialWorld, generateJuniorCohort, generateProspects, generateWomenCohort, JUNIOR_COHORT } from "../../career/world/generation.ts";
import { evolveOffSeason, isBasePopulation, isOpenPopulation, isWomenCohort, steadyIntakes, STEADY_WORLD } from "../../career/world/development.ts";
import { worldExpansion } from "../../career/world/expansion.ts";

const seed = "5".repeat(64);
const active = (players: readonly { status: string }[]) => players.filter(p => p.status === "ACTIVE").length;

test("v5: intakes replace retirements, with a small junior and women's class every season", () => {
  assert.ok(CAREER_VERSIONS.playerDatabaseVersion >= 5);
  const base = generateInitialWorld(seed, 1);
  const world = [...base, ...generateJuniorCohort(seed, 1, 1, JUNIOR_COHORT.initial, base, "initial")];
  const women = generateWomenCohort(seed, 1, 1, STEADY_WORLD.womenTarget, world);
  const full = [...world, ...women];
  assert.equal(full.filter(isOpenPopulation).length, STEADY_WORLD.openTarget, "the open pool starts at its target");
  assert.deepEqual(steadyIntakes(full), { junior: STEADY_WORLD.junior.minimum, prospects: 0, women: STEADY_WORLD.women.minimum }, "a full world still takes a minimum class");
  const retire = (n: number, which: (p: typeof full[number]) => boolean) => {
    const ids = new Set(full.filter(which).slice(0, n).map(p => p.id));
    return full.map(p => ids.has(p.id) ? { ...p, status: "RETIRED" as const, stage: "RETIRED" as const, retiredSeason: 1 } : p);
  };
  assert.deepEqual(steadyIntakes(retire(12, isOpenPopulation)), { junior: 12, prospects: 0, women: STEADY_WORLD.women.minimum }, "juniors replace open retirements first");
  assert.deepEqual(steadyIntakes(retire(30, isOpenPopulation)), { junior: 18, prospects: 12, women: STEADY_WORLD.women.minimum }, "adult prospects cover the rest");
  assert.equal(steadyIntakes(retire(9, isWomenCohort)).women, 9);
  assert.ok(women.every(isWomenCohort) && !worldExpansion(seed, 1, 1, full, "initial").some(isWomenCohort), "club squad women are not the women's cohort");
});

test("v5: the active world holds its size across ten seasons (v4 grew by about 20 a season)", () => {
  const base = generateInitialWorld(seed, 1);
  let players = [...base];
  players.push(...generateJuniorCohort(seed, 1, 1, JUNIOR_COHORT.initial, players, "initial"));
  players.push(...generateWomenCohort(seed, 1, 1, STEADY_WORLD.womenTarget, players));
  players.push(...worldExpansion(seed, 1, 1, players, "initial"));
  const start = active(players);
  for (let season = 1; season <= 10; season++) {
    players = evolveOffSeason(players, seed, 1, season, 1, 0.5, isBasePopulation, 0).players;
    const intakes = steadyIntakes(players);
    players.push(...generateProspects(seed, 1, season + 1, intakes.prospects, players));
    players.push(...generateJuniorCohort(seed, 1, season + 1, intakes.junior, players, `intake:${season + 1}`));
    players.push(...generateWomenCohort(seed, 1, season + 1, intakes.women, players));
    players.push(...worldExpansion(seed, 1, season + 1, players, `s${season + 1}`));
    assert.ok(Math.abs(active(players) - start) <= 12, `season ${season + 1}: ${active(players)} active against ${start}`);
  }
  assert.ok(players.some(p => p.status === "ACTIVE" && p.worldKey.startsWith("junior:intake:11:")), "a junior class still arrives in season 11");
});
