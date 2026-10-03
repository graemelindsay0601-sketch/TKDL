import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateInitialWorld, generateProspects } from "../../career/world/generation.ts";
import { scopedRandom, stableUuid } from "../../career/world/random.ts";
import { npcSchema, meanAbility, type Npc } from "../../career/world/types.ts";
import { CAREER_WORLD_CONFIG as W, CAREER_DEVELOPMENT_CONFIG as D, targetPopulation } from "../../career/world/config.ts";
import { developNpc, evolveOffSeason, retirementProbability } from "../../career/world/development.ts";
import { HARNESS_SEED, calibratedNpc, worldReport } from "../../career/world/harness.ts";

const seed = HARNESS_SEED;
const world = generateInitialWorld(seed, 1);
const clone = (npc = world[0]): Npc => structuredClone(npc);

test("low-ability duration counts elapsed years rather than development calls", () => {
  const npc = clone();
  for (const key of Object.keys(npc.ability) as (keyof Npc["ability"])[]) npc.ability[key] = 10;
  npc.development.lowAbilityYears = 0;
  const annual = developNpc(npc, seed, 1, "annual", 1, 0);
  let quarterly = npc;
  for (let quarter = 0; quarter < 4; quarter++) quarterly = developNpc(quarterly, seed, 1, `quarter:${quarter}`, 0.25, 0);
  assert.equal(annual.development.lowAbilityYears, 1);
  assert.equal(quarterly.development.lowAbilityYears, 1);
});

test("world generation is repeatable, seed-sensitive, complete and uses original fictional identity sources", () => {
  assert.deepEqual(generateInitialWorld(seed, 1), world);
  const different = generateInitialWorld("bc".repeat(32), 1);
  assert.notDeepEqual(different, world);
  assert.equal(world.length, targetPopulation());
  assert.equal(new Set(world.map(npc => npc.id)).size, world.length);
  assert.equal(new Set(world.map(npc => npc.worldKey)).size, world.length);
  assert.equal(new Set(world.map(npc => `${npc.firstName} ${npc.surname}`)).size, world.length);
  assert.equal(new Set([...world, ...different].map(npc => npc.id)).size, world.length * 2);
  for (const [tier, target] of Object.entries(W.population)) assert.equal(world.filter(npc => npc.tier === tier).length, target);
  assert.ok(world.some(npc => npc.templateKey));
  assert.ok(world.some(npc => !npc.templateKey));
  for (const npc of world) assert.ok(npcSchema.safeParse(npc).success);
  const source = readFileSync(new URL("../../career/world/generation.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /bot-engine|tourSeed|BOT_PERSONAS|TOUR_PERSONAS/);
  assert.throws(() => generateInitialWorld(seed, 999), /version/);
});

test("scoped RNG streams are stable and unrelated systems cannot consume each other's state", () => {
  const a = scopedRandom(seed, 1, "identity", "a"), b = scopedRandom(seed, 1, "identity", "a");
  const noise = scopedRandom(seed, 1, "development", "a");
  for (let i = 0; i < 100; i++) { noise(); noise(); assert.equal(a(), b()); }
  assert.notEqual(scopedRandom(seed, 1, "a|b", "c")(), scopedRandom(seed, 1, "a", "b|c")());
  assert.notEqual(scopedRandom(seed, 1, "identity")(), scopedRandom(seed, 2, "identity")());
  assert.equal(stableUuid(seed, 1, "a"), stableUuid(seed, 1, "a"));
  assert.throws(() => scopedRandom("client", 1));
});

test("world harness reports distributions, valid bounds and exact counts", () => {
  const report = worldReport();
  assert.equal(report.active, 220);
  assert.equal(report.professional, 95);
  assert.equal(report.elite, 32);
  assert.equal(report.invalidAttributes, 0);
  assert.equal(report.duplicateNames, 0);
  assert.ok(report.potential.min >= W.attributeMin && report.potential.max! <= W.attributeMax);
  assert.ok(Object.keys(report.nationalities).length > 3);
});

test("development is deterministic, opportunity-sensitive and can improve, plateau or decline", () => {
  const player = calibratedNpc(clone(), 40);
  player.age = 24;
  player.development = { ...player.development, potential: 90, breakthroughAge: 18, peakStart: 32, peakEnd: 40, rate: 3, volatility: 0 };
  let improvements = 0, plateaus = 0, highOpportunity = 0, lowOpportunity = 0;
  for (let i = 0; i < 100; i++) {
    const developed = developNpc(player, seed, 1, `period:${i}`, 1, 1);
    assert.deepEqual(developed, developNpc(player, seed, 1, `period:${i}`, 1, 1));
    const change = meanAbility(developed.ability) - meanAbility(player.ability);
    if (change > 0) improvements++; else if (change === 0) plateaus++;
    highOpportunity += change;
    lowOpportunity += meanAbility(developNpc(player, seed, 1, `period:${i}`, 1, 0).ability) - meanAbility(player.ability);
  }
  assert.ok(improvements > 0 && plateaus > 0);
  assert.ok(highOpportunity > lowOpportunity);
  const old = { ...player, age: 65 };
  assert.ok(meanAbility(developNpc(old, seed, 1, "decline", 1, 1).ability) < 40);
  assert.deepEqual(player.ability, calibratedNpc(clone(), 40).ability);
});

test("late bloomers and different decline profiles produce distinct trajectories; potential is not destiny", () => {
  const player = calibratedNpc(clone(), 40);
  player.development = { ...player.development, potential: 95, rate: 3, volatility: 0, breakthroughAge: 35, peakStart: 42, peakEnd: 48 };
  let early = 0, late = 0;
  for (let i = 0; i < 100; i++) {
    early += meanAbility(developNpc({ ...player, age: 23 }, seed, 1, `${i}`, 1, 1).ability);
    late += meanAbility(developNpc({ ...player, age: 36 }, seed, 1, `${i}`, 1, 1).ability);
  }
  assert.ok(late > early);
  const older = { ...player, age: 55 };
  const gradual = developNpc({ ...older, development: { ...older.development, declineProfile: "GRADUAL" } }, seed, 1, "same", 1, 1);
  const sharp = developNpc({ ...older, development: { ...older.development, declineProfile: "SHARP" } }, seed, 1, "same", 1, 1);
  const plateau = developNpc({ ...older, development: { ...older.development, declineProfile: "PLATEAU" } }, seed, 1, "same", 1, 1);
  assert.ok(meanAbility(sharp.ability) < meanAbility(gradual.ability));
  assert.ok(meanAbility(plateau.ability) > meanAbility(gradual.ability));
  let career = { ...player, age: 20 };
  for (let year = 0; year < 25; year++) {
    career = developNpc(career, seed, 1, `year:${year}`, 1, 0.2);
    career.age++;
  }
  assert.ok(meanAbility(career.ability) < career.development.potential - 10);
});

test("retirement is multifactorial, preserves identity and replaces the active population", () => {
  const older = world.map(npc => ({ ...clone(npc), age: W.maximumAge, stage: "VETERAN" as const }));
  const result = evolveOffSeason(older, seed, 1, 1, 1, 0.5);
  assert.equal(result.retired.length, world.length);
  assert.equal(result.entrants.length, targetPopulation());
  assert.equal(result.players.filter(npc => npc.status === "ACTIVE").length, targetPopulation());
  for (const npc of older) {
    const retired = result.players.find(row => row.id === npc.id)!;
    assert.equal(retired.firstName, npc.firstName);
    assert.equal(retired.worldKey, npc.worldKey);
    assert.equal(retired.status, "RETIRED");
    assert.equal(retired.retiredSeason, 1);
    assert.deepEqual(developNpc(retired, seed, 1, "future", 1, 1), retired);
  }
  assert.ok(retirementProbability({ ...world[0], age: 65, stage: "VETERAN" }) > retirementProbability({ ...world[0], age: 25, stage: "DEVELOPING" }));
  assert.deepEqual(evolveOffSeason(older, seed, 1, 1, 1, 0.5), result);
});

test("exceptional prospects are possible but rare, not guaranteed each generation", () => {
  const prospects = generateProspects(seed, 1, 2, 4000, []);
  const exceptional = prospects.filter(npc => npc.development.potential >= 95);
  assert.ok(exceptional.length > 0 && exceptional.length < prospects.length * 0.01);
  assert.ok(prospects.filter(npc => npc.development.potential <= 65).length > prospects.length / 2);
  assert.ok(prospects.every(npc => npc.age >= D.prospectAge[0] && npc.age <= D.prospectAge[1]));
  let ordinaryGenerations = 0;
  for (let season = 2; season < 22; season++) {
    if (generateProspects(seed, 1, season, 10, []).every(npc => npc.development.potential < 95)) ordinaryGenerations++;
  }
  assert.ok(ordinaryGenerations > 15);
  assert.ok(prospects.every(npc => !("wonderkid" in npc)));
});
