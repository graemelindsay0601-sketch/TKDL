import type { EventDefinition, ScheduleSlot } from "../calendar/catalogue.ts";
import { R } from "../calendar/eligibility.ts";
import { knockout501 } from "../calendar/formats.ts";
import { COUNTRIES } from "../calendar/geography.ts";
import { identity } from "./events.ts";
import type { PrestigeClass } from "./world.ts";

/**
 * Event database v7 (new saves only; v1–v6 definitions and established instances are untouched).
 *
 * Every starting country gets a full ladder and year-round choice:
 *  - a regional series (state / provincial / prefecture / county equivalent) and two national classics;
 *  - a national amateur championship where one was missing;
 *  - regional tours modelled on the real affiliate tours — Asian Tour, North American Championship
 *    Tour (steel-tip), a Soft-Tip Series (USA & Japan), Oceanic Tour, Nordic & Baltic Tour and a
 *    European Development Series — each closed by a Finals whose top finishers earn World
 *    Championship places (the Soft-Tip World Finals is a prize event).
 *
 * Fields favour local players (COUNTRY geography) and are topped up from neighbouring countries; the
 * Oceanic and Nordic & Baltic tours are open across their zone because those pools are small,
 * so smaller darting nations still produce full, playable events. Regional tours use the existing
 * second-tier CHALLENGER circuit for presentation but rank in the amateur/open lists, never in the
 * Challenger ranking that awards Tour Cards. Soft-tip events are played as 501 double-out legs
 * (the format the live scorer supports), on the soft-tip circuit's shorter match lengths.
 */
type Tour = { key: string; name: string; ci: string; countries: string[] | null; zone?: "EUROPE" | "REST_OF_WORLD"; venues: string[]; weeks: number[]; fieldSize: number;
  finals: { name: string; week: number; venue: string; worldChampionshipPlaces: number }; softTip?: boolean };

export const REGIONAL_TOURS_V7: readonly Tour[] = [
  { key: "asian-tour", fieldSize: 32, name: "Asian Tour {n} — {city}", ci: "asian-tour", countries: ["JPN", "SGP"],
    venues: ["bayfront-dome-tokyo", "osaka-bay-hall", "chubu-civic-theatre", "bayfront-dome-tokyo", "garden-city-arena", "osaka-bay-hall", "bayfront-dome-tokyo", "chubu-civic-theatre"],
    weeks: [5, 10, 14, 18, 23, 28, 32, 37], finals: { name: "Asian Tour Finals", week: 43, venue: "bayfront-dome-tokyo", worldChampionshipPlaces: 2 } },
  { key: "north-american-tour", fieldSize: 32, name: "North American Championship Tour {n} — {city}", ci: "north-american-tour", countries: ["USA", "CAN"],
    venues: ["hudson-hall-new-york", "lakeshore-coliseum-toronto", "lakefront-hall-chicago", "prairie-forum", "harbor-forum-boston", "harbourfront-hall-halifax", "desert-pavilion-las-vegas", "lakeshore-coliseum-toronto"],
    weeks: [6, 11, 15, 19, 24, 29, 33, 38], finals: { name: "North American Championship Finals", week: 43, venue: "desert-pavilion-las-vegas", worldChampionshipPlaces: 2 } },
  { key: "soft-tip-series", fieldSize: 32, name: "Soft-Tip Series {n} — {city}", ci: "soft-tip", countries: null, softTip: true,
    venues: ["desert-pavilion-las-vegas", "bayfront-dome-tokyo", "lakefront-hall-chicago", "osaka-bay-hall", "hudson-hall-new-york", "bayfront-dome-tokyo"],
    weeks: [8, 16, 21, 26, 34, 40], finals: { name: "Soft-Tip World Finals", week: 46, venue: "desert-pavilion-las-vegas", worldChampionshipPlaces: 0 } },
  { key: "oceanic-tour", fieldSize: 32, name: "Oceanic Tour {n} — {city}", ci: "oceanic-tour", countries: null, zone: "REST_OF_WORLD",
    venues: ["harbourside-arena-sydney", "southern-cross-hall", "waitemata-centre-auckland", "pacific-assembly", "swan-river-hall-perth", "capital-hall-wellington", "southern-cross-hall", "garden-city-theatre-christchurch"],
    weeks: [5, 9, 13, 17, 22, 27, 31, 36], finals: { name: "Oceanic Tour Finals", week: 42, venue: "harbourside-arena-sydney", worldChampionshipPlaces: 2 } },
  { key: "nordic-baltic-tour", fieldSize: 32, name: "Nordic & Baltic Tour {n} — {city}", ci: "nordic-baltic-tour", countries: null, zone: "EUROPE",
    venues: ["northern-waterfront", "harbour-hall-copenhagen", "aurora-centre", "gota-hall-gothenburg", "baltic-exchange", "northern-waterfront"],
    weeks: [6, 12, 17, 22, 28, 33], finals: { name: "Nordic & Baltic Tour Finals", week: 39, venue: "northern-waterfront", worldChampionshipPlaces: 1 } },
  { key: "european-development-series", fieldSize: 48, name: "European Development Series {n} — {city}", ci: "european-development", countries: null, zone: "EUROPE",
    venues: ["maas-hal-rotterdam", "scheldt-dome-antwerp", "spree-halle-berlin", "seine-forum", "danube-halle-vienna", "vltava-arena-prague", "maas-valley-hall-maastricht", "meuse-hall-liege"],
    weeks: [5, 9, 13, 17, 21, 25, 30, 35], finals: { name: "European Development Finals", week: 40, venue: "maas-hal-rotterdam", worldChampionshipPlaces: 2 } },
];

/** Regional series name and venues per starting country (the county/state level outside the UK county map). */
export const NATIONAL_LADDERS_V7: Record<string, { series: string; venues: string[] }> = {
  GBR: { series: "Home Nations Series", venues: ["northern-forum-newcastle", "riverside-hall-cardiff", "midlands-oche", "castle-exchange-edinburgh", "vault-studio-leeds", "lagan-exchange", "glasgow-hall"] },
  IRL: { series: "Provincial Series", venues: ["harbour-rooms-dublin", "lee-assembly", "western-rooms"] },
  NLD: { series: "Dutch Regional Series", venues: ["canal-conference", "maas-hal-rotterdam", "maas-valley-hall-maastricht"] },
  DEU: { series: "German Regional Series", venues: ["rhein-hall-dusseldorf", "spree-halle-berlin", "isar-forum-munich", "ruhr-forum-dortmund"] },
  BEL: { series: "Belgian Regional Series", venues: ["scheldt-dome-antwerp", "meuse-hall-liege", "grand-place-pavilion-brussels"] },
  FRA: { series: "French Regional Series", venues: ["seine-forum", "rhone-theatre"] },
  SWE: { series: "Swedish Regional Series", venues: ["northern-waterfront", "gota-hall-gothenburg"] },
  AUS: { series: "State Series", venues: ["southern-cross-hall", "pacific-assembly", "swan-river-hall-perth", "harbourside-arena-sydney"] },
  CAN: { series: "Provincial Series", venues: ["lakeshore-coliseum-toronto", "prairie-forum", "harbourfront-hall-halifax"] },
  USA: { series: "State Series", venues: ["hudson-hall-new-york", "lakefront-hall-chicago", "harbor-forum-boston", "desert-pavilion-las-vegas"] },
  JPN: { series: "Prefecture Series", venues: ["bayfront-dome-tokyo", "osaka-bay-hall", "chubu-civic-theatre"] },
  NZL: { series: "Regional Series", venues: ["waitemata-centre-auckland", "capital-hall-wellington", "garden-city-theatre-christchurch"] },
};
export const NATIONAL_SERIES_WEEKS_V7 = [3, 7, 11, 16, 20, 26, 34, 45] as const;
const NEW_NATIONAL_CHAMPIONSHIPS: Record<string, ScheduleSlot> = {
  FRA: { week: 24, day: 6, endDay: 7, venue: "seine-forum" }, SWE: { week: 26, day: 6, endDay: 7, venue: "northern-waterfront" },
  JPN: { week: 29, day: 6, endDay: 7, venue: "bayfront-dome-tokyo" }, USA: { week: 30, day: 6, endDay: 7, venue: "hudson-hall-new-york" },
  NZL: { week: 25, day: 6, endDay: 7, venue: "waitemata-centre-auckland" },
};
const AMATEUR_ONLY = R.all(R.amateur(), R.nonTourCard());
const tw = (g: number, a: number, p: number, e: number) => ({ GRASSROOTS: g, AMATEUR: a, PROFESSIONAL: p, ELITE: e });
const slug = (country: string) => country.toLowerCase();
/** Field sizes follow each country's NPC pool (player database v2 identity weights) so events fill without starving neighbours. */
const POOL: Record<string, "large" | "medium" | "small"> = { GBR: "large", IRL: "medium", NLD: "medium", DEU: "medium" };
const poolOf = (country: string) => POOL[country] ?? "small";
const SERIES_FIELD = { large: 32, medium: 24, small: 16 } as const;
/**
 * Field-locking order. Events restricted to one country lock first and take only their own players;
 * zone-wide or open events lock afterwards from whoever is free, so a country's own events are never
 * starved by a bigger event elsewhere. (Challenger 50, national championships 40 in earlier editions.)
 */
const PRIORITY = { countryLocked: 55, countryFinals: 57, open: 30, openFinals: 57 } as const;
/** Countries whose amateur pools fill country-only fields; the rest draw on their zone with locals first. */
const ZONE_FILLED: Record<string, "EUROPE" | "REST_OF_WORLD"> = { BEL: "EUROPE", FRA: "EUROPE", SWE: "EUROPE", AUS: "REST_OF_WORLD", NZL: "REST_OF_WORLD" };
const ladderRule = (country: string) => ZONE_FILLED[country] ? R.all(AMATEUR_ONLY, R.zone(ZONE_FILLED[country])) : R.all(AMATEUR_ONLY, R.country(country));
const ladderPriority = (country: string) => ZONE_FILLED[country] ? PRIORITY.open : PRIORITY.countryLocked;
const CLASSIC_FIELD = { large: 64, medium: 32, small: 24 } as const;

export function buildCatalogueV7(v6: readonly EventDefinition[]): readonly EventDefinition[] {
  const out: EventDefinition[] = v6.map(original => ({ ...structuredClone(original), eventDatabaseVersion: 7 }));
  const base = (key: string) => out.find(d => d.key === key)!;
  const make = (source: string, key: string, name: string, slots: ScheduleSlot[], changes: Partial<EventDefinition>, ci: string, cls: PrestigeClass, tier: EventDefinition["presentation"]["tier"], featured = false) => {
    const from = base(source);
    const d: EventDefinition = { ...structuredClone(from), ...changes, key, name, family: key, legacyConcept: null, eventDatabaseVersion: 7,
      presentation: { ...from.presentation, tier, featured, brandingFamily: ci, heroAssetKey: `hero:${ci}`, badgeAssetKey: `badge:${ci}` },
      schedule: { kind: "FIXED", slots } };
    d.content = identity(d, ci, cls);
    out.push(d); return d;
  };
  // ---------------------------------------------------------------- national ladders
  // Countries are staggered across weekends so national events never all draw on the same Saturday.
  // A country's Classic and Masters avoid its own regional tour weekends (the same players).
  const tourWeeks = (country: string) => new Set(REGIONAL_TOURS_V7.filter(t => t.countries?.includes(country)).flatMap(t => [...t.weeks, t.finals.week]));
  const freeWeek = (country: string, from: number) => { const busy = tourWeeks(country); let w = from; while (busy.has(w)) w++; return w; };
  Object.entries(NATIONAL_LADDERS_V7).forEach(([country, ladder], index) => {
    const c = slug(country), countryName = COUNTRIES[country].name, pool = poolOf(country);
    make("regional-classic", `${c}-regional-series`, `${countryName} ${ladder.series} {n} — {city}`,
      NATIONAL_SERIES_WEEKS_V7.map((week, i) => ({ week: week + (index % 3), day: 6, venue: ladder.venues[i % ladder.venues.length] })),
      { eligibility: ladderRule(country), geography: { kind: "COUNTRY" }, fieldSize: SERIES_FIELD[pool], minimumEntrants: 8, npcFill: [0.5, 0.9], npcTierWeights: tw(0.6, 1, 0.1, 0) },
      "regional", "REGIONAL", "STANDARD").presentation.calendarPriority = ladderPriority(country);
    make("national-open", `${c}-classic`, `${countryName} Classic`, [{ week: freeWeek(country, 6 + (index % 6)), day: 6, endDay: 7, venue: ladder.venues[0] }],
      { eligibility: ladderRule(country), geography: { kind: "COUNTRY" }, fieldSize: CLASSIC_FIELD[pool], minimumEntrants: 8, npcFill: [0.5, 0.9] }, "open", "NATIONAL", "FEATURED", true)
      .presentation.calendarPriority = ladderPriority(country);
    make("national-open", `${c}-masters`, `${countryName} Masters`, [{ week: freeWeek(country, 38 + (index % 6)), day: 6, endDay: 7, venue: ladder.venues[1 % ladder.venues.length] }],
      { eligibility: ladderRule(country), geography: { kind: "COUNTRY" }, fieldSize: CLASSIC_FIELD[pool], minimumEntrants: 8, npcFill: [0.5, 0.9] }, "open", "NATIONAL", "FEATURED", true)
      .presentation.calendarPriority = ladderPriority(country);
  });
  // New Zealand has no resident NPC pool yet, so its national event is an Amateur Open across the region.
  for (const [country, slot] of Object.entries(NEW_NATIONAL_CHAMPIONSHIPS)) {
    const name = ZONE_FILLED[country] ? `${COUNTRIES[country].name} Amateur Open` : `${COUNTRIES[country].name} National Amateur Championship`;
    const d = make("national-amateur-gbr", `national-amateur-${slug(country)}`, name, [{ ...slot, country }],
      { eligibility: ladderRule(country), geography: { kind: "COUNTRY" } }, "open", "NATIONAL", "FEATURED", true);
    d.family = "national-amateur-championship"; d.presentation.calendarPriority = ladderPriority(country);
  }
  // Existing national championships are country-locked too: in this edition they lock before open events.
  for (const d of out) if (d.family === "national-amateur-championship" && d.eventDatabaseVersion === 7 && !ZONE_FILLED[d.key.slice(-3).toUpperCase()]) d.presentation = { ...d.presentation, calendarPriority: PRIORITY.countryLocked };
  // ---------------------------------------------------------------- weekly club leagues
  // Thursday league nights outside the dense UK county map, all year. Open to amateurs without a Tour
  // Card; locals fill first (LOCALITY geography) and neighbours top up thin pools.
  const friday = base("friday-night-501");
  const league = (key: string, name: string, perWeight: number, countries: string[]) => {
    const d: EventDefinition = { ...structuredClone(friday), key, name, family: key, legacyConcept: null, eventDatabaseVersion: 7,
      eligibility: AMATEUR_ONLY, fieldSize: 16, minimumEntrants: 4, npcFill: [0.4, 0.75],
      schedule: { kind: "LOCAL_ROTATION", venueKind: "CLUB", perWeight, day: 4, weekRange: [1, 52], countries } };
    d.content = identity(d, "grassroots");
    out.push(d);
  };
  // Thinly populated darting nations: a league night in most weeks. Mid-sized European scenes: every few weeks.
  league("club-league-night", "{city} Club League Night", 40, ["BEL", "FRA", "SWE", "AUS", "CAN", "USA", "JPN", "NZL"]);
  league("midweek-league-night", "{city} Midweek League", 12, ["IRL", "NLD", "DEU"]);
  // ---------------------------------------------------------------- regional tours and finals
  for (const tour of REGIONAL_TOURS_V7) {
    const pass = `${tour.key}-finals`;
    // Country-locked where the home pool can fill fields; otherwise open to the zone with locals picked first.
    const region = tour.countries ? R.all(R.nonTourCard(), R.country(...tour.countries)) : tour.zone ? R.all(R.nonTourCard(), R.zone(tour.zone)) : R.nonTourCard();
    const format = tour.softTip ? knockout501([5, 5, 7, 7, 7, 9], "floor") : knockout501([7, 7, 9, 9, 9, 11], "floor");
    make("challenger-event", tour.key, tour.name, tour.weeks.flatMap((week, i) => [6, 7].map(day => ({ week, day, venue: tour.venues[i % tour.venues.length] }))),
      { eligibility: region, geography: tour.countries || tour.zone ? { kind: "COUNTRY" } : { kind: "INTERNATIONAL", hostBonus: 2 }, rankingCategory: "AMATEUR_NATIONAL",
        fieldSize: tour.fieldSize, minimumEntrants: 8, npcFill: [0.4, 0.8], npcTierWeights: tw(0.3, 1, 0.5, 0.1), format, entitlementIntake: [],
        qualificationOutputs: [{ maxPosition: 8, entitlementType: "EVENT_ENTRY", targetKey: pass, targetSeason: "SAME", consumption: "SEASON_PASS" }] },
      tour.ci, "SECONDARY_TOUR", "STANDARD").presentation.calendarPriority = tour.countries ? PRIORITY.countryLocked : PRIORITY.open;
    make("challenger-event", pass, tour.finals.name, [{ week: tour.finals.week, day: 6, endDay: 7, venue: tour.finals.venue }],
      { eligibility: R.all(R.nonTourCard(), R.qualified(pass)), geography: { kind: "INTERNATIONAL", hostBonus: 1 }, rankingCategory: "AMATEUR_NATIONAL",
        fieldSize: 32, minimumEntrants: 8, npcFill: [1, 1], npcTierWeights: tw(0.3, 1, 0.5, 0.1), invitationPolicy: null, entitlementIntake: [pass],
        format: tour.softTip ? knockout501([7, 7, 9, 9, 11], "stage", 2) : knockout501([9, 9, 11, 11, 13], "stage", 2),
        qualificationOutputs: tour.finals.worldChampionshipPlaces ? [{ maxPosition: tour.finals.worldChampionshipPlaces, entitlementType: "EVENT_ENTRY", targetKey: "world-championship", targetSeason: "SAME", consumption: "SINGLE_USE" }] : [] },
      tour.ci, "SECONDARY_TOUR", "TELEVISED", true);
    const finals = out[out.length - 1];
    finals.presentation.calendarPriority = tour.countries ? PRIORITY.countryFinals : PRIORITY.openFinals;
    // Tour finals lift an international globe; the identity is stored with the event content.
    finals.content = { ...finals.content!, trophyId: "international-globe", trophyIdentity: { id: `trophy:${pass}`, designId: "international-globe" } };
  }
  return Object.freeze(out);
}
