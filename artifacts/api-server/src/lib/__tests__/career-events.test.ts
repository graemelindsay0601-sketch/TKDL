import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSeason, catalogue, SUPPORTED_FORMAT } from "../../career/events/catalogue.ts";
import { calendarReport } from "../../career/events/harness.ts";
import { capability } from "../../career/events/capability.ts";
import { evaluate, overlaps } from "../../career/events/eligibility.ts";
import { createDraw, populateRound, resultFromDraw, matchOperationKey } from "../../career/events/draw.ts";
import { definitionSchema, type Entrant, type Rule, type SportingFacts } from "../../career/events/types.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";
const seed = HARNESS_SEED;
const human: Entrant = { key: "human", npcId: null, name: "You", country: "GBR", region: "Scotland", status: "ACTIVE", professionalStatus: "AMATEUR", tier: "GRASSROOTS" };

test("calendar is deterministic, versioned, dense, international and bounded to 52 weeks", () => {
  const a = generateSeason(seed, 1, 1);
  assert.deepEqual(a, generateSeason(seed, 1, 1));
  assert.notDeepEqual(a, generateSeason("bc".repeat(32), 1, 1));
  assert.notDeepEqual(a, generateSeason(seed, 1, 2));
  assert.throws(() => generateSeason(seed, 2, 1));
  assert.ok(a.length > 200);
  assert.equal(new Set(a.map(e => e.id)).size, a.length);
  assert.ok(a.every(e => e.startDay >= 0 && e.endDay <= 363));
  assert.ok(new Set(a.map(e => e.venue.country)).size >= 7);
  const report = calendarReport();
  assert.equal(report.orphanTargets.length, 0); assert.equal(report.invalidDefinitions, 0); assert.ok(report.concurrentDays > 0);
});
test("definition instances are independent snapshots; Palace and regional Q-School metadata persist", () => {
  const a = generateSeason(seed, 1, 1), before = structuredClone(a[0]);
  catalogue(1)[0].name = "Changed master copy";
  assert.deepEqual(a[0], before);
  const q = a.filter(e => e.definition.circuit === "Q_SCHOOL");
  assert.equal(q.length, 8); assert.equal(new Set(q.map(e => e.definition.pathway)).size, 2);
  assert.deepEqual([...new Set(q.map(e => e.definition.format.stage))], [1, 2, 3, 4]);
  const worlds = a.find(e => e.definition.key === "worlds")!;
  assert.equal(worlds.venue.name, "The Palace"); assert.equal(worlds.definition.fieldSize, 128);
});
test("composable rules explain unknown providers and NOT cannot turn missing authority into permission", () => {
  const yes = (rule: Rule, facts: SportingFacts = {}, entitlement = false) => evaluate(rule, human, facts, entitlement);
  assert.ok(yes({ op: "ALL_OF", rules: [{ op: "OPEN_ENTRY" }, { op: "REGION", values: ["Scotland"] }] }).eligible);
  assert.ok(yes({ op: "ANY_OF", rules: [{ op: "TOUR_CARD" }, { op: "ENTITLEMENT" }] }, {}, true).eligible);
  assert.ok(yes({ op: "NOT", rule: { op: "COUNTRY", values: ["DEU"] } }).eligible);
  assert.ok(!yes({ op: "NOT", rule: { op: "TOUR_CARD" } }).eligible);
  assert.ok(!yes({ op: "TOUR_CARD" }).eligible);
  assert.ok(yes({ op: "TOUR_CARD" }, { tourCard: true }).eligible);
  for (const category of ["PRO", "AMATEUR", "REGIONAL"] as const) assert.ok(yes({ op: "RANK", category, maximum: 32 }, { ranks: { [category]: 12 } }).eligible);
  assert.ok(yes({ op: "INVITATION" }, { invited: true }).eligible);
  assert.ok(yes({ op: "DEFENDING_CHAMPION" }, { defendingChampion: true }).eligible);
  assert.ok(yes({ op: "PREVIOUS_RESULT", family: "local", maximum: 2 }, { previous: { local: 1 } }).eligible);
  assert.deepEqual(yes({ op: "REGION", values: ["Bremen"] }).blockingReasons, ["REQUIRES_REGION"]);
  assert.ok(!evaluate({ op: "OPEN_ENTRY" }, { ...human, status: "RETIRED" }, {}, false).eligible);
});
test("unsupported scoring and tournament structures fail explicitly without format conversion", () => {
  assert.equal(capability(SUPPORTED_FORMAT).status, "SUPPORTED");
  for (const change of [{ startingScore: 301 }, { inRule: "DOUBLE" as const }, { game: "CRICKET" as const }, { bestOfSets: 5, legsPerSet: 5 }, { structure: "GROUPS_KNOCKOUT" as const }, { firstThrowMethod: "BULL_UP_REQUIRED" as const }]) {
    assert.equal(capability({ ...SUPPORTED_FORMAT, ...change }).status, "UNSUPPORTED_FORMAT");
  }
});
test("special classification cannot carry ranking or ordinary qualification outputs", () => {
  const special = catalogue(1).find(d => d.classification === "SPECIAL")!;
  assert.equal(special.rankingCategory, null); assert.equal(special.qualification, null);
  assert.ok(!definitionSchema.safeParse({ ...special, rankingCategory: "PRO" }).success);
  assert.ok(!definitionSchema.safeParse({ ...special, qualification: { targetKey: "worlds", targetKind: "EVENT", top: 1 } }).success);
});
test("all large and non-power-of-two field sizes have valid deterministic seeded draws and byes", () => {
  for (const n of [8, 16, 24, 32, 48, 64, 96, 128]) {
    const people = Array.from({ length: n }, (_, i) => ({ ...human, key: `p${i}` }));
    const draw = createDraw(people, seed, 1, "event", ["p0", "p1"]);
    assert.deepEqual(draw, createDraw(people, seed, 1, "event", ["p0", "p1"]));
    assert.equal(draw.slots.filter(Boolean).length, n); assert.equal(new Set(draw.slots.filter(Boolean)).size, n);
    assert.ok(Math.abs(draw.slots.indexOf("p0") - draw.slots.indexOf("p1")) >= draw.slots.length / 2);
    for (let r = 0; r < draw.rounds.length; r++) {
      populateRound(draw, r);
      for (const m of draw.rounds[r]) { assert.ok(m.a || m.b); m.winner = m.a ?? m.b; m.loser = m.a && m.b ? m.b : null; m.source = m.a && m.b ? "A2" : "BYE"; }
    }
    const result = resultFromDraw(draw); assert.equal(result.finishes.length, n); assert.equal(result.finishes.filter(f => f.position === 1).length, 1);
  }
  assert.throws(() => createDraw([human, human], seed, 1, "bad"));
});
test("windows overlap inclusively and canonical match keys include season/event/round/match", () => {
  assert.ok(overlaps({ startDay: 4, endDay: 6 }, { startDay: 6, endDay: 8 }));
  assert.ok(!overlaps({ startDay: 4, endDay: 6 }, { startDay: 7, endDay: 8 }));
  assert.notEqual(matchOperationKey(1, "e1", "ko:r1:m1"), matchOperationKey(1, "e2", "ko:r1:m1"));
  assert.notEqual(matchOperationKey(1, "e1", "ko:r1:m1"), matchOperationKey(2, "e1", "ko:r1:m1"));
});
