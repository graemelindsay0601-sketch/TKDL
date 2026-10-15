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
