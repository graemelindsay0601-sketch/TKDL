import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSeason } from "../../career/calendar/generation.ts";
import { evaluateRule, type ParticipantFacts } from "../../career/calendar/eligibility.ts";
import { catalogueFor } from "../../career/calendar/catalogue.ts";
import { CURRENT_EVENT_DATABASE_VERSION } from "../../career/calendar/config.ts";
import { COUNTY_CATCHMENTS, LOCALITIES, VENUES, zoneOf } from "../../career/calendar/geography.ts";
import { venueContent } from "../../career/content/world.ts";
import { REGIONAL_TOURS_V7, NATIONAL_LADDERS_V7 } from "../../career/content/season-v7.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";

/** Event database v7: an amateur-to-pro ladder in every starting country, plus regional tours. */
const amateur = (locality: string, over: Partial<ParticipantFacts> = {}): ParticipantFacts => {
  const l = LOCALITIES.find(x => x.key === locality)!;
  return { key: "HUMAN", kind: "HUMAN", country: l.country, zone: zoneOf(l.country), locality, age: 25, womenEligible: false, professionalStatus: "AMATEUR",
    tourCard: false, rankings: {}, entitlementTargets: new Set(), invited: false, results: { SAME: new Map(), PREVIOUS: new Map() }, defendingChampion: false, ...over };
};
const season = generateSeason(HARNESS_SEED, 7, 2);
const meaningful = (facts: ParticipantFacts) => {
  const catchment = new Set(COUNTY_CATCHMENTS[facts.locality!] ?? [facts.locality]);
  return season.filter(d => d.executable && ["RANKING", "QUALIFIER"].includes(d.classification) && d.circuit !== "SPECIAL"
    && !(d.localityKey && ["GRASSROOTS", "COUNTY"].includes(d.circuit) && !catchment.has(d.localityKey)) && evaluateRule(d.snapshot.eligibility, facts).eligible);
};

test("new saves use event database v7; v6 is unchanged", () => {
  assert.equal(CURRENT_EVENT_DATABASE_VERSION, 7);
  assert.equal(catalogueFor(6).length, 94);
  assert.ok(catalogueFor(6).every(d => d.eventDatabaseVersion === 6));
  assert.ok(catalogueFor(7).every(d => d.eventDatabaseVersion === 7));
  assert.equal(catalogueFor(7).length, 149);
});

test("every starting country has its own ladder: series, classic, masters and a national championship", () => {
  for (const country of Object.keys(NATIONAL_LADDERS_V7)) {
    const c = country.toLowerCase();
    for (const key of [`${c}-regional-series`, `${c}-classic`, `${c}-masters`, `national-amateur-${c}`])
      assert.ok(season.some(d => d.definitionKey === key && d.country === country), `${key} hosted in ${country}`);
  }
});

test("an amateur in any starting location has something meaningful to enter in almost every week", () => {
  for (const home of LOCALITIES) {
    if (!["ayrshire", "northern-ireland", "flanders", "ile-de-france", "stockholm", "victoria", "ontario", "new-york", "kanto", "auckland", "utrecht", "hessen", "munster"].includes(home.key)) continue;
    const options = meaningful(amateur(home.key, { entitlementTargets: new Set(["challenger-tour"]) }));
    const empty = Array.from({ length: 52 }, (_, i) => i + 1).filter(w => !options.some(d => d.startWeek === w));
    assert.ok(empty.length <= 12, `${home.key}: ${empty.length} empty weeks (${empty.join(",")})`);
  }
});

test("regional tours are restricted to their region, run through the season and finish with a finals", () => {
  for (const tour of REGIONAL_TOURS_V7) {
    const events = season.filter(d => d.definitionKey === tour.key), finals = season.filter(d => d.definitionKey === `${tour.key}-finals`);
    assert.equal(events.length, tour.weeks.length * 2, tour.key);
    assert.equal(finals.length, 1);
    assert.ok(Math.max(...events.map(d => d.startWeek)) < finals[0].startWeek, `${tour.key} finals follow the tour`);
    assert.ok(events.every(d => d.snapshot.qualificationOutputs.some(o => o.targetKey === `${tour.key}-finals`)));
    const places = finals[0].snapshot.qualificationOutputs.find(o => o.targetKey === "world-championship")?.maxPosition ?? 0;
    assert.equal(places, tour.finals.worldChampionshipPlaces, `${tour.key} World Championship places`);
  }
  const asian = season.find(d => d.definitionKey === "asian-tour")!;
  assert.ok(evaluateRule(asian.snapshot.eligibility, amateur("kanto")).eligible);
  assert.ok(!evaluateRule(asian.snapshot.eligibility, amateur("ayrshire")).eligible, "Asian Tour is for Asian players");
  const na = season.find(d => d.definitionKey === "north-american-tour")!;
  assert.ok(evaluateRule(na.snapshot.eligibility, amateur("new-york")).eligible && evaluateRule(na.snapshot.eligibility, amateur("ontario")).eligible);
  const soft = season.filter(d => d.definitionKey === "soft-tip-series");
  assert.ok(soft.some(d => d.country === "USA") && soft.some(d => d.country === "JPN"), "soft-tip in the USA and Japan");
  assert.ok(soft.every(d => d.executable), "soft-tip events are playable in the live scorer");
  assert.ok(!evaluateRule(asian.snapshot.eligibility, amateur("kanto", { tourCard: true, professionalStatus: "PROFESSIONAL" })).eligible, "tours are for non-card players");
});

test("country-locked events lock before zone-wide and open events, so national fields are not starved", () => {
  const v7 = new Map(catalogueFor(7).map(d => [d.key, d]));
  for (const key of ["gbr-regional-series", "jpn-classic", "national-amateur-usa", "asian-tour", "north-american-tour"])
    assert.ok(v7.get(key)!.presentation.calendarPriority > v7.get("challenger-event")!.presentation.calendarPriority, key);
  for (const key of ["nordic-baltic-tour", "oceanic-tour", "soft-tip-series", "european-development-series"])
    assert.ok(v7.get(key)!.presentation.calendarPriority < v7.get("challenger-event")!.presentation.calendarPriority, key);
});

test("every venue used by v7 has map coordinates and venue content", () => {
  const used = new Set(season.map(d => d.venueKey));
  for (const key of used) { const content = venueContent(key); assert.ok(Number.isFinite(content.mapAnchor.latitude), key); }
  for (const v of VENUES) assert.ok(venueContent(v.key).mapAnchor, v.key);
});
