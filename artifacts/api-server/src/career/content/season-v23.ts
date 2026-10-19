import type { EventDefinition, ScheduleSlot } from "../calendar/catalogue.ts";
import { R } from "../calendar/eligibility.ts";
import { identity } from "./events.ts";

const WORLD_OPEN_KEYS = [
  "world-ranking-open",
  "women-world-ranking-open",
  "youth-world-ranking-open",
  "girls-world-ranking-open",
] as const;
const QUALIFIER_KEYS = [
  "lakeside-qualifier-open",
  "lakeside-qualifier-women",
  "lakeside-qualifier-youth",
  "lakeside-qualifier-girls",
  "uk-lakeside-qualifier-open",
  "uk-lakeside-qualifier-women",
  "uk-lakeside-qualifier-youth",
  "uk-lakeside-qualifier-girls",
] as const;
export const V23_CALENDAR_REFRESH_KEYS = [
  ...WORLD_OPEN_KEYS,
  ...QUALIFIER_KEYS,
  "women-tour",
  "wdf-world-championship",
  "women-world-championship",
  "youth-world-championship",
  "wdf-world-girls-championship",
] as const;

const YOUTH = R.age({ maxAgeExclusive: 18 });
const OPEN_WORLD_TARGETS: Record<string, string> = {
  "open": "wdf-world-championship",
  "women": "women-world-championship",
  "youth": "youth-world-championship",
  "girls": "wdf-world-girls-championship",
};

/** Confirmed active 2026 WDF World Open and World Championship qualifier programmes. */
export function buildCatalogueV23(v22: readonly EventDefinition[]): readonly EventDefinition[] {
  const out = v22.map(original => ({ ...structuredClone(original), eventDatabaseVersion: 23 }));
  const find = (key: string) => {
    const d = out.find(event => event.key === key);
    if (!d) throw new Error(`Missing v23 event template: ${key}`);
    return d;
  };
  const openTemplate = find("wdf-world-championship");
  const womenTemplate = find("women-world-championship");
  const youthTemplate = find("youth-world-championship");
  const womenTour = find("women-tour");
  if (womenTour.schedule.kind !== "FIXED") throw new Error("Women's Tour must use a fixed schedule");
  womenTour.eligibility = R.all(R.women(), R.age({ minAge: 16 }));
  womenTour.schedule = {
    kind: "FIXED",
    slots: [
      ...womenTour.schedule.slots,
      { week: 39, day: 6, endDay: 6, venue: "forth-exchange" },
      { week: 39, day: 7, endDay: 7, venue: "forth-exchange" },
      { week: 41, day: 4, endDay: 4, venue: "capital-floor-hall" },
      { week: 41, day: 5, endDay: 5, venue: "capital-floor-hall" },
      { week: 41, day: 6, endDay: 6, venue: "capital-floor-hall" },
      { week: 41, day: 7, endDay: 7, venue: "capital-floor-hall" },
    ],
  };
  if (womenTour.content) {
    womenTour.content = {
      ...womenTour.content,
      summary: "The 24-event women's ranking series. Women aged 16 and over are eligible; each event contributes to the season ranking.",
    };
  }

  // Girls qualify to a separate girls division at the youth world championship.
  const girlsWorld: EventDefinition = {
    ...structuredClone(youthTemplate),
    key: "wdf-world-girls-championship",
    name: "World Girls Championship",
    family: "wdf-youth-world-championship",
    eventDatabaseVersion: 23,
    circuit: "WORLD_CHAMPIONSHIP",
    classification: "RANKING",
    rankingCategory: "WOMENS",
    eligibility: R.all(YOUTH, R.women()),
    entitlementIntake: ["wdf-world-girls-championship"],
    schedule: { kind: "FIXED", slots: [{ week: 48, day: 5, endDay: 7, venue: "midlands-oche" }] },
    legacyConcept: "WDF World Youth Championship girls division; distinct in-game name",
  };
  girlsWorld.content = {
    ...identity(girlsWorld, "youth-championships", "WORLD_CHAMPIONSHIP"),
    circuitName: "World youth circuit",
    summary: "The girls division of the world youth championship, open to eligible women players under 18. Championship entry is available through its qualifier route.",
  };
  out.push(girlsWorld);

  const worldOpenSlot: ScheduleSlot = { week: 29, day: 1, endDay: 6, venue: "midlands-oche" };
  const qualifierSlot: ScheduleSlot = { week: 29, day: 1, endDay: 6, venue: "midlands-oche" };
  const ukQualifierSlot: ScheduleSlot = { week: 44, day: 6, endDay: 7, venue: "midlands-oche" };

  const addEvent = (template: EventDefinition, key: string, name: string, family: string,
    eligibility: EventDefinition["eligibility"], slot: ScheduleSlot, tier: "FEATURED" | "TELEVISED",
    target?: string, qualifyingPlaces = 1) => {
    const d: EventDefinition = {
      ...structuredClone(template),
      key,
      name,
      family,
      eventDatabaseVersion: 23,
      circuit: target ? "WORLD_CHAMPIONSHIP" : "NATIONAL_AMATEUR",
      classification: target ? "QUALIFIER" : "RANKING",
      rankingCategory: target ? null : template.rankingCategory,
      presentation: {
        ...template.presentation,
        tier,
        featured: true,
        calendarPriority: target ? 82 : 78,
        brandingFamily: family,
        heroAssetKey: `hero:${family}`,
        badgeAssetKey: `badge:${family}`,
      },
      eligibility,
      fieldSize: 128,
      minimumEntrants: target ? 16 : 32,
      npcFill: [0.8, 1],
      fieldPolicy: "SELECTION",
      entitlementIntake: [],
      qualificationOutputs: target ? [{
        maxPosition: qualifyingPlaces,
        entitlementType: "EVENT_ENTRY",
        targetKey: target,
        targetSeason: "SAME",
        consumption: "SINGLE_USE",
      }] : [],
      schedule: { kind: "FIXED", slots: [{ ...slot }] },
      legacyConcept: target
        ? "WDF World Championship qualifier division; distinct in-game name"
        : "WDF World Open division; distinct in-game name",
    };
    d.content = {
      ...identity(d, target ? "wdf-qualifiers" : "wdf-world-open", target ? "WORLD_CHAMPIONSHIP" : "INTERNATIONAL_OPEN"),
      circuitName: target ? "World championship qualifying circuit" : "International open circuit",
      summary: target
        ? `${name}. A WDF-inspired singles qualifier; the top ${qualifyingPlaces} finisher${qualifyingPlaces === 1 ? "" : "s"} earn${qualifyingPlaces === 1 ? "s" : ""} an entry entitlement for the corresponding world championship division.`
        : `${name}. A WDF-inspired international singles ranking event, scheduled alongside the World Open programme.`,
    };
    out.push(d);
  };

  const divisions = [
    { id: "open", name: "Open", template: openTemplate, eligibility: openTemplate.eligibility, target: OPEN_WORLD_TARGETS.open, places: 2 },
    { id: "women", name: "Women's", template: womenTemplate, eligibility: womenTemplate.eligibility, target: OPEN_WORLD_TARGETS.women, places: 1 },
    { id: "youth", name: "Youth", template: youthTemplate, eligibility: YOUTH, target: OPEN_WORLD_TARGETS.youth, places: 2 },
    { id: "girls", name: "Girls", template: youthTemplate, eligibility: R.all(YOUTH, R.women()), target: OPEN_WORLD_TARGETS.girls, places: 1 },
  ] as const;

  for (const division of divisions) {
    const worldOpenKey = WORLD_OPEN_KEYS[["open", "women", "youth", "girls"].indexOf(division.id)];
    addEvent(division.template, worldOpenKey, `${division.name} World Ranking Open`, "wdf-world-ranking-open",
      division.eligibility, worldOpenSlot, "FEATURED");
    const target = division.target;
    const base = division.id;
    addEvent(division.template, `lakeside-qualifier-${base}`,
      `International World Championship Qualifier — ${division.name}`, "wdf-world-qualifiers",
      division.eligibility, qualifierSlot, "TELEVISED", target, division.places);
    addEvent(division.template, `uk-lakeside-qualifier-${base}`,
      `UK World Championship Qualifier — ${division.name}`, "wdf-uk-world-qualifiers",
      division.eligibility, ukQualifierSlot, "FEATURED", target, 1);
  }

  for (const key of ["wdf-world-championship", "women-world-championship", "youth-world-championship"] as const) {
    const d = find(key);
    const target = d.key;
    d.eligibility = R.any(R.qualified(target), d.eligibility);
    d.entitlementIntake = [...new Set([...d.entitlementIntake, target])];
  }
  const girls = find("wdf-world-girls-championship");
  girls.eligibility = R.any(R.qualified(girls.key), girls.eligibility);
  return Object.freeze(out);
}
