import { test } from "node:test";
import assert from "node:assert/strict";
import { CAREER_VERSIONS } from "../../career/config.ts";
import { generateInitialWorld, generateJuniorCohort, generateProspects, generateWomenCohort, JUNIOR_COHORT } from "../../career/world/generation.ts";
import { breakthroughs, evolveOffSeason, isBasePopulation, steadyIntakes, PYRAMID } from "../../career/world/development.ts";
import { worldExpansion } from "../../career/world/expansion.ts";
import { meanAbility, type Npc } from "../../career/world/types.ts";

const seed = "6".repeat(64);
const openGame = (players: readonly Npc[]) => players.filter(p => p.status === "ACTIVE" && !p.worldKey.startsWith("women:"));
const elite = (players: readonly Npc[]) => openGame(players).filter(p => p.tier === "ELITE").length;
const tourLevel = (players: readonly Npc[]) => openGame(players).filter(p => p.tier === "ELITE" || p.tier === "PROFESSIONAL").length;
function newWorld() {
  const players = [...generateInitialWorld(seed, 1)];
  players.push(...generateJuniorCohort(seed, 1, 1, JUNIOR_COHORT.initial, players, "initial"));
  players.push(...generateWomenCohort(seed, 1, 1, 80, players));
  players.push(...worldExpansion(seed, 1, 1, players, "initial"));
  return players;
}
function seasons(count: number, withBreakthroughs: boolean) {
  let players = newWorld();
  for (let season = 1; season <= count; season++) {
    players = evolveOffSeason(players, seed, 1, season, 1, 0.5, isBasePopulation, 0).players;
    if (withBreakthroughs) players = breakthroughs(players, seed, 1, season).players;
    const intakes = steadyIntakes(players);
    players.push(...generateProspects(seed, 1, season + 1, intakes.prospects, players));
    players.push(...generateJuniorCohort(seed, 1, season + 1, intakes.junior, players, `intake:${season + 1}`));
    players.push(...generateWomenCohort(seed, 1, season + 1, intakes.women, players));
    players.push(...worldExpansion(seed, 1, season + 1, players, `s${season + 1}`));
  }
  return players;
}

test("v6: a shortfall at the top goes to the best young players one level down, deterministically", () => {
  assert.ok(CAREER_VERSIONS.playerDatabaseVersion >= 6);
  const world = newWorld();
  // Retire most of the open game's elite: the pipeline must answer with breakthroughs.
  const gone = new Set(openGame(world).filter(p => p.tier === "ELITE").slice(0, 20).map(p => p.id));
  const thinned = world.map(p => gone.has(p.id) ? { ...p, status: "RETIRED" as const, stage: "RETIRED" as const, retiredSeason: 1 } : p);
  const result = breakthroughs(thinned, seed, 1, 1);
  const raised = result.players.filter(p => result.breakthroughs.includes(p.id));
  // Elite breakthroughs come from the professionals (tour-level ones from the amateurs and grassroots).
  const eliteRaised = raised.filter(p => p.tier === "PROFESSIONAL" && !p.worldKey.startsWith("women:"));
  assert.equal(eliteRaised.length, PYRAMID.elite.perSeason, "capped at the per-season limit");
  assert.ok(eliteRaised.every(p => p.development.potential >= PYRAMID.elite.potential[0]), "an elite ceiling");
  for (const p of raised) {
    const before = thinned.find(q => q.id === p.id)!;
    assert.ok(p.age <= PYRAMID.maximumAge && p.tier !== "ELITE", "young and not there yet");
    assert.deepEqual(p.ability, before.ability, "a breakthrough raises the ceiling and growth, never ability directly");
    assert.ok(p.development.potential >= before.development.potential && p.development.rate >= before.development.rate);
    assert.ok(p.development.peakStart > p.age, "still growing");
  }
  assert.deepEqual(result, breakthroughs(thinned, seed, 1, 1), "deterministic");
});

test("v6: over 15 seasons the elite and the tour level hold instead of thinning out", () => {
  const start = newWorld();
  const without = seasons(15, false), withPipeline = seasons(15, true);
  assert.ok(elite(withPipeline) >= elite(start) - 6, `elite ${elite(withPipeline)} against ${elite(start)} at the start`);
  assert.ok(tourLevel(withPipeline) >= tourLevel(start), `tour level ${tourLevel(withPipeline)} against ${tourLevel(start)}`);
  assert.ok(elite(withPipeline) > elite(without) && tourLevel(withPipeline) > tourLevel(without) + 15, "better than without breakthroughs");
  const best32 = openGame(withPipeline).map(p => meanAbility(p.ability)).sort((a, b) => b - a)[31];
  assert.ok(best32 >= 64, `the 32nd best player is still tour standard (${best32.toFixed(1)})`);
});
