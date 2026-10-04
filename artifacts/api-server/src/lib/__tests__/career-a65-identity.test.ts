import { test } from "node:test";
import assert from "node:assert/strict";
import { AGE_POLICY, ageOn, careerAge, careerDate, careerStartDateFor, eligibleFrom, validateDateOfBirth } from "../../career/identity/age.ts";
import { evaluateRule, R, type ParticipantFacts } from "../../career/calendar/eligibility.ts";
import { generateInitialWorld, generateJuniorCohort, JUNIOR_COHORT } from "../../career/world/generation.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";
import { toCareerBotConfig } from "../../career/world/bot-adapter.ts";
import { createPerformance } from "../../career/world/performance.ts";
import { scopedRandom } from "../../career/world/random.ts";
import { EVENT_CATALOGUE_V1, EVENT_CATALOGUE_V2, catalogueFor } from "../../career/calendar/catalogue.ts";

const id = { dateOfBirth: "2010-03-20", careerStartDate: "2025-01-01" };

test("Career dates are deterministic from the persisted start date (52-week seasons), never the real clock", () => {
  assert.equal(careerStartDateFor(new Date("2025-07-09T10:00:00Z")), "2025-01-01");
  assert.equal(careerDate("2025-01-01", 1, 1), "2025-01-01");
  assert.equal(careerDate("2025-01-01", 1, 364), "2025-12-30");
  assert.equal(careerDate("2025-01-01", 2, 1), "2025-12-31");
  assert.throws(() => careerDate("2025-01-01", 1, 365));
});

test("age is derived from Career date and crosses birthdays between seasons", () => {
  assert.equal(careerAge(id, 1, 1), 14);
  assert.equal(careerAge(id, 1, 80), 15, "birthday on 20 March of season 1");
  assert.equal(careerAge(id, 2, 1), 15);
  assert.equal(careerAge(id, 2, 80), 16);
  assert.equal(careerAge(id, 4, 100), 18);
  assert.equal(careerAge({ dateOfBirth: null, careerStartDate: "2025-01-01" }, 1, 1), null, "no DOB = unknown, not invented");
  assert.equal(ageOn("2008-02-29", "2024-02-28"), 15); assert.equal(ageOn("2008-02-29", "2024-02-29"), 16);
});

test("minimum start age 15 and a sanity upper bound; not a sporting rule", () => {
  assert.doesNotThrow(() => validateDateOfBirth("2010-01-01", "2025-01-01"));
  assert.throws(() => validateDateOfBirth("2010-01-02", "2025-01-01"), /at least 15/);
  assert.doesNotThrow(() => validateDateOfBirth("1945-06-01", "2025-01-01"));
  assert.throws(() => validateDateOfBirth("1900-01-01", "2025-01-01"), /range/);
  assert.throws(() => validateDateOfBirth("2010-02-31", "2025-01-01"), /real date/);
  assert.equal(AGE_POLICY.minimumCareerStartAge, 15);
});

test("eligible-from is computed in Career-world time", () => {
  const e = eligibleFrom({ dateOfBirth: "2010-03-20", careerStartDate: "2025-01-01" }, 16, 1, 1)!;
  assert.equal(e.date >= "2026-03-20", true);
  assert.equal(e.season, 2);
  assert.equal(eligibleFrom({ dateOfBirth: "1990-01-01", careerStartDate: "2025-01-01" }, 16, 3, 10)!.season, 3, "already eligible: from now");
});

test("AGE rule: junior accepts under-18, refuses 18+, unknown age is PROFILE_INCOMPLETE", () => {
  const base = { key: "HUMAN", kind: "HUMAN", country: "GBR", zone: "UK_IRELAND", locality: "ayrshire", professionalStatus: "AMATEUR", tourCard: false, rankings: {},
    entitlementTargets: new Set<string>(), invited: false, results: { SAME: new Map(), PREVIOUS: new Map() }, defendingChampion: false } as unknown as ParticipantFacts;
  const rule = R.age({ maxAgeExclusive: AGE_POLICY.juniorMaxAgeExclusive });
  assert.equal(evaluateRule(rule, { ...base, age: 15 }).eligible, true);
  assert.deepEqual(evaluateRule(rule, { ...base, age: 18 }).reasons, ["ABOVE_MAXIMUM_AGE"]);
  assert.deepEqual(evaluateRule(R.age({ minAge: 16 }), { ...base, age: 15 }).reasons, ["BELOW_MINIMUM_AGE"]);
  assert.deepEqual(evaluateRule(rule, { ...base, age: null }).reasons, ["PROFILE_INCOMPLETE"]);
});

test("age never changes opponent strength: bot config depends on the NPC, context and difficulty only", () => {
  const npc = generateInitialWorld(HARNESS_SEED, 1)[10];
  const perf = () => createPerformance(npc, { category: "local", roundImportance: 0.5, elimination: true }, "STANDARD", scopedRandom(HARNESS_SEED, 1, "performance", 1, "k", npc.id));
  // toCareerBotConfig has no human input at all; same match = same bot for a 15- or 40-year-old human.
  assert.deepEqual(toCareerBotConfig(perf()), toCareerBotConfig(perf()));
  assert.equal(toCareerBotConfig.length <= 2, true);
});

test("event database v2: v1 unchanged, Double Crown replaces the Grand Prix slot, junior circuit added", () => {
  assert.equal(catalogueFor(1), EVENT_CATALOGUE_V1);
  assert.ok(EVENT_CATALOGUE_V1.some(d => d.key === "double-start-grand-prix") && !EVENT_CATALOGUE_V1.some(d => d.key.startsWith("junior")));
  const dc = EVENT_CATALOGUE_V2.find(d => d.key === "double-crown")!;
  assert.deepEqual([dc.format.inRule, dc.format.outRule, dc.format.scoringUnit, dc.eventDatabaseVersion], ["DOUBLE", "DOUBLE", "SETS", 2]);
  assert.ok(!EVENT_CATALOGUE_V2.some(d => d.key === "double-start-grand-prix"));
  const juniors = EVENT_CATALOGUE_V2.filter(d => d.family === "junior-development-circuit");
  assert.equal(juniors.length, 2);
  for (const j of juniors) assert.ok(JSON.stringify(j.eligibility).includes(`"maxAgeExclusive":${AGE_POLICY.juniorMaxAgeExclusive}`));
  assert.ok(!JSON.stringify([dc, ...juniors]).match(/\bJDC\b|PDC|Grand Prix"/), "no protected branding in A6.5 content");
});

test("junior cohort (v2 worlds only) adds 16-17-year-old NPCs on separate keys; v1 players unchanged", () => {
  const v1 = generateInitialWorld(HARNESS_SEED, 1);
  const juniors = generateJuniorCohort(HARNESS_SEED, 1, 1, JUNIOR_COHORT.initial, v1, "initial");
  assert.equal(juniors.length, 40);
  assert.ok(juniors.every(n => n.age >= 16 && n.age <= 17 && n.worldKey.startsWith("junior:")));
  assert.deepEqual(generateInitialWorld(HARNESS_SEED, 1), v1, "v1 world byte-identical");
  const names = new Set([...v1, ...juniors].map(n => `${n.firstName} ${n.surname}`));
  assert.equal(names.size, 260, "distinct names");
  const intake = generateJuniorCohort(HARNESS_SEED, 1, 2, JUNIOR_COHORT.annualIntake, [...v1, ...juniors], "intake:2");
  assert.ok(intake.every(n => n.age === 16));
});

test("home region (A6.5): the chosen locality key sets the home country, so non-GB Careers have local events", async () => {
  const { A3_PLACEHOLDER_STATUS } = await import("../../career/calendar/providers.ts");
  const { travelBand } = await import("../../career/finance/travel.ts");
  const home = (homeLocality?: string) => A3_PLACEHOLDER_STATUS.human({ settings_snapshot: homeLocality ? { homeLocality } : {}, has_tour_card: false } as never);
  assert.deepEqual([home().country, home().locality], ["GBR", "ayrshire"], "legacy default unchanged");
  assert.equal(home("north-east").country, "GBR");
  assert.deepEqual([home("leinster").country, home("leinster").zone], ["IRL", "UK_IRELAND"]);
  assert.equal(home("utrecht").country, "NLD");
  assert.equal(home("ontario").country, "CAN");
  // Same-county Irish venue is LOCAL for a Leinster player; a British pub night is a cross-border trip.
  const h = home("leinster");
  assert.equal(travelBand(h, { locality_key: "leinster", venue_key: "x", country: "IRL", zone: "UK_IRELAND" }), "LOCAL");
  assert.equal(travelBand(h, { locality_key: "ayrshire", venue_key: "x", country: "GBR", zone: "UK_IRELAND" }), "UK_IRELAND");
});
