import test from "node:test";
import assert from "node:assert/strict";
import { sponsorProspects, describeRequirement } from "../../career/finance/sponsor-prospects.ts";
import type { SportingFacts } from "../../career/finance/sponsors.catalogue.ts";

const rookie: SportingFacts = { careerStarted: true, titles: 0, bestFinishByCircuit: {}, qualifications: [], professionalStatus: "AMATEUR", tourCard: false, worldRanking: null };

test("a rookie sees every tier, none met, with what each wants", () => {
  const p = sponsorProspects(rookie, []);
  assert.deepEqual(p.map(x => x.tier), ["LOCAL", "REGIONAL", "PROFESSIONAL", "ELITE"]);
  for (const x of p) { assert.equal(x.signed, false); assert.ok(x.requirement && x.requirement.length > 0); assert.ok(x.sponsors > 0); }
  assert.equal(p[0].met, false);
});

test("one title meets the local tier; signing it marks it signed", () => {
  const p = sponsorProspects({ ...rookie, titles: 1 }, ["LOCAL"]);
  assert.equal(p[0].met, true);
  assert.equal(p[0].signed, true);
  assert.equal(p[3].met, false);
});

test("requirements read in plain words with progress", () => {
  const d = describeRequirement({ fact: "titles", min: 3 }, { ...rookie, titles: 1 });
  assert.equal(d.met, false);
  assert.match(d.text, /win 3 titles/);
  assert.equal(d.progress, "1 of 3 won");
  const r = describeRequirement({ any: [{ fact: "tourCard" }, { fact: "worldRanking", maxPosition: 128 }] }, { ...rookie, worldRanking: 90 });
  assert.equal(r.met, true);
});

test("an unranked sentinel reads as not ranked", () => {
  const d = describeRequirement({ fact: "worldRanking", maxPosition: 16 }, { ...rookie, worldRanking: Number.MAX_SAFE_INTEGER });
  assert.equal(d.progress, "not ranked yet");
});
