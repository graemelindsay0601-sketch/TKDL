import type { EventDefinition, ScheduleSlot } from "../calendar/catalogue.ts";
import { identity } from "./events.ts";

export const V19_ADDED_EVENT_KEYS = [
  "wdf-world-championship",
  "wdf-world-masters",
  "wdf-world-cup",
  "wdf-europe-cup",
  "wdf-asia-pacific-cup",
  "wdf-gold-open",
  "wdf-silver-open",
  "wdf-bronze-open",
  "wdf-nevada-open",
  "wdf-low-countries-open",
  "wdf-caledonian-open",
  "wdf-manx-open",
  "wdf-ulster-open",
  "wdf-baltic-open",
  "wdf-britannia-open",
  "wdf-danube-masters",
  "wdf-emerald-open",
  "wdf-bohemian-open",
  "wdf-mediterranean-masters",
  "wdf-southern-cross-open",
  "pdc-womens-matchplay",
  "pdc-youth-world-championship",
] as const;

const DISTINCT_CIRCUIT_NAMES: Record<string, string> = {
  "thursday-night-darts": "Premier Darts League",
  "amateur-world-masters": "International Amateur Masters",
  "youth-world-championship": "WDF Youth World Championship",
  "women-world-championship": "WDF Women's World Championship",
  "women-masters": "WDF Women's Masters",
  "youth-masters": "WDF Youth Masters",
};

const fixed = (week: number, venue: string): ScheduleSlot[] => [{ week, day: 5, endDay: 7, venue }];

/**
 * v19 completes the recurring circuit roster using the PDC calendar
 * (https://www.pdc.tv/calendar) and WDF calendar
 * (https://dartswdf.com/calendar). The WDF's 2026 calendar has 217 event
 * entries across changing regional venues and divisions; Career models these
 * as recurring ranked-open, country, women's, youth, world, and continental
 * circuits rather than freezing one year's full venue list into every save.
 */
export function buildCatalogueV19(v18: readonly EventDefinition[]): readonly EventDefinition[] {
  const out = v18.filter(d => d.circuit !== "VAULT" &&
    d.key !== "pro-super-series" && d.key !== "pro-super-series-finals").map(original => {
    const d: EventDefinition = { ...structuredClone(original), eventDatabaseVersion: 19 };
    const name = DISTINCT_CIRCUIT_NAMES[d.key];
    if (name) d.name = name;
    return d;
  });

  const find = (key: string) => {
    const definition = out.find(d => d.key === key);
    if (!definition) throw new Error(`Missing v19 event template: ${key}`);
    return definition;
  };
  const amateur = find("amateur-world-masters");
  const pairs = find("world-cup-of-darts");
  const regional = find("regional-open");
  const womenTemplate = find("women-world-championship");
  const youthTemplate = find("youth-world-championship");

  const event = (template: EventDefinition, key: typeof V19_ADDED_EVENT_KEYS[number], name: string,
    slot: ScheduleSlot, priority: number, circuit: EventDefinition["circuit"] = "NATIONAL_AMATEUR"): EventDefinition => {
    const d: EventDefinition = {
      ...structuredClone(template),
      key,
      name,
      family: key,
      eventDatabaseVersion: 19,
      circuit,
      classification: "RANKING",
      rankingCategory: circuit === "REGIONAL" ? "AMATEUR_REGIONAL" : "AMATEUR_NATIONAL",
      presentation: { ...template.presentation, tier: priority >= 80 ? "MAJOR" : "FEATURED", featured: priority >= 80, calendarPriority: priority },
      format: structuredClone(template.format),
      fieldSize: Math.max(64, template.fieldSize),
      minimumEntrants: Math.max(16, template.minimumEntrants),
      schedule: { kind: "FIXED", slots: [slot] },
      legacyConcept: "WDF competition type; distinct in-game name",
    };
    d.content = {
      ...identity(d, "wdf", priority >= 80 ? "MAJOR" : "INTERNATIONAL_OPEN"),
      circuitName: "WDF-inspired international circuit",
    };
    return d;
  };

  const pdcWomensMatchplay: EventDefinition = {
    ...structuredClone(womenTemplate),
    key: "pdc-womens-matchplay",
    name: "Women's Summer Matchplay",
    family: "pdc-womens-matchplay",
    eventDatabaseVersion: 19,
    circuit: "MAJOR",
    classification: "RANKING",
    rankingCategory: "PRO_MAJOR",
    presentation: { ...womenTemplate.presentation, tier: "MAJOR", featured: true, calendarPriority: 88 },
    fieldSize: 16,
    minimumEntrants: 8,
    schedule: { kind: "FIXED", slots: fixed(31, "seafront-pavilion-blackpool") },
    legacyConcept: "PDC Women's World Matchplay; distinct in-game name",
  };
  pdcWomensMatchplay.content = {
    ...identity(pdcWomensMatchplay, "women", "MAJOR"),
    circuitName: "PDC women's circuit",
  };
  out.push(pdcWomensMatchplay);

  const pdcYouthWorld: EventDefinition = {
    ...structuredClone(youthTemplate),
    key: "pdc-youth-world-championship",
    name: "PDC Youth World Championship",
    family: "pdc-youth-world-championship",
    eventDatabaseVersion: 19,
    circuit: "MAJOR",
    classification: "RANKING",
    rankingCategory: "PRO_MAJOR",
    presentation: { ...youthTemplate.presentation, tier: "MAJOR", featured: true, calendarPriority: 84 },
    fieldSize: 64,
    minimumEntrants: 16,
    schedule: { kind: "FIXED", slots: fixed(45, "the-foundry-manchester") },
    legacyConcept: "PDC World Youth Championship; distinct in-game name",
  };
  pdcYouthWorld.content = {
    ...identity(pdcYouthWorld, "youth-championships", "MAJOR"),
    circuitName: "PDC youth circuit",
  };
  out.push(pdcYouthWorld);

  out.push(
    event(amateur, "wdf-world-championship", "Lakeside World Darts Championship",
      fixed(47, "midlands-oche")[0], 95, "WORLD_CHAMPIONSHIP"),
    event(amateur, "wdf-world-masters", "World Masters Open",
      fixed(39, "rhein-hall-dusseldorf")[0], 88),
    event(pairs, "wdf-world-cup", "World Darts Nations Cup",
      fixed(24, "harbour-rooms-dublin")[0], 86),
    event(pairs, "wdf-europe-cup", "European Darts Nations Cup",
      fixed(27, "spree-halle-berlin")[0], 82),
    event(pairs, "wdf-asia-pacific-cup", "Asia-Pacific Darts Cup",
      fixed(34, "harbourside-arena-sydney")[0], 82),
    event(regional, "wdf-gold-open", "WDF Gold-Ranked Open",
      fixed(13, "maas-hal-rotterdam")[0], 75, "REGIONAL"),
    event(regional, "wdf-silver-open", "WDF Silver-Ranked Open",
      fixed(21, "riverside-hall-cardiff")[0], 68, "REGIONAL"),
    event(regional, "wdf-bronze-open", "WDF Bronze-Ranked Open",
      fixed(30, "harbour-rooms-dublin")[0], 60, "REGIONAL"),
    event(amateur, "wdf-nevada-open", "Desert City Open",
      fixed(4, "desert-pavilion-las-vegas")[0], 74),
    event(amateur, "wdf-low-countries-open", "Low Countries Open",
      fixed(7, "maas-hal-rotterdam")[0], 78),
    event(amateur, "wdf-caledonian-open", "Caledonian Open",
      fixed(10, "glasgow-hall")[0], 76),
    event(amateur, "wdf-manx-open", "Manx International Open",
      fixed(14, "castle-exchange-edinburgh")[0], 68),
    event(amateur, "wdf-ulster-open", "Ulster Open",
      fixed(18, "harbour-rooms-dublin")[0], 72),
    event(amateur, "wdf-baltic-open", "Baltic Darts Open",
      fixed(22, "spree-halle-berlin")[0], 70),
    event(amateur, "wdf-britannia-open", "Britannia Open",
      fixed(26, "the-foundry-manchester")[0], 78),
    event(amateur, "wdf-danube-masters", "Danube Masters",
      fixed(32, "rhein-hall-dusseldorf")[0], 76),
    event(amateur, "wdf-emerald-open", "Emerald Isle Open",
      fixed(36, "lee-assembly")[0], 72),
    event(amateur, "wdf-bohemian-open", "Bohemian Open",
      fixed(38, "spree-halle-berlin")[0], 70),
    event(amateur, "wdf-mediterranean-masters", "Mediterranean Masters",
      fixed(42, "maas-hal-rotterdam")[0], 75),
    event(amateur, "wdf-southern-cross-open", "Southern Cross Open",
      fixed(16, "harbourside-arena-sydney")[0], 75),
  );

  return Object.freeze(out);
}
