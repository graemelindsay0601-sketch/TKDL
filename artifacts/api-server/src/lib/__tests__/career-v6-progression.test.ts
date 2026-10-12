import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSeason } from "../../career/calendar/generation.ts";
import { evaluateRule, type ParticipantFacts } from "../../career/calendar/eligibility.ts";
import { catalogueFor } from "../../career/calendar/catalogue.ts";
import { CURRENT_EVENT_DATABASE_VERSION } from "../../career/calendar/config.ts";
import { CAREER_VERSIONS } from "../../career/config.ts";
import { humanInvited, type InstanceRow } from "../../career/calendar/engine.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";

/** Event database v6: progression & pacing edition (audit career-audit/progression-and-pacing). */
const facts = (over: Partial<ParticipantFacts> = {}): ParticipantFacts => ({ key: "HUMAN", kind: "HUMAN", country: "GBR", zone: "UK_IRELAND", locality: "ayrshire",
  age: 25, womenEligible: false, professionalStatus: "AMATEUR", tourCard: false, rankings: {}, entitlementTargets: new Set(), invited: false,
  results: { SAME: new Map(), PREVIOUS: new Map() }, defendingChampion: false, ...over });
const card = facts({ professionalStatus: "PROFESSIONAL", tourCard: true });

test("new saves use event database v6; v1–v5 catalogues are unchanged", () => {
  assert.equal(CURRENT_EVENT_DATABASE_VERSION, 6);
  assert.equal(CAREER_VERSIONS.eventDatabaseVersion, 6);
  assert.equal(catalogueFor(5).length, 92);
  assert.equal(catalogueFor(6).length, 94);
  assert.ok(catalogueFor(5).every(d => d.eventDatabaseVersion === 5));
  assert.ok(catalogueFor(6).every(d => d.eventDatabaseVersion === 6));
});

test("season 1: the Challenger Tour is open to any player without a Tour Card; from season 2 it needs Q-School", () => {
  const s1 = generateSeason(HARNESS_SEED, 6, 1).filter(d => d.definitionKey === "challenger-event");
  const s2 = generateSeason(HARNESS_SEED, 6, 2).filter(d => d.definitionKey === "challenger-event");
  assert.equal(s1.length, 20);
  assert.ok(s1.every(d => evaluateRule(d.snapshot.eligibility, facts()).eligible));
  assert.ok(s1.every(d => !evaluateRule(d.snapshot.eligibility, card).eligible));
  assert.ok(s2.every(d => !evaluateRule(d.snapshot.eligibility, facts()).eligible));
  assert.ok(s2.every(d => evaluateRule(d.snapshot.eligibility, facts({ entitlementTargets: new Set(["challenger-tour"]) })).eligible));
  // v5 keeps its authored season-1 rule (no Q-School, so no access).
  assert.ok(generateSeason(HARNESS_SEED, 5, 1).filter(d => d.definitionKey === "challenger-event").every(d => !evaluateRule(d.snapshot.eligibility, facts()).eligible));
  assert.equal(generateSeason(HARNESS_SEED, 6, 1).filter(d => d.circuit === "Q_SCHOOL").length, 0);
});

test("professional calendar spreads Pro Tour and Continental Series events through the season", () => {
  const s = generateSeason(HARNESS_SEED, 6, 2);
  const weeks = (key: string) => [...new Set(s.filter(d => d.definitionKey === key).map(d => d.startWeek))];
  const pro = weeks("pro-circuit-championship"), eds = weeks("european-dart-series");
  assert.equal(s.filter(d => d.definitionKey === "pro-circuit-championship").length, 46);
  assert.ok(Math.max(...pro) >= 44 && Math.min(...pro) === 5);
  // A Tour Card holder has a ranking event in every non-major week from 5 to 44.
  const majors = new Set([10, 29, 30, 40, 43]);
  for (let w = 5; w <= 44; w++) if (!majors.has(w)) assert.ok(pro.includes(w) || eds.includes(w), `week ${w} has no Pro Tour or Continental Series event`);
  const at = (key: string) => s.find(d => d.definitionKey === key)!.startWeek;
  assert.deepEqual([at("double-crown"), at("european-championship"), at("grand-slam-of-champions"), at("pro-circuit-finals"), at("world-darts-championship")], [40, 43, 45, 48, 50]);
  assert.ok(at("pro-circuit-finals") > Math.max(...pro), "Tour Finals follow the last Pro Tour event");
});

test("local New Year and Festive opens fill the empty weeks and are open to everyone in the country", () => {
  const s = generateSeason(HARNESS_SEED, 6, 2);
  const ny = s.filter(d => d.definitionKey === "new-year-open"), fest = s.filter(d => d.definitionKey === "festive-open");
  assert.ok(ny.length > 0 && ny.every(d => d.startWeek === 1));
  assert.ok(fest.length > 0 && fest.every(d => d.startWeek >= 49));
  const gbr = fest.find(d => d.country === "GBR")!;
  assert.ok(evaluateRule(gbr.snapshot.eligibility, card).eligible);
  assert.ok(new Set(fest.map(d => d.startWeek)).size >= 3);
});

test("PROG-01/06/11: amateur finals fill from ranking-eligible NPCs; no redundant Vault pass; amateur opens exclude card holders", () => {
  const v6 = new Map(catalogueFor(6).map(d => [d.key, d]));
  assert.deepEqual(v6.get("open-finals")!.npcFill, [1, 1]);
  assert.deepEqual(v6.get("vault-championship")!.npcFill, [1, 1]);
  assert.ok(!v6.get("vault-qualifier")!.qualificationOutputs.some(o => o.targetKey === "vault-tour"));
  const open = generateSeason(HARNESS_SEED, 6, 2).find(d => d.definitionKey === "national-open")!;
  assert.ok(evaluateRule(open.snapshot.eligibility, facts()).eligible);
  assert.ok(!evaluateRule(open.snapshot.eligibility, card).eligible);
});

test("PROG-07: the human is invited when inside an event's invitation count on the World Ranking (v6 only)", () => {
  const ws = { event_database_version: 6, snapshot: { invitationPolicy: { count: 8 } } } as unknown as InstanceRow;
  const human = (rank?: number) => ({ kind: "HUMAN" as const, rankings: (rank ? { "pro-world": rank } : {}) as Record<string, number> });
  assert.equal(humanInvited(human(8), ws), true);
  assert.equal(humanInvited(human(9), ws), false);
  assert.equal(humanInvited(human(), ws), false);
  assert.equal(humanInvited({ kind: "NPC", rankings: { "pro-world": 1 } }, ws), false);
  assert.equal(humanInvited(human(1), { ...ws, event_database_version: 5 } as InstanceRow), false);
  assert.equal(humanInvited(human(1), { ...ws, snapshot: { invitationPolicy: null } } as unknown as InstanceRow), false);
});
