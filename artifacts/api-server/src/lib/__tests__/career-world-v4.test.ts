import { test } from "node:test";
import assert from "node:assert/strict";
import { worldExpansion, clubSquadSize, INTERNATIONAL_COUNTRIES, INTERNATIONAL_SQUAD } from "../../career/world/expansion.ts";
import { npcFacts } from "../../career/calendar/providers.ts";
import { LOCALITIES } from "../../career/calendar/geography.ts";
import { CAREER_VERSIONS } from "../../career/config.ts";

const seed = "4".repeat(64);
const squad = (key: string) => (p: { worldKey: string }) => new RegExp(`^(women:)?${key}:`).test(p.worldKey);

test("v4: a club squad in every home area and an international squad for every other host country", () => {
  assert.ok(CAREER_VERSIONS.playerDatabaseVersion >= 4);
  const world = worldExpansion(seed, 1, 1, [], "initial");
  for (const l of LOCALITIES) {
    const club = world.filter(squad(`club:${l.key}`));
    assert.equal(club.length, clubSquadSize(l.weight), l.key);
    assert.ok(club.every(p => p.nationality === l.country && npcFacts(p).locality === l.key), `${l.key} squad lives locally`);
  }
  for (const c of INTERNATIONAL_COUNTRIES) {
    const intl = world.filter(squad(`intl:${c}`));
    assert.equal(intl.length, INTERNATIONAL_SQUAD.length, c);
    assert.ok(intl.every(p => p.nationality === c));
    assert.ok(intl.some(p => p.professionalStatus === "PROFESSIONAL"), `${c} has a tour-level player`);
  }
  assert.equal(new Set(world.map(p => `${p.firstName} ${p.surname}`)).size, world.length, "unique names");
  assert.ok(world.some(p => p.worldKey.startsWith("women:")), "women in the squads");
  assert.deepEqual(world, worldExpansion(seed, 1, 1, [], "initial"), "deterministic");
});

test("v4: each season tops squads back up to size after retirements", () => {
  const world = worldExpansion(seed, 1, 1, [], "initial");
  const ayr = world.filter(squad("club:ayrshire"));
  const retired = world.map(p => ayr.slice(0, 3).includes(p) ? { ...p, status: "RETIRED" as const, stage: "RETIRED" as const, retiredSeason: 1 } : p);
  const intake = worldExpansion(seed, 1, 2, retired, "s2");
  assert.equal(intake.length, 3, "only the three retirees are replaced");
  assert.ok(intake.every(p => squad("club:ayrshire")(p) && p.createdSeason === 2));
  assert.equal(worldExpansion(seed, 1, 2, [...retired, ...intake], "s2").length, 0, "full squads take nobody");
});

test("v4: retirements from the base pool are replaced by new prospects (squads and cohorts no longer hide them)", async () => {
  const { generateInitialWorld } = await import("../../career/world/generation.ts");
  const { evolveOffSeason, isBasePopulation } = await import("../../career/world/development.ts");
  const base = generateInitialWorld(seed, 1);
  const world = [...base, ...worldExpansion(seed, 1, 1, base, "initial")];
  const old = evolveOffSeason(world, seed, 1, 1, 1, 0.5);
  const fixed = evolveOffSeason(world, seed, 1, 1, 1, 0.5, isBasePopulation);
  assert.equal(old.entrants.length, 0, "counting every squad player, the base pool never refills");
  assert.equal(fixed.entrants.length, fixed.retired.filter(id => isBasePopulation(world.find(p => p.id === id)!)).length, "each base retirement is replaced");
});
