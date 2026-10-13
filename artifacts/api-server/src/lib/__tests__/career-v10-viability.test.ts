import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogueFor } from "../../career/calendar/catalogue.ts";
import { CURRENT_EVENT_DATABASE_VERSION } from "../../career/calendar/config.ts";
import { generateSeason } from "../../career/calendar/generation.ts";
import { evaluateRule, type ParticipantFacts } from "../../career/calendar/eligibility.ts";
import { viabilityOf } from "../../career/calendar/viability.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";

/** Event database v10: small local events share thin player pools, so far fewer are cancelled. */
const v10 = new Map(catalogueFor(10).map(d => [d.key, d])), v9 = new Map(catalogueFor(9).map(d => [d.key, d]));

test("v10 is current; only the small-event tuning differs from v9", () => {
  assert.ok(CURRENT_EVENT_DATABASE_VERSION >= 10);
  const changed = [...v10.keys()].filter(k => JSON.stringify({ ...v10.get(k), eventDatabaseVersion: 0 }) !== JSON.stringify({ ...v9.get(k), eventDatabaseVersion: 0 })).sort();
  assert.deepEqual(changed, ["aus-regional-series", "bel-regional-series", "can-regional-series", "club-league-night", "county-501-open", "county-championship", "festive-open",
    "fra-regional-series", "friday-night-501", "junior-development-night", "midweek-league-night", "new-year-open", "nzl-regional-series", "sunday-league-sprint", "swe-regional-series"]);
});

test("club nights take a share of the local pool, and there are fewer of them", () => {
  assert.deepEqual(v10.get("club-league-night")!.npcFill, [0.25, 0.5]);
  const count = (v: number) => generateSeason(HARNESS_SEED, v, 1).filter(d => d.definitionKey === "club-league-night").length;
  assert.ok(count(10) < count(9) * 0.7, "about 40% fewer club league nights");
});

test("Friday Night 501 can run where the country has few players: locals first, the zone tops up", () => {
  const nz = generateSeason(HARNESS_SEED, 10, 1).find(d => d.definitionKey === "friday-night-501" && d.country === "NZL");
  assert.ok(nz, "Friday nights still run in New Zealand");
  const player = (country: string, zone: string): ParticipantFacts => ({ key: "N", kind: "NPC", country, zone: zone as ParticipantFacts["zone"], locality: null, age: 30, womenEligible: false,
    professionalStatus: "AMATEUR", tourCard: false, rankings: {}, entitlementTargets: new Set(), invited: false, results: { SAME: new Map(), PREVIOUS: new Map() }, defendingChampion: false });
  assert.ok(evaluateRule(nz!.snapshot.eligibility, player("AUS", "REST_OF_WORLD")).eligible, "an Australian amateur can top up an Auckland field");
  assert.ok(!evaluateRule(nz!.snapshot.eligibility, player("GBR", "UK_IRELAND")).eligible);
});

test("the Canadian series draws on the region; small-pool series run with six", () => {
  const can = v10.get("can-regional-series")!;
  assert.equal(can.minimumEntrants, 6);
  assert.match(JSON.stringify(can.eligibility), /REST_OF_WORLD/);
  assert.deepEqual(v10.get("usa-regional-series")!.eligibility, v9.get("usa-regional-series")!.eligibility, "the US and Japanese series stay national (they fill)");
});

test("viability: small local events state the minimum and when the field is set; settled events say so; others say nothing", () => {
  const base = { circuit: "GRASSROOTS", classification: "RANKING", minimum_entrants: 4, entrant_count: 0, registration_closes_week: 12, status_reason: null };
  assert.deepEqual(viabilityOf({ ...base, status: "REGISTRATION_OPEN" } as never), { status: "PENDING", minimum: 4, fieldSetWeek: 12, entrants: null });
  assert.deepEqual(viabilityOf({ ...base, status: "DRAWN", entrant_count: 9 } as never), { status: "CONFIRMED", minimum: 4, fieldSetWeek: 12, entrants: 9 });
  assert.equal(viabilityOf({ ...base, status: "CANCELLED", status_reason: "INSUFFICIENT_ENTRANTS" } as never)!.status, "CANCELLED");
  assert.equal(viabilityOf({ ...base, circuit: "PRO_CIRCUIT", status: "SCHEDULED" } as never), null);
  assert.equal(viabilityOf({ ...base, classification: "SPECIAL", circuit: "SPECIAL", status: "SCHEDULED" } as never), null);
});
