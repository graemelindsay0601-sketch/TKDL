import type { EventDefinition, ScheduleSlot } from "../calendar/catalogue.ts";
import { R } from "../calendar/eligibility.ts";
import { knockout501 } from "../calendar/formats.ts";
import { VENUES } from "../calendar/geography.ts";
import type { EventContent, PrestigeClass } from "./world.ts";

const descriptor: Record<PrestigeClass, string> = {
  GRASSROOTS: "Local Field", REGIONAL: "Strong Regional Field", NATIONAL: "National-Level Field",
  INTERNATIONAL_OPEN: "International Open Field", SECONDARY_TOUR: "Elite Amateur Field",
  PROFESSIONAL_TOUR: "Professional Field", STAGE_SERIES: "International Stage Field", MAJOR: "World-Class Field", WORLD_CHAMPIONSHIP: "World Championship Field",
};
export function identity(d: EventDefinition, circuitId?: string, eventClass?: PrestigeClass): EventContent {
  const c = d.circuit;
  const cls = eventClass ?? (d.presentation.tier === "WORLD" ? "WORLD_CHAMPIONSHIP" : d.presentation.tier === "MAJOR" ? "MAJOR" :
    c === "PRO_CIRCUIT" ? "PROFESSIONAL_TOUR" : ["EUROPEAN_SERIES", "WORLD_SERIES", "INVITATIONAL"].includes(c) ? "STAGE_SERIES" :
    ["CHALLENGER", "VAULT", "Q_SCHOOL"].includes(c) ? "SECONDARY_TOUR" : c === "NATIONAL_AMATEUR" ? "NATIONAL" :
    ["COUNTY", "REGIONAL"].includes(c) ? "REGIONAL" : "GRASSROOTS");
  const ci = circuitId ?? (c === "WORLD_CHAMPIONSHIP" ? "palace" : c === "PRO_CIRCUIT" ? "pro-tour" : c === "EUROPEAN_SERIES" ? "continental" :
    c === "MAJOR" ? "majors" : c === "Q_SCHOOL" ? "q-school" : c === "CHALLENGER" ? "challenger" : c === "VAULT" ? "vault-tour" :
    c === "WORLD_SERIES" || c === "INVITATIONAL" ? "international" : c === "NATIONAL_AMATEUR" ? "open" : c === "COUNTY" ? "county" : c === "REGIONAL" ? "regional" : "grassroots");
  const specialTrophies: Record<string, string> = { "world-darts-championship": "sovereign", "double-crown": "double-crown",
    "open-championship": "open-masters-heritage", "vault-championship": "vault-geometric", "long-format-matchplay": "tall-championship",
    "grand-slam-of-champions": "championship-cup", "european-championship": "international-globe", "pro-circuit-finals": "silver-bowl" };
  const trophyId=specialTrophies[d.key] ?? (ci === "women" ? "cut-glass" : ci.startsWith("youth") || ci === "foundation" || ci === "development" ? "youth-rising-star" :
    c === "VAULT" ? "vault-geometric" : cls === "GRASSROOTS" ? "wood-silver-shield" : cls === "REGIONAL" ? "regional-craft" :
      cls === "INTERNATIONAL_OPEN" ? "international-globe" : cls === "PROFESSIONAL_TOUR" ? "championship-plate" : "silver-cup");
  return { version: 1, canonicalEventId: d.key, organisationId: ci.startsWith("vault") ? "vault" : ["foundation", "development", "youth-championships"].includes(ci) ? "yda" :
    ["q-school", "challenger", "pro-tour", "continental", "majors", "palace", "international", "women"].includes(ci) ? "wdu" : "iodf",
    circuitId: ci, eventClass: cls, trophyId,trophyIdentity:{id:`trophy:${d.key}`,designId:trophyId},
    titleSponsorId: cls==="GRASSROOTS"?null:ci.startsWith("vault")?"arcbyte":ci==="women"?"vela-sport":ci==="palace"?"meridian-energy":"northway-logistics",
    longevity: d.classification==="SPECIAL"?"OCCASIONAL":["MAJOR", "WORLD_CHAMPIONSHIP"].includes(cls) ? "PERMANENT" : "RECURRING",
    fieldDescription: descriptor[cls], themeKey: `event:${ci}` };
}
const slots = (weeks: number[], venues: string[], days = [6, 7]): ScheduleSlot[] =>
  weeks.flatMap((week, i) => days.map(day => ({ week, day, venue: venues[i % venues.length] })));
/** v3 is a new authored database. v1/v2 objects and established instances are never edited. */
export function expandWorldCatalogue(old: readonly EventDefinition[]): readonly EventDefinition[] {
  const out = old.map(original => {
    const d = structuredClone(original); d.eventDatabaseVersion = 3; d.legacyConcept = null;
    const names: Record<string, string> = { "long-format-matchplay": "The Match Trophy", "open-championship": "The Open Masters",
      "grand-slam-of-champions": "The Grand Championship", "european-championship": "Continental Finals", "pro-circuit-finals": "The Tour Finals",
      "world-darts-championship": "The Palace World Championship", "european-dart-series": "Continental Series — {city}",
      "european-series-qualifier": "Continental Series Associate Qualifier {n}", "pro-circuit-championship": "Pro Tour {n}",
      "challenger-event": "Challenger Tour {n}", "junior-development-night": "{city} Foundation Series", "junior-development-championship": "Foundation Championship" };
    d.name = names[d.key] ?? d.name;
    if (d.key === "pro-circuit-championship" && d.schedule.kind === "FIXED") d.schedule.slots = d.schedule.slots.slice(0, 28);
    if (d.key === "grand-slam-of-champions") d.format = knockout501([19, 21, 25, 31, 35], "major", 9);
     if (d.family === "junior-development-circuit") d.content = identity(d, "foundation");
    else d.content = identity(d);
    if(d.key==="sudden-death-night")d.content.longevity="RETIRABLE_MINOR";
    return d;
  });
  const base = (key: string) => out.find(d => d.key === key)!;
  const add = (source: string, key: string, name: string, schedule: ScheduleSlot[], changes: Partial<EventDefinition>, ci: string, cls?: PrestigeClass) => {
    const d: EventDefinition = { ...structuredClone(base(source)), ...changes, key, name, family: key,
      schedule: { kind: "FIXED", slots: schedule }, eventDatabaseVersion: 3, legacyConcept: null };
    d.content = identity(d, ci, cls); out.push(d); return d;
  };
  const scottish = ["ayr-pavilion", "burns-hall", "foundry-glasgow", "kelvin-assembly", "stirling-civic", "forth-exchange", "borders-pavilion", "granite-centre", "tay-assembly", "highland-events"];
  add("friday-night-501", "town-open", "{city} Open", slots([2, 7, 12, 17, 22, 27, 32, 37, 42, 47], scottish, [6]),
    { eligibility: R.open(), geography: { kind: "LOCALITY" } }, "grassroots");
  add("county-championship", "regional-classic", "{city} Regional Classic", slots([9, 16, 23, 30, 37], scottish.filter((_, i) => i % 2 === 0), [7]),
    { eligibility: R.all(R.country("{country}"), R.nonTourCard()), geography: { kind: "REGION" } }, "regional");
  add("amateur-world-masters", "national-open", "{countryName} Open", slots([12, 17, 22, 27, 32, 37],
    ["caledonia-hall", "capital-floor-hall", "riverside-hall-cardiff", "lagan-exchange", "lee-assembly", "seine-forum"], [6]),
    { eligibility: R.open(), fieldSize: 64, minimumEntrants: 8 }, "open");
  const openVenues = ["maas-hal-rotterdam", "scheldt-dome-antwerp", "seine-forum", "danube-halle-vienna", "vltava-arena-prague", "vistula-hall-warsaw", "castile-pavilion"];
  const international = add("amateur-world-masters", "international-open", "{city} International Open", slots([8, 14, 20, 26, 32, 38, 44], openVenues, [6]),
    { eligibility: R.open(), fieldSize: 64, minimumEntrants: 8, geography: { kind: "INTERNATIONAL", hostBonus: 1.8 } }, "continental-open", "INTERNATIONAL_OPEN");
  international.content!.longevity = "ROTATING_VENUE"; international.content!.venueRotation = openVenues;
  add("amateur-world-masters", "premier-open", "Premier Open", [{ week: 40, day: 5, endDay: 7, venue: "seine-forum" }],
    { eligibility: R.open(), fieldSize: 64, minimumEntrants: 8 }, "open", "INTERNATIONAL_OPEN");
  add("amateur-world-masters", "open-finals", "Open International Championship", [{ week: 46, day: 5, endDay: 7, venue: "maas-hal-rotterdam" }],
    { eligibility: R.any(R.ranking("open-world", 32), R.result("premier-open", 2, "SAME")), invitationPolicy: null,
      npcFill: [0, 0], fieldSize: 32, minimumEntrants: 8, seedingPolicy: { list: "open-world", seeds: 8 } }, "open", "INTERNATIONAL_OPEN");
  out.find(d=>d.key==="open-finals")!.content!.longevity="PERMANENT";
  for (const [id, name, venue, week] of [
    ["northern", "Northern Circuit Open", "northern-waterfront", 18], ["asia-pacific", "Asia-Pacific Open", "garden-city-arena", 24],
    ["north-american", "North American Open", "lakeshore-coliseum-toronto", 28], ["australasian", "Australasian Open", "southern-cross-hall", 34],
  ] as const) add("amateur-world-masters", `${id}-open`, name, [{ week, day: 6, endDay: 7, venue }],
    { eligibility: R.open(), minimumEntrants: 8, fieldSize: 32 }, id, "INTERNATIONAL_OPEN");
  // A3 already supports day-range bookings: these are paired weekend events, not full-week locks.
  add("challenger-event", "vault-tour", "Vault Tour — {city} {n}",
    slots([7, 13, 19, 25, 31, 37, 43], ["foundry-glasgow", "vault-studio-leeds", "severn-studio"], [2, 3]),
    { circuit: "VAULT", rankingCategory: "VAULT", profiles: base("vault-qualifier").profiles,
      eligibility: R.nonTourCard(), minimumEntrants: 8, fieldSize: 32, series: null, qSchool: null, qualificationOutputs: [],
      format: knockout501([7, 7, 9, 9, 11], "floor") }, "vault-tour");
  add("vault-masters", "vault-nights", "Vault Nights — {city}",
    slots([11, 18, 25, 32, 39], ["foundry-glasgow", "vault-studio-leeds", "severn-studio"], [5]),
    { eligibility: R.nonTourCard(), invitationPolicy: null, entitlementIntake: [], npcFill: [0.8, 1], fieldSize: 16 }, "vault-stage", "STAGE_SERIES");
  add("vault-masters", "vault-championship", "Vault Championship", [{ week: 45, day: 5, endDay: 7, venue: "foundry-glasgow" }],
    { eligibility: R.all(R.nonTourCard(), R.any(R.ranking("vault", 16),R.qualified("vault-championship"))), invitationPolicy: null, entitlementIntake: ["vault-championship"],
      npcFill: [0, 0], fieldSize: 16, minimumEntrants: 8, classification: "RANKING", rankingCategory: "VAULT",
      format: knockout501([9, 11, 13, 15], "stage", 3) }, "vault-stage", "SECONDARY_TOUR");
  const youth = R.age({ maxAgeExclusive: 23 });
  add("junior-development-championship", "development-tour", "Development Tour {n}",
    slots([8, 15, 22, 29, 36, 43], ["stirling-civic", "midlands-oche", "canal-conference"], [6, 7]),
    { eligibility: youth, rankingCategory: "YOUTH", format: knockout501([5, 5, 7, 7, 9], "floor"), npcFill: [0.75, 1] }, "development");
  add("junior-development-championship", "youth-masters", "Youth Masters", [{ week: 38, day: 6, endDay: 7, venue: "tay-assembly" }],
    { eligibility: youth, rankingCategory: "YOUTH" }, "youth-championships","NATIONAL");
  add("junior-development-championship", "youth-world-championship", "Youth World Championship", [{ week: 48, day: 6, endDay: 7, venue: "caledonia-hall" }],
    { eligibility: youth, rankingCategory: "YOUTH", presentation: { ...base("junior-development-championship").presentation, tier: "TELEVISED" } }, "youth-championships","NATIONAL");
  const women = R.women();
  add("junior-development-championship", "women-tour", "Women's Tour {n}",
    slots([6, 10, 14, 18, 22, 26, 30, 34, 38], ["forth-exchange", "capital-floor-hall", "maas-hal-rotterdam", "seine-forum", "lagan-exchange"], [6, 7]),
    { eligibility: women, rankingCategory: "WOMENS", profiles: base("amateur-world-masters").profiles,
      format: knockout501([7, 7, 9, 9, 11], "floor"), npcTierWeights: { GRASSROOTS: 0.3, AMATEUR: 1, PROFESSIONAL: 1, ELITE: 1 },
      fieldSize: 32, minimumEntrants: 8 }, "women","SECONDARY_TOUR");
  add("women-tour", "women-masters", "Women's Masters", [{ week: 42, day: 6, endDay: 7, venue: "seine-forum" }], {}, "women","NATIONAL");
  add("women-tour", "women-world-championship", "Women's World Championship", [{ week: 49, day: 5, endDay: 7, venue: "clyde-arena" }],
    { presentation: { ...base("women-tour").presentation, tier: "TELEVISED", featured: true } }, "women","MAJOR");
  // Reuse existing sporting qualification, formats and profile references.
  for (const d of out) {
    if (d.circuit === "NATIONAL_AMATEUR" && d.rankingCategory === "AMATEUR_NATIONAL") d.rankingCategory = "AMATEUR_NATIONAL";
    if (d.schedule.kind === "FIXED") for (const s of d.schedule.slots) {
      if (!VENUES.some(v => v.key === s.venue)) throw new Error(`Unknown authored venue ${s.venue}`);
    }
  }
  const qualifier=out.find(d=>d.key==="vault-qualifier")!;
  qualifier.qualificationOutputs=[
    {maxPosition:5,entitlementType:"SERIES_ACCESS",targetKey:"vault-tour",targetSeason:"SAME",consumption:"SEASON_PASS"},
    {maxPosition:1,entitlementType:"EVENT_ENTRY",targetKey:"vault-championship",targetSeason:"SAME",consumption:"SINGLE_USE"},
  ];
  return Object.freeze(out.filter(d=>!["vault-series-night","vault-masters"].includes(d.key)));
}
