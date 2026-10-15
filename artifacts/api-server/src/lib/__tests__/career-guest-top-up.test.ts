import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSeason } from "../../career/calendar/generation.ts";
import { guestEligible, guestTopUpApplies, evaluate, type InstanceRow } from "../../career/calendar/engine.ts";
import type { ParticipantFacts } from "../../career/calendar/eligibility.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";

/** v14: short local, county and regional fields take guests from further afield instead of being cancelled. */
const row = (version: number, key: string) => {
  const d = generateSeason(HARNESS_SEED, version, 1).find(e => e.definitionKey === key)!;
  return { ...d, event_database_version: d.eventDatabaseVersion, circuit: d.circuit, country: d.country, zone: d.zone, locality_key: d.localityKey,
    season: d.season, start_day: d.startDay, snapshot: d.snapshot } as unknown as InstanceRow;
};
const player = (country: string, zone: string, over: Partial<ParticipantFacts> = {}): ParticipantFacts => ({ key: "N", kind: "NPC", country, zone: zone as ParticipantFacts["zone"],
  locality: null, age: 30, womenEligible: false, professionalStatus: "AMATEUR", tourCard: false, rankings: {}, entitlementTargets: new Set(), invited: false,
  results: { SAME: new Map(), PREVIOUS: new Map() }, defendingChampion: false, ...over });

test("a county event takes an eligible guest from elsewhere; level and status rules still apply", () => {
  const county = row(14, "county-501-open");
  assert.ok(guestTopUpApplies(county));
  const away = player("DEU", "EUROPE");
  assert.ok(!evaluate(county, away).eligible, "not in the catchment, so not a normal entrant");
  assert.ok(guestEligible(county, away), "but welcome as a guest when the field is short");
  assert.ok(!guestEligible(county, player("DEU", "EUROPE", { tourCard: true, professionalStatus: "PROFESSIONAL" })), "amateur-only stays amateur-only");
});

test("national titles and older saves never take guests", () => {
  assert.ok(!guestTopUpApplies(row(14, "national-amateur-gbr")), "a national championship keeps its own field");
  assert.ok(!guestTopUpApplies(row(13, "county-501-open")), "v13 saves keep their behaviour");
});

test("v14 knockouts play whoever enters (byes fill the draw); groups, pairs and older saves keep their minimum", async () => {
  const { runsWith } = await import("../../career/calendar/engine.ts");
  const { viabilityOf } = await import("../../career/calendar/viability.ts");
  const { generateKnockoutDraw } = await import("../../career/calendar/draw.ts");
  const county = row(14, "county-501-open");
  assert.equal(runsWith({ ...county, minimum_entrants: 4 }), 2, "two players make a final");
  assert.equal(runsWith({ ...row(13, "county-501-open"), minimum_entrants: 4 }), 4, "v13 saves keep the authored minimum");
  const pairs = row(14, "pub-doubles");
  assert.equal(runsWith({ ...pairs, minimum_entrants: 8 }), 4, "pairs need two teams");
  const draw = generateKnockoutDraw(["a", "b", "c", "d", "e"], [], 0, () => 0.5);
  assert.deepEqual([draw.size, draw.byes, draw.rounds], [8, 3, 3], "five players: a draw of eight with three byes");
  const v = viabilityOf({ ...county, minimum_entrants: 4, status: "REGISTRATION_OPEN", status_reason: null, entrant_count: 0, registration_closes_week: 12, classification: "RANKING" });
  assert.deepEqual([v?.minimum, v?.byes], [2, true]);
});

test("substitutes: local club players from the event's own area, right age and category, deterministic", async () => {
  const { substitutesFor } = await import("../../career/calendar/substitutes.ts");
  const { evaluate, npcParticipant, factsFor } = await import("../../career/calendar/engine.ts");
  const county = { ...row(14, "county-501-open"), instance_key: "county-501-open:ayrshire-w8" } as InstanceRow;
  const tw = (county.snapshot as any).npcTierWeights;
  const subs = substitutesFor(HARNESS_SEED, 1, county, 3, [], tw);
  assert.equal(subs.length, 3);
  for (const s of subs) {
    assert.equal(s.nationality, county.country);
    assert.equal(s.professionalStatus, "AMATEUR");
    assert.ok(!/\d/.test(`${s.firstName} ${s.surname}`));
  }
  assert.equal(new Set(subs.map(s => `${s.firstName} ${s.surname}`)).size, 3);
  assert.deepEqual(subs, substitutesFor(HARNESS_SEED, 1, county, 3, [], tw), "same event, same substitutes");
  const providers = { sportingStatus: { rankings: () => ({}), npcTourCard: () => false } } as any;
  const ctx = { entitlements: new Map(), results: { SAME: new Map(), PREVIOUS: new Map() }, champions: new Map() } as any;
  for (const s of subs) assert.ok(evaluate(county, factsFor(npcParticipant(s, providers), ctx, county)).eligible, "a substitute meets the county rules");
  const juniors = row(14, "junior-development-night");
  const kids = substitutesFor(HARNESS_SEED, 1, { ...juniors, instance_key: "jdn:x" } as InstanceRow, 2, [], (juniors.snapshot as any).npcTierWeights);
  assert.ok(kids.every(k => k.age < 18), "junior nights get junior substitutes");
  const women = row(14, "women-tour");
  const ladies = substitutesFor(HARNESS_SEED, 1, { ...women, instance_key: "wt:x" } as InstanceRow, 2, [], (women.snapshot as any).npcTierWeights);
  assert.ok(ladies.every(p => p.worldKey.startsWith("women:")), "women's events get women's-category substitutes");
});
