import type { Tier } from "../world/types.ts";
import type { Circuit, Classification, PresentationTier } from "./config.ts";
import { EVENT_DATABASE_VERSION } from "./config.ts";
import { knockout501, setsKnockout501, groupKnockout501, league501, x01Variant, specialGame, pairs501, type EventFormat } from "./formats.ts";
import { R, Q_SCHOOL_PATHWAYS, type Rule, type QSchoolPathway } from "./eligibility.ts";
import { AGE_POLICY } from "../identity/age.ts";
import { COUNTRIES, LOCALITIES, type Zone } from "./geography.ts";
import { expandWorldCatalogue } from "../content/events.ts";
import type { EventContent } from "../content/world.ts";

/**
 * EVENT DATABASE v1 — authored definitions/templates. Definitions are content;
 * season instances snapshot everything they need (see generation.ts), so later
 * database versions can never rewrite a completed season.
 */
export type GeographyPolicy =
  | { kind: "LOCALITY" } | { kind: "REGION" } | { kind: "COUNTRY" } | { kind: "ZONE" }
  | { kind: "INTERNATIONAL"; hostBonus: number };

export type QualificationOutput = {
  /** Finishing positions 1..maxPosition (1 champion, 2 runner-up, 3 semi, 5 quarter, 9 last-16...). */
  maxPosition: number;
  entitlementType: "EVENT_ENTRY" | "STAGE_ENTRY" | "SERIES_ACCESS";
  targetKey: string;
  targetSeason: "SAME" | "NEXT";
  consumption: "SINGLE_USE" | "SEASON_PASS";
};

export type ScheduleSlot = { week: number; day: number; venue: string; label?: string; country?: string; endWeek?: number; endDay?: number };
export type Schedule =
  | { kind: "FIXED"; slots: ScheduleSlot[] }
  /** Deterministic seeded rotation across localities. */
  | { kind: "LOCAL_ROTATION"; venueKind: "CLUB" | "COUNTY"; perWeight: number; day: number; weekRange: [number, number]; countries?: string[] };

export type EventDefinition = {
  key: string;
  eventDatabaseVersion: number;
  name: string;
  family: string;
  circuit: Circuit;
  classification: Classification;
  /** A5 placeholder only. SPECIAL / QUALIFIER / INVITATIONAL never carry one. */
  rankingCategory: string | null;
  presentation: { tier: PresentationTier; brandingFamily: string; heroAssetKey: string; badgeAssetKey: string; featured: boolean; calendarPriority: number };
  format: EventFormat;
  fieldSize: number;
  minimumEntrants: number;
  /** Deterministic NPC fill as a fraction of capacity [min, max]. */
  npcFill: [number, number];
  npcTierWeights: Record<Tier, number>;
  geography: GeographyPolicy;
  eligibility: Rule;
  fieldPolicy: "SELECTION" | "ENTITLED_ONLY" | "SERIES_FIRST_DAY";
  /** Entitlement keys that reserve a place ahead of open selection. */
  entitlementIntake: string[];
  /** Invitations issued during field assembly when no ranking provider supplies the list. */
  invitationPolicy: { count: number; tierWeights: Record<Tier, number> } | null;
  qualificationOutputs: QualificationOutput[];
  /** A5 seeding boundary. A3 only requests a list; NONE = unseeded draw. */
  seedingPolicy: { list: string | null; seeds: number };
  /** A4 profile references. A3 never debits or pays. */
  profiles: { entryFee: string; travel: string; accommodation: string; prize: string };
  registrationLeadWeeks: number;
  series: { key: string; day: number; days: number } | null;
  qSchool: { pathway: QSchoolPathway; stage: "FIRST" | "FINAL"; day: number } | null;
  exclusiveGroup: { key: string; variant: string } | null;
  /** Legacy Classic Tour concept this was adapted from (metadata only; Tour untouched). */
  legacyConcept: string | null;
  schedule: Schedule;
  content?: EventContent;
};

const tw = (g: number, a: number, p: number, e: number): Record<Tier, number> => ({ GRASSROOTS: g, AMATEUR: a, PROFESSIONAL: p, ELITE: e });
const AMATEUR_ONLY = R.all(R.amateur(), R.nonTourCard());
const profiles = (level: string) => ({ entryFee: `fee:${level}`, travel: `travel:${level}`, accommodation: `accommodation:${level}`, prize: `prize:${level}` });

type Partial = Omit<EventDefinition, "eventDatabaseVersion" | "presentation" | "fieldPolicy" | "entitlementIntake" | "invitationPolicy" | "qualificationOutputs" | "seedingPolicy" | "profiles" | "registrationLeadWeeks" | "series" | "qSchool" | "exclusiveGroup" | "legacyConcept" | "minimumEntrants" | "rankingCategory"> & {
  presentation: Omit<EventDefinition["presentation"], "heroAssetKey" | "badgeAssetKey" | "brandingFamily"> & { brandingFamily?: string };
} & Partial2;
type Partial2 = { [K in "fieldPolicy" | "entitlementIntake" | "invitationPolicy" | "qualificationOutputs" | "seedingPolicy" | "profiles" | "registrationLeadWeeks" | "series" | "qSchool" | "exclusiveGroup" | "legacyConcept" | "minimumEntrants" | "rankingCategory"]?: EventDefinition[K] };

function def(d: Partial): EventDefinition {
  const brandingFamily = d.presentation.brandingFamily ?? d.family;
  return {
    eventDatabaseVersion: EVENT_DATABASE_VERSION,
    fieldPolicy: "SELECTION", entitlementIntake: [], invitationPolicy: null, qualificationOutputs: [],
    seedingPolicy: { list: null, seeds: 0 }, profiles: profiles(d.circuit.toLowerCase()), registrationLeadWeeks: 4,
    series: null, qSchool: null, exclusiveGroup: null, legacyConcept: null, minimumEntrants: 4, rankingCategory: null,
    ...d,
    presentation: { ...d.presentation, brandingFamily, heroAssetKey: `hero:${brandingFamily}`, badgeAssetKey: `badge:${brandingFamily}` },
  };
}

// ---------------------------------------------------------------- Grassroots / County
const grassroots: EventDefinition[] = [
  def({ key: "friday-night-501", name: "{city} Friday Night 501", family: "friday-night-501", circuit: "GRASSROOTS", classification: "RANKING", rankingCategory: "AMATEUR_LOCAL",
    presentation: { tier: "LOCAL", featured: false, calendarPriority: 10 }, format: knockout501([5, 5, 5, 7], "local"), fieldSize: 24, npcFill: [0.5, 1],
    npcTierWeights: tw(1, 0.45, 0.03, 0), geography: { kind: "LOCALITY" }, eligibility: R.all(R.country("{country}"), AMATEUR_ONLY), registrationLeadWeeks: 2,
    legacyConcept: "Friday Night 501", schedule: { kind: "LOCAL_ROTATION", venueKind: "CLUB", perWeight: 4, day: 5, weekRange: [1, 49] } }),
  def({ key: "sunday-league-sprint", name: "{city} Sunday League Sprint", family: "sunday-league", circuit: "GRASSROOTS", classification: "RANKING", rankingCategory: "AMATEUR_LOCAL",
    presentation: { tier: "LOCAL", featured: false, calendarPriority: 9 }, format: knockout501([3, 3, 5], "local"), fieldSize: 16, npcFill: [0.5, 1],
    npcTierWeights: tw(1, 0.35, 0, 0), geography: { kind: "LOCALITY" }, eligibility: R.all(R.country("{country}"), AMATEUR_ONLY), registrationLeadWeeks: 2,
    legacyConcept: "Sunday League", schedule: { kind: "LOCAL_ROTATION", venueKind: "CLUB", perWeight: 1.5, day: 7, weekRange: [2, 48] } }),
  def({ key: "sudden-death-night", name: "{city} Sudden Death Night", family: "sudden-death", circuit: "SPECIAL", classification: "SPECIAL",
    presentation: { tier: "LOCAL", featured: false, calendarPriority: 5 }, format: knockout501([1], "local"), fieldSize: 16, npcFill: [0.5, 1],
    npcTierWeights: tw(1, 0.5, 0.05, 0), geography: { kind: "LOCALITY" }, eligibility: R.country("{country}"), registrationLeadWeeks: 2,
    legacyConcept: "Sudden Death Friday", schedule: { kind: "LOCAL_ROTATION", venueKind: "CLUB", perWeight: 0.5, day: 3, weekRange: [3, 47], countries: ["GBR", "IRL"] } }),
  def({ key: "pub-doubles", name: "{city} Pub Doubles", family: "pub-doubles", circuit: "GRASSROOTS", classification: "INVITATIONAL_EXHIBITION",
    presentation: { tier: "LOCAL", featured: false, calendarPriority: 4 }, format: pairs501([3, 5]), fieldSize: 16, npcFill: [0.5, 1],
    npcTierWeights: tw(1, 0.4, 0, 0), geography: { kind: "LOCALITY" }, eligibility: R.country("{country}"), registrationLeadWeeks: 2,
    legacyConcept: "Pub Doubles", schedule: { kind: "LOCAL_ROTATION", venueKind: "CLUB", perWeight: 0.35, day: 6, weekRange: [5, 45], countries: ["GBR", "IRL"] } }),
];
const LOCAL_SPECIALS: [string, string, Exclude<EventFormat["gameType"], "X01">, string][] = [
  ["cricket-classic", "Cricket Classic", "CRICKET", "Cricket Classic"], ["halve-it-night", "Halve-It Night", "HALVE_IT", "Halve It"],
  ["killer-night", "Killer Night", "KILLER", "Killer"], ["football-darts", "Football Darts", "FOOTBALL", "Football Darts"],
  ["golf-night", "Golf Night", "GOLF", "Golf Night"], ["count-up-challenge", "Count-Up Challenge", "COUNT_UP", "Count Up"],
];
for (const [key, name, game, legacy] of LOCAL_SPECIALS) grassroots.push(def({ key, name: `{city} ${name}`, family: key, circuit: "SPECIAL", classification: "SPECIAL",
  presentation: { tier: "LOCAL", featured: false, calendarPriority: 3 }, format: specialGame(game, [3, 3, 5]), fieldSize: 16, npcFill: [0.5, 1],
  npcTierWeights: tw(1, 0.4, 0.02, 0), geography: { kind: "LOCALITY" }, eligibility: R.country("{country}"), registrationLeadWeeks: 2, legacyConcept: legacy,
  schedule: { kind: "LOCAL_ROTATION", venueKind: "CLUB", perWeight: 0.12, day: 4, weekRange: [2, 46] } }));

const county: EventDefinition[] = [
  def({ key: "county-501-open", name: "{region} County 501 Open", family: "county-open", circuit: "COUNTY", classification: "RANKING", rankingCategory: "AMATEUR_COUNTY",
    presentation: { tier: "STANDARD", featured: false, calendarPriority: 20 }, format: knockout501([5, 5, 7, 7, 9], "local"), fieldSize: 24, npcFill: [0.5, 1],
    npcTierWeights: tw(0.6, 1, 0.08, 0), geography: { kind: "REGION" }, eligibility: R.all({ type: "LOCALITY", localities: ["{catchment}"] }, AMATEUR_ONLY), legacyConcept: "County 501 Open",
    schedule: { kind: "LOCAL_ROTATION", venueKind: "COUNTY", perWeight: 0.75, day: 6, weekRange: [6, 30], countries: ["GBR", "IRL", "NLD", "DEU", "BEL"] } }),
  def({ key: "county-championship", name: "{region} County Championship", family: "county-championship", circuit: "COUNTY", classification: "RANKING", rankingCategory: "AMATEUR_COUNTY",
    presentation: { tier: "STANDARD", featured: true, calendarPriority: 22 }, format: knockout501([7, 7, 9, 9, 11], "local", 2), fieldSize: 32, npcFill: [0.5, 1],
    npcTierWeights: tw(0.5, 1, 0.1, 0), geography: { kind: "REGION" }, eligibility: R.all({ type: "LOCALITY", localities: ["{catchment}"] }, AMATEUR_ONLY), legacyConcept: "County Championship",
    schedule: { kind: "LOCAL_ROTATION", venueKind: "COUNTY", perWeight: 0.34, day: 6, weekRange: [31, 44], countries: ["GBR", "IRL", "NLD", "DEU", "BEL"] } }),
  def({ key: "county-301-sprint", name: "{region} 301 Sprint", family: "county-301", circuit: "COUNTY", classification: "RANKING", rankingCategory: "AMATEUR_COUNTY",
    presentation: { tier: "LOCAL", featured: false, calendarPriority: 15 }, format: x01Variant(301, "STRAIGHT", [3, 3, 5], "local"), fieldSize: 24, npcFill: [0.5, 1],
    npcTierWeights: tw(0.8, 1, 0.05, 0), geography: { kind: "REGION" }, eligibility: R.all({ type: "LOCALITY", localities: ["{catchment}"] }, AMATEUR_ONLY), legacyConcept: "301 County Sprint",
    schedule: { kind: "LOCAL_ROTATION", venueKind: "COUNTY", perWeight: 0.12, day: 7, weekRange: [8, 40], countries: ["GBR", "IRL"] } }),
  def({ key: "county-classic-dido", name: "{region} County Classic (Double In)", family: "county-dido", circuit: "COUNTY", classification: "RANKING", rankingCategory: "AMATEUR_COUNTY",
    presentation: { tier: "LOCAL", featured: false, calendarPriority: 15 }, format: x01Variant(501, "DOUBLE", [5, 5, 7], "local"), fieldSize: 24, npcFill: [0.5, 1],
    npcTierWeights: tw(0.6, 1, 0.05, 0), geography: { kind: "REGION" }, eligibility: R.all({ type: "LOCALITY", localities: ["{catchment}"] }, AMATEUR_ONLY), legacyConcept: "County Classic DIDO",
    schedule: { kind: "LOCAL_ROTATION", venueKind: "COUNTY", perWeight: 0.12, day: 7, weekRange: [10, 42], countries: ["GBR", "IRL"] } }),
  def({ key: "county-701-open", name: "{region} 701 County Open", family: "county-701", circuit: "COUNTY", classification: "RANKING", rankingCategory: "AMATEUR_COUNTY",
    presentation: { tier: "LOCAL", featured: false, calendarPriority: 15 }, format: x01Variant(701, "STRAIGHT", [3, 5, 5], "local"), fieldSize: 24, npcFill: [0.5, 1],
    npcTierWeights: tw(0.6, 1, 0.05, 0), geography: { kind: "REGION" }, eligibility: R.all({ type: "LOCALITY", localities: ["{catchment}"] }, AMATEUR_ONLY), legacyConcept: "701 County Open",
    schedule: { kind: "LOCAL_ROTATION", venueKind: "COUNTY", perWeight: 0.1, day: 7, weekRange: [12, 44], countries: ["GBR"] } }),
];

// ---------------------------------------------------------------- Regional / National amateur
const REGIONAL_SLOTS: ScheduleSlot[] = [
  { week: 7, day: 6, venue: "glasgow-hall", label: "Scotland", country: "GBR" }, { week: 9, day: 6, venue: "northern-forum-newcastle", label: "North", country: "GBR" },
  { week: 13, day: 6, venue: "riverside-hall-cardiff", label: "Wales & West", country: "GBR" }, { week: 15, day: 6, venue: "midlands-oche", label: "Midlands", country: "GBR" },
  { week: 18, day: 6, venue: "harbour-rooms-dublin", label: "Ireland", country: "IRL" }, { week: 21, day: 6, venue: "castle-exchange-edinburgh", label: "Scotland East", country: "GBR" },
  { week: 26, day: 6, venue: "maas-hal-rotterdam", label: "Benelux", country: "NLD" }, { week: 27, day: 6, venue: "ruhr-forum-dortmund", label: "Germany West", country: "DEU" },
  { week: 32, day: 6, venue: "dockyard-arena-liverpool", label: "North West", country: "GBR" }, { week: 34, day: 6, venue: "scheldt-dome-antwerp", label: "Flanders", country: "BEL" },
  { week: 36, day: 6, venue: "spree-halle-berlin", label: "Germany East", country: "DEU" }, { week: 39, day: 6, venue: "the-foundry-manchester", label: "England", country: "GBR" },
];
const regional: EventDefinition[] = [
  def({ key: "regional-open", name: "{label} Regional Open", family: "regional-open", circuit: "REGIONAL", classification: "RANKING", rankingCategory: "AMATEUR_REGIONAL",
    presentation: { tier: "STANDARD", featured: false, calendarPriority: 30 }, format: knockout501([5, 7, 7, 9, 9, 11], "floor"), fieldSize: 64, npcFill: [0.45, 0.9],
    npcTierWeights: tw(0.3, 1, 0.15, 0), geography: { kind: "COUNTRY" }, eligibility: R.all(R.country("{country}"), AMATEUR_ONLY), legacyConcept: null,
    schedule: { kind: "FIXED", slots: REGIONAL_SLOTS } }),
  def({ key: "regional-champions-league", name: "Regional Champions League — {label}", family: "regional-champions-league", circuit: "REGIONAL", classification: "RANKING", rankingCategory: "AMATEUR_REGIONAL",
    presentation: { tier: "FEATURED", featured: true, calendarPriority: 32 }, format: league501(7, "floor", 8), fieldSize: 8, npcFill: [1, 1],
    npcTierWeights: tw(0, 1, 0.2, 0), geography: { kind: "ZONE" }, eligibility: R.all(R.zone("{zone}" as Zone), AMATEUR_ONLY), legacyConcept: "Regional Premier",
    schedule: { kind: "FIXED", slots: [{ week: 10, day: 4, venue: "midlands-oche", label: "UK & Ireland", country: "GBR", endWeek: 24, endDay: 4 }, { week: 11, day: 4, venue: "maas-hal-rotterdam", label: "Europe", country: "NLD", endWeek: 25, endDay: 4 }] } }),
];
const NATIONAL_SLOTS: Record<string, ScheduleSlot> = {
  GBR: { week: 17, day: 6, venue: "the-foundry-manchester", endDay: 7 }, IRL: { week: 19, day: 6, venue: "harbour-rooms-dublin", endDay: 7 },
  NLD: { week: 22, day: 6, venue: "maas-hal-rotterdam", endDay: 7 }, DEU: { week: 23, day: 6, venue: "rhein-hall-dusseldorf", endDay: 7 },
  BEL: { week: 25, day: 6, venue: "scheldt-dome-antwerp", endDay: 7 }, AUS: { week: 27, day: 6, venue: "harbourside-arena-sydney", endDay: 7 },
  CAN: { week: 28, day: 6, venue: "lakeshore-coliseum-toronto", endDay: 7 },
};
const nationalAmateur: EventDefinition[] = Object.entries(NATIONAL_SLOTS).map(([country, slot]) => def({
  key: `national-amateur-${country.toLowerCase()}`, name: `${COUNTRIES[country].name} National Amateur Championship`, family: "national-amateur-championship",
  circuit: "NATIONAL_AMATEUR", classification: "RANKING", rankingCategory: "AMATEUR_NATIONAL",
  presentation: { tier: "FEATURED", featured: true, calendarPriority: 40 }, format: knockout501([7, 7, 9, 9, 11, 13], "floor", 2), fieldSize: 64, npcFill: [0.6, 1],
  npcTierWeights: tw(0.4, 1, 0, 0), geography: { kind: "COUNTRY" }, eligibility: R.all(R.country(country), AMATEUR_ONLY), legacyConcept: "BDO-style national championship",
  schedule: { kind: "FIXED", slots: [{ ...slot, country }] } }));
nationalAmateur.push(
  def({ key: "amateur-masters", name: "National Amateur Masters", family: "amateur-masters", circuit: "NATIONAL_AMATEUR", classification: "RANKING", rankingCategory: "AMATEUR_NATIONAL",
    presentation: { tier: "FEATURED", featured: true, calendarPriority: 42 }, format: knockout501([7, 9, 9, 11, 13], "stage", 2), fieldSize: 32, npcFill: [0.8, 1],
    npcTierWeights: tw(0.1, 1, 0, 0), geography: { kind: "ZONE" }, eligibility: R.all(R.zone("UK_IRELAND"), AMATEUR_ONLY), legacyConcept: "BDO-style masters",
    schedule: { kind: "FIXED", slots: [{ week: 30, day: 6, venue: "seafront-pavilion-blackpool", endDay: 7, country: "GBR" }] } }),
  def({ key: "international-amateur-open", name: "International Amateur Open", family: "international-amateur-open", circuit: "NATIONAL_AMATEUR", classification: "RANKING", rankingCategory: "AMATEUR_NATIONAL",
    presentation: { tier: "FEATURED", featured: false, calendarPriority: 41 }, format: knockout501([7, 7, 9, 9, 11, 11, 13], "floor", 2), fieldSize: 96, npcFill: [0.6, 1],
    npcTierWeights: tw(0.3, 1, 0, 0), geography: { kind: "INTERNATIONAL", hostBonus: 1.2 }, eligibility: AMATEUR_ONLY, legacyConcept: "BDO-style international open",
    schedule: { kind: "FIXED", slots: [{ week: 14, day: 6, venue: "scheldt-dome-antwerp", endDay: 7, country: "BEL" }] } }),
  def({ key: "amateur-world-masters", name: "Amateur World Masters", family: "amateur-world-masters", circuit: "NATIONAL_AMATEUR", classification: "RANKING", rankingCategory: "AMATEUR_NATIONAL",
    presentation: { tier: "TELEVISED", featured: true, calendarPriority: 44 }, format: knockout501([7, 9, 9, 11, 11, 13, 15], "stage", 2), fieldSize: 128, npcFill: [0.6, 1],
    npcTierWeights: tw(0.3, 1, 0, 0), geography: { kind: "INTERNATIONAL", hostBonus: 1 }, eligibility: AMATEUR_ONLY, legacyConcept: "BDO-style world masters",
    schedule: { kind: "FIXED", slots: [{ week: 41, day: 6, venue: "dockyard-arena-liverpool", endDay: 7, country: "GBR" }] } }),
);

// ---------------------------------------------------------------- Q-School (A3 structure only; A5 interprets)
const qSchool: EventDefinition[] = [];
const Q_PLAN: Record<QSchoolPathway, { venue: string; country: string; first: [number, number][]; final: [number, number][] }> = {
  UK_IRELAND: { venue: "midlands-oche", country: "GBR", first: [[2, 2], [2, 3], [2, 4]], final: [[3, 1], [3, 2], [3, 3], [3, 4]] },
  EUROPE: { venue: "rhein-hall-dusseldorf", country: "DEU", first: [[2, 5], [2, 6], [2, 7]], final: [[3, 5], [3, 6], [3, 7], [4, 1]] },
};
for (const pathway of Object.keys(Q_PLAN) as QSchoolPathway[]) {
  const plan = Q_PLAN[pathway];
  const pathwayRule = R.all(R.nonTourCard(), R.zone(...Q_SCHOOL_PATHWAYS[pathway].zones));
  plan.first.forEach(([week, day], index) => qSchool.push(def({
    key: `q-school-first-${pathway.toLowerCase()}-d${index + 1}`, name: `Q-School ${Q_SCHOOL_PATHWAYS[pathway].name} First Stage — Day ${index + 1}`, family: "q-school",
    circuit: "Q_SCHOOL", classification: "QUALIFIER", presentation: { tier: "FEATURED", featured: index === 0, calendarPriority: 55 },
    format: knockout501([9, 9, 9, 9, 9, 11, 11], "qualifier"), fieldSize: 128, minimumEntrants: 8, npcFill: [0.55, 0.9], npcTierWeights: tw(0.25, 1, 0, 0),
    geography: { kind: "ZONE" }, eligibility: pathwayRule, fieldPolicy: index === 0 ? "SELECTION" : "SERIES_FIRST_DAY", registrationLeadWeeks: 8,
    series: { key: `q-school-first-${pathway.toLowerCase()}`, day: index + 1, days: plan.first.length }, qSchool: { pathway, stage: "FIRST", day: index + 1 },
    exclusiveGroup: { key: "q-school", variant: pathway }, legacyConcept: "Q School Days",
    qualificationOutputs: [
      { maxPosition: 9, entitlementType: "STAGE_ENTRY", targetKey: `q-school-final:${pathway}`, targetSeason: "SAME", consumption: "SEASON_PASS" },
      { maxPosition: 1000, entitlementType: "SERIES_ACCESS", targetKey: "challenger-tour", targetSeason: "SAME", consumption: "SEASON_PASS" },
    ],
    schedule: { kind: "FIXED", slots: [{ week, day, venue: plan.venue, country: plan.country }] } })));
  plan.final.forEach(([week, day], index) => qSchool.push(def({
    key: `q-school-final-${pathway.toLowerCase()}-d${index + 1}`, name: `Q-School ${Q_SCHOOL_PATHWAYS[pathway].name} Final Stage — Day ${index + 1}`, family: "q-school",
    circuit: "Q_SCHOOL", classification: "QUALIFIER", presentation: { tier: "FEATURED", featured: true, calendarPriority: 56 },
    format: knockout501([11, 11, 11, 11, 11, 11, 11], "qualifier"), fieldSize: 128, minimumEntrants: 8, npcFill: [1, 1], npcTierWeights: tw(0, 1, 0, 0),
    geography: { kind: "ZONE" }, eligibility: R.all(pathwayRule, R.qualified(`q-school-final:${pathway}`)),
    fieldPolicy: index === 0 ? "ENTITLED_ONLY" : "SERIES_FIRST_DAY", entitlementIntake: [`q-school-final:${pathway}`], registrationLeadWeeks: 8,
    series: { key: `q-school-final-${pathway.toLowerCase()}`, day: index + 1, days: plan.final.length }, qSchool: { pathway, stage: "FINAL", day: index + 1 },
    exclusiveGroup: { key: "q-school", variant: pathway }, legacyConcept: "Q School Days",
    qualificationOutputs: [{ maxPosition: 1000, entitlementType: "SERIES_ACCESS", targetKey: "challenger-tour", targetSeason: "SAME", consumption: "SEASON_PASS" }],
    schedule: { kind: "FIXED", slots: [{ week, day, venue: plan.venue, country: plan.country }] } })));
}

// ---------------------------------------------------------------- Challenger / Vault
const CHALLENGER_WEEKS = [4, 8, 12, 16, 20, 24, 29, 33, 38, 42];
const CHALLENGER_VENUES = ["dockyard-arena-liverpool", "rhein-hall-dusseldorf", "midlands-oche", "ruhr-forum-dortmund", "northern-forum-newcastle"];
const challenger = [def({ key: "challenger-event", name: "Challenger Series Event {n}", family: "challenger-series", circuit: "CHALLENGER", classification: "RANKING", rankingCategory: "CHALLENGER",
  presentation: { tier: "STANDARD", featured: false, calendarPriority: 50 }, format: knockout501([9, 9, 9, 9, 9, 11, 11], "floor"), fieldSize: 128, minimumEntrants: 8, npcFill: [0.7, 1],
  npcTierWeights: tw(0.15, 1, 0, 0), geography: { kind: "INTERNATIONAL", hostBonus: 1.1 }, eligibility: R.all(R.nonTourCard(), R.qualified("challenger-tour")),
  entitlementIntake: [], legacyConcept: "Challenge Tour",
  schedule: { kind: "FIXED", slots: CHALLENGER_WEEKS.flatMap((week, i) => [6, 7].map(day => ({ week, day, venue: CHALLENGER_VENUES[i % CHALLENGER_VENUES.length] }))) } })];

const VAULT_SERIES_WEEKS = [6, 9, 12, 15, 18, 21, 25, 28, 31, 34, 37, 40];
const vault: EventDefinition[] = [
  def({ key: "vault-qualifier", name: "Vault Qualifier {n}", family: "vault", circuit: "VAULT", classification: "QUALIFIER",
    presentation: { tier: "STANDARD", featured: false, calendarPriority: 45 }, format: knockout501([5, 5, 7, 7, 7, 9], "qualifier"), fieldSize: 64, npcFill: [0.5, 0.9],
    npcTierWeights: tw(0.3, 1, 0.4, 0.05), geography: { kind: "ZONE" }, eligibility: R.all(R.zone("UK_IRELAND", "EUROPE"), R.nonTourCard()), legacyConcept: "Modus-style qualifier",
    qualificationOutputs: [
      { maxPosition: 5, entitlementType: "SERIES_ACCESS", targetKey: "vault-series", targetSeason: "SAME", consumption: "SEASON_PASS" },
      { maxPosition: 2, entitlementType: "EVENT_ENTRY", targetKey: "vault-masters", targetSeason: "SAME", consumption: "SINGLE_USE" },
    ],
    schedule: { kind: "FIXED", slots: [3, 13, 26].map(week => ({ week, day: 1, venue: "vault-studio-leeds" })) } }),
  def({ key: "vault-series-night", name: "Vault Series Night {n}", family: "vault", circuit: "VAULT", classification: "RANKING", rankingCategory: "VAULT",
    presentation: { tier: "TELEVISED", featured: false, calendarPriority: 46 }, format: knockout501([7, 7, 9, 11], "stage"), fieldSize: 16, npcFill: [1, 1],
    npcTierWeights: tw(0.05, 1, 0.6, 0.15), geography: { kind: "INTERNATIONAL", hostBonus: 1 }, eligibility: R.any(R.qualified("vault-series"), R.invitation()),
    entitlementIntake: ["vault-series"], invitationPolicy: { count: 16, tierWeights: tw(0, 1, 0.6, 0.1) }, legacyConcept: "Modus-style series",
    schedule: { kind: "FIXED", slots: VAULT_SERIES_WEEKS.map(week => ({ week, day: 1, venue: "vault-studio-leeds" })) } }),
  def({ key: "vault-masters", name: "Vault Masters", family: "vault", circuit: "VAULT", classification: "INVITATIONAL_EXHIBITION",
    presentation: { tier: "TELEVISED", featured: true, calendarPriority: 47 }, format: knockout501([9, 11, 11, 13], "stage", 2), fieldSize: 16, npcFill: [1, 1],
    npcTierWeights: tw(0, 1, 0.5, 0.2), geography: { kind: "INTERNATIONAL", hostBonus: 1 }, eligibility: R.any(R.qualified("vault-masters"), R.invitation()),
    entitlementIntake: ["vault-masters"], invitationPolicy: { count: 16, tierWeights: tw(0, 1, 0.5, 0.2) }, legacyConcept: "Modus-style masters",
    schedule: { kind: "FIXED", slots: [{ week: 43, day: 1, venue: "vault-studio-leeds", endDay: 2 }] } }),
];

// ---------------------------------------------------------------- Professional
// Tue/Wed doubles; week 30 avoided because the Summer Matchplay runs weeks 29–30.
const PRO_WEEKS = [5, 6, 9, 10, 12, 14, 17, 18, 20, 22, 24, 26, 28, 31, 34, 36];
const PRO_VENUES = ["midlands-oche", "rhein-hall-dusseldorf", "the-foundry-manchester", "northern-forum-newcastle", "ruhr-forum-dortmund", "riverside-hall-cardiff"];
const pro = [def({ key: "pro-circuit-championship", name: "Pro Circuit Championship {n}", family: "pro-circuit", circuit: "PRO_CIRCUIT", classification: "RANKING", rankingCategory: "PRO_CIRCUIT",
  presentation: { tier: "STANDARD", featured: false, calendarPriority: 60 }, format: knockout501([11, 11, 11, 11, 11, 13, 13], "floor"), fieldSize: 128, minimumEntrants: 16, npcFill: [0.9, 1],
  npcTierWeights: tw(0, 0, 1, 1), geography: { kind: "INTERNATIONAL", hostBonus: 1 }, eligibility: R.tourCard(), seedingPolicy: { list: "pro-circuit", seeds: 32 }, legacyConcept: "Players",
  registrationLeadWeeks: 6, schedule: { kind: "FIXED", slots: PRO_WEEKS.flatMap((week, i) => [2, 3].map(day => ({ week, day, venue: PRO_VENUES[i % PRO_VENUES.length] }))) } })];

const EDS: [string, string, number][] = [
  ["Berlin", "spree-halle-berlin", 7], ["Rotterdam", "maas-hal-rotterdam", 11], ["Prague", "vltava-arena-prague", 13], ["Antwerp", "scheldt-dome-antwerp", 15],
  ["Copenhagen", "harbour-hall-copenhagen", 19], ["Vienna", "danube-halle-vienna", 21], ["Warsaw", "vistula-hall-warsaw", 23], ["Munich", "isar-forum-munich", 25],
  ["Budapest", "chain-bridge-hall-budapest", 27], ["Brussels", "grand-place-pavilion-brussels", 31], ["Barcelona", "ramblas-arena-barcelona", 35], ["Glasgow", "glasgow-hall", 37],
];
const european: EventDefinition[] = [
  def({ key: "european-series-qualifier", name: "European Dart Series Associate Qualifier {n}", family: "european-dart-series", circuit: "EUROPEAN_SERIES", classification: "QUALIFIER",
    presentation: { tier: "STANDARD", featured: false, calendarPriority: 45 }, format: knockout501([7, 7, 7, 9, 9, 11], "qualifier"), fieldSize: 64, npcFill: [0.5, 0.9],
    npcTierWeights: tw(0.1, 1, 0.3, 0), geography: { kind: "ZONE" }, eligibility: R.all(R.nonTourCard(), R.zone("EUROPE", "UK_IRELAND")), legacyConcept: "European Tour qualifier",
    qualificationOutputs: [{ maxPosition: 3, entitlementType: "SERIES_ACCESS", targetKey: "european-dart-series", targetSeason: "SAME", consumption: "SEASON_PASS" }],
    schedule: { kind: "FIXED", slots: [{ week: 5, day: 6, venue: "rhein-hall-dusseldorf" }, { week: 5, day: 7, venue: "the-foundry-manchester" }, { week: 18, day: 6, venue: "maas-hal-rotterdam" }] } }),
  def({ key: "european-dart-series", name: "European Dart Series — {city}", family: "european-dart-series", circuit: "EUROPEAN_SERIES", classification: "RANKING", rankingCategory: "EUROPEAN_SERIES",
    presentation: { tier: "TELEVISED", featured: true, calendarPriority: 70 }, format: knockout501([11, 11, 11, 11, 13, 13], "stage", 3), fieldSize: 48, minimumEntrants: 16, npcFill: [1, 1],
    npcTierWeights: tw(0, 0.2, 0.8, 1), geography: { kind: "INTERNATIONAL", hostBonus: 1.6 }, eligibility: R.any(R.tourCard(), R.qualified("european-dart-series")),
    entitlementIntake: ["european-dart-series"], seedingPolicy: { list: "european-series", seeds: 16 }, legacyConcept: "European Tour", registrationLeadWeeks: 6,
    schedule: { kind: "FIXED", slots: EDS.map(([city, venue, week]) => ({ week, day: 5, endDay: 7, venue, label: city })) } }),
];

const WS: [string, string, number][] = [
  ["Las Vegas", "desert-pavilion-las-vegas", 25], ["Sydney", "harbourside-arena-sydney", 27], ["Auckland", "waitemata-centre-auckland", 28],
  ["Toronto", "lakeshore-coliseum-toronto", 30], ["New York", "hudson-hall-new-york", 32], ["Tokyo", "bayfront-dome-tokyo", 33],
];
const worldSeries: EventDefinition[] = [
  def({ key: "world-dart-series", name: "World Dart Series — {city}", family: "world-dart-series", circuit: "WORLD_SERIES", classification: "INVITATIONAL_EXHIBITION",
    presentation: { tier: "TELEVISED", featured: true, calendarPriority: 65 }, format: knockout501([11, 11, 13, 15], "stage", 2), fieldSize: 16, minimumEntrants: 8, npcFill: [0.5, 0.5],
    npcTierWeights: tw(0.2, 1, 0.6, 0), geography: { kind: "COUNTRY" }, eligibility: R.any(R.invitation(), R.country("{country}")),
    invitationPolicy: { count: 8, tierWeights: tw(0, 0, 0.15, 1) }, legacyConcept: "World Series",
    schedule: { kind: "FIXED", slots: WS.map(([city, venue, week]) => ({ week, day: 5, endDay: 6, venue, label: city })) } }),
  def({ key: "world-dart-series-finals", name: "World Dart Series Finals", family: "world-dart-series", circuit: "WORLD_SERIES", classification: "INVITATIONAL_EXHIBITION",
    presentation: { tier: "TELEVISED", featured: true, calendarPriority: 66 }, format: knockout501([11, 11, 13, 13, 15], "stage", 3), fieldSize: 24, minimumEntrants: 16, npcFill: [0, 0],
    npcTierWeights: tw(0, 0, 0.3, 1), geography: { kind: "INTERNATIONAL", hostBonus: 1 }, eligibility: R.any(R.invitation(), R.result("world-dart-series", 2, "SAME")),
    invitationPolicy: { count: 24, tierWeights: tw(0, 0, 0.3, 1) }, legacyConcept: "World Series Finals",
    schedule: { kind: "FIXED", slots: [{ week: 37, day: 5, endDay: 7, venue: "maas-hal-rotterdam" }] } }),
];

const majors: EventDefinition[] = [
  def({ key: "open-championship-qualifier", name: "Open Championship Qualifier — {city}", family: "open-championship", circuit: "MAJOR", classification: "QUALIFIER",
    presentation: { tier: "STANDARD", featured: false, calendarPriority: 48 }, format: knockout501([7, 7, 9, 9, 9, 11], "qualifier"), fieldSize: 64, npcFill: [0.5, 0.9],
    npcTierWeights: tw(0.2, 1, 0.1, 0), geography: { kind: "COUNTRY" }, eligibility: R.all(R.nonTourCard(), R.country("{country}")), legacyConcept: "UK Open qualifier",
    qualificationOutputs: [{ maxPosition: 2, entitlementType: "EVENT_ENTRY", targetKey: "open-championship", targetSeason: "SAME", consumption: "SINGLE_USE" }],
    schedule: { kind: "FIXED", slots: [
      { week: 4, day: 5, venue: "glasgow-hall", label: "Glasgow", country: "GBR" }, { week: 6, day: 5, venue: "riverside-hall-cardiff", label: "Cardiff", country: "GBR" },
      { week: 7, day: 5, venue: "harbour-rooms-dublin", label: "Dublin", country: "IRL" }, { week: 8, day: 5, venue: "northern-forum-newcastle", label: "Newcastle", country: "GBR" },
      { week: 8, day: 4, venue: "maas-hal-rotterdam", label: "Rotterdam", country: "NLD" }, { week: 7, day: 4, venue: "spree-halle-berlin", label: "Berlin", country: "DEU" } ] } }),
  def({ key: "open-championship", name: "The Open Championship", family: "open-championship", circuit: "MAJOR", classification: "RANKING", rankingCategory: "PRO_MAJOR",
    presentation: { tier: "MAJOR", featured: true, calendarPriority: 90 }, format: knockout501([11, 11, 11, 11, 19, 19, 21, 21], "major", 3), fieldSize: 128, minimumEntrants: 32, npcFill: [1, 1],
    npcTierWeights: tw(0, 0, 1, 1), geography: { kind: "INTERNATIONAL", hostBonus: 1 }, eligibility: R.any(R.tourCard(), R.qualified("open-championship")),
    entitlementIntake: ["open-championship"], seedingPolicy: { list: "pro-world", seeds: 32 }, legacyConcept: "UK Open", registrationLeadWeeks: 8,
    schedule: { kind: "FIXED", slots: [{ week: 10, day: 5, endDay: 7, venue: "seafront-pavilion-blackpool" }] } }),
  def({ key: "champions-masters", name: "Champions Masters", family: "champions-masters", circuit: "INVITATIONAL", classification: "INVITATIONAL_EXHIBITION",
    presentation: { tier: "TELEVISED", featured: true, calendarPriority: 80 }, format: knockout501([11, 19, 19, 21, 21], "stage", 2), fieldSize: 24, minimumEntrants: 16, npcFill: [0, 0],
    npcTierWeights: tw(0, 0, 0.2, 1), geography: { kind: "INTERNATIONAL", hostBonus: 1 }, eligibility: R.any(R.ranking("pro-world", 24), R.invitation()),
    invitationPolicy: { count: 24, tierWeights: tw(0, 0, 0.2, 1) }, legacyConcept: "Masters",
    schedule: { kind: "FIXED", slots: [{ week: 5, day: 6, endDay: 7, venue: "castle-exchange-edinburgh" }] } }),
  def({ key: "thursday-night-darts", name: "Thursday Night Darts", family: "thursday-night-darts", circuit: "INVITATIONAL", classification: "INVITATIONAL_EXHIBITION",
    presentation: { tier: "TELEVISED", featured: true, calendarPriority: 85 }, format: league501(11, "stage", 16), fieldSize: 8, minimumEntrants: 8, npcFill: [0, 0],
    npcTierWeights: tw(0, 0, 0, 1), geography: { kind: "INTERNATIONAL", hostBonus: 1 }, eligibility: R.invitation(), invitationPolicy: { count: 8, tierWeights: tw(0, 0, 0, 1) },
    legacyConcept: "Premier League", schedule: { kind: "FIXED", slots: [{ week: 6, day: 4, endWeek: 21, endDay: 4, venue: "the-foundry-manchester" }] } }),
  def({ key: "long-format-matchplay", name: "Summer Matchplay", family: "summer-matchplay", circuit: "MAJOR", classification: "RANKING", rankingCategory: "PRO_MAJOR",
    presentation: { tier: "MAJOR", featured: true, calendarPriority: 92 }, format: knockout501([19, 21, 25, 33, 35], "major", 9), fieldSize: 32, minimumEntrants: 32, npcFill: [0, 0],
    npcTierWeights: tw(0, 0, 0.35, 1), geography: { kind: "INTERNATIONAL", hostBonus: 1 }, eligibility: R.any(R.ranking("pro-world", 16), R.ranking("pro-circuit", 16), R.invitation()),
    invitationPolicy: { count: 32, tierWeights: tw(0, 0, 0.35, 1) }, seedingPolicy: { list: "pro-world", seeds: 16 }, legacyConcept: "Matchplay",
    schedule: { kind: "FIXED", slots: [{ week: 29, day: 6, endWeek: 30, endDay: 7, venue: "seafront-pavilion-blackpool" }] } }),
  def({ key: "double-start-grand-prix", name: "Double Start Grand Prix", family: "double-start-grand-prix", circuit: "MAJOR", classification: "RANKING", rankingCategory: "PRO_MAJOR",
    presentation: { tier: "MAJOR", featured: true, calendarPriority: 91 }, format: setsKnockout501([3, 3, 5, 5, 7], 5, "major", 7, "DOUBLE"), fieldSize: 32, minimumEntrants: 32, npcFill: [0, 0],
    npcTierWeights: tw(0, 0, 0.35, 1), geography: { kind: "INTERNATIONAL", hostBonus: 1 }, eligibility: R.any(R.ranking("pro-world", 32), R.invitation()),
    invitationPolicy: { count: 32, tierWeights: tw(0, 0, 0.35, 1) }, seedingPolicy: { list: "pro-world", seeds: 8 }, legacyConcept: "World Grand Prix",
    schedule: { kind: "FIXED", slots: [{ week: 39, day: 1, endDay: 7, venue: "harbour-rooms-dublin" }] } }),
  def({ key: "european-championship", name: "European Championship", family: "european-dart-series", circuit: "MAJOR", classification: "RANKING", rankingCategory: "PRO_MAJOR",
    presentation: { tier: "MAJOR", featured: true, calendarPriority: 88 }, format: knockout501([11, 19, 21, 21, 21], "major", 4), fieldSize: 32, minimumEntrants: 32, npcFill: [0, 0],
    npcTierWeights: tw(0, 0, 0.5, 1), geography: { kind: "INTERNATIONAL", hostBonus: 1 }, eligibility: R.any(R.ranking("european-series", 32), R.invitation()),
    invitationPolicy: { count: 32, tierWeights: tw(0, 0, 0.5, 1) }, seedingPolicy: { list: "european-series", seeds: 8 }, legacyConcept: "European Championship",
    schedule: { kind: "FIXED", slots: [{ week: 41, day: 4, endDay: 7, venue: "ruhr-forum-dortmund" }] } }),
  def({ key: "grand-slam-of-champions", name: "Grand Slam of Champions", family: "grand-slam-of-champions", circuit: "MAJOR", classification: "RANKING", rankingCategory: "PRO_MAJOR",
    presentation: { tier: "MAJOR", featured: true, calendarPriority: 89 }, format: groupKnockout501(9, [19, 31, 31, 35], 4, 2, "major", 9), fieldSize: 32, minimumEntrants: 32, npcFill: [0, 0],
    npcTierWeights: tw(0, 0.2, 0.3, 1), geography: { kind: "INTERNATIONAL", hostBonus: 1 }, eligibility: R.any(R.result("open-championship", 2, "SAME"), R.result("amateur-world-masters", 2, "SAME"), R.invitation()),
    invitationPolicy: { count: 32, tierWeights: tw(0, 0.1, 0.3, 1) }, legacyConcept: "Grand Slam",
    schedule: { kind: "FIXED", slots: [{ week: 42, day: 6, endWeek: 43, endDay: 7, venue: "dockyard-arena-liverpool" }] } }),
  def({ key: "pro-circuit-finals", name: "Pro Circuit Finals", family: "pro-circuit", circuit: "MAJOR", classification: "RANKING", rankingCategory: "PRO_MAJOR",
    presentation: { tier: "MAJOR", featured: true, calendarPriority: 87 }, format: knockout501([11, 11, 19, 19, 21, 21], "major", 3), fieldSize: 64, minimumEntrants: 32, npcFill: [0, 0],
    npcTierWeights: tw(0, 0, 0.8, 1), geography: { kind: "INTERNATIONAL", hostBonus: 1 }, eligibility: R.any(R.ranking("pro-circuit", 64), R.invitation()),
    invitationPolicy: { count: 64, tierWeights: tw(0, 0, 0.8, 1) }, seedingPolicy: { list: "pro-circuit", seeds: 16 }, legacyConcept: "Players Championship Finals",
    schedule: { kind: "FIXED", slots: [{ week: 44, day: 5, endDay: 7, venue: "the-foundry-manchester" }] } }),
];

const worldChampionship: EventDefinition[] = [
  def({ key: "world-championship-qualifier", name: "World Championship Qualifier — {label}", family: "world-darts-championship", circuit: "WORLD_CHAMPIONSHIP", classification: "QUALIFIER",
    presentation: { tier: "FEATURED", featured: true, calendarPriority: 58 }, format: knockout501([9, 9, 9, 11, 11, 11, 13], "qualifier"), fieldSize: 128, minimumEntrants: 8, npcFill: [0.6, 1],
    npcTierWeights: tw(0, 0.6, 1, 0.2), geography: { kind: "ZONE" }, eligibility: R.all(R.zone("{zone}" as Zone), R.not(R.ranking("pro-world", 64))), legacyConcept: "PDC Worlds qualifier",
    qualificationOutputs: [{ maxPosition: 3, entitlementType: "EVENT_ENTRY", targetKey: "world-championship", targetSeason: "SAME", consumption: "SINGLE_USE" }],
    schedule: { kind: "FIXED", slots: [
      { week: 45, day: 6, venue: "midlands-oche", label: "UK & Ireland", country: "GBR" },
      { week: 45, day: 7, venue: "rhein-hall-dusseldorf", label: "Europe", country: "DEU" },
      { week: 46, day: 6, venue: "lakeshore-coliseum-toronto", label: "Rest of World", country: "CAN" } ] } }),
  def({ key: "amateur-world-qualifier", name: "Amateur World Championship Qualifier", family: "world-darts-championship", circuit: "WORLD_CHAMPIONSHIP", classification: "QUALIFIER",
    presentation: { tier: "FEATURED", featured: true, calendarPriority: 57 }, format: knockout501([7, 7, 9, 9, 9, 11, 11], "qualifier"), fieldSize: 128, minimumEntrants: 8, npcFill: [0.6, 1],
    npcTierWeights: tw(0.2, 1, 0, 0), geography: { kind: "INTERNATIONAL", hostBonus: 1.1 }, eligibility: AMATEUR_ONLY, legacyConcept: "Riley's-style amateur qualifier",
    qualificationOutputs: [{ maxPosition: 2, entitlementType: "EVENT_ENTRY", targetKey: "world-championship", targetSeason: "SAME", consumption: "SINGLE_USE" }],
    schedule: { kind: "FIXED", slots: [{ week: 47, day: 6, venue: "the-foundry-manchester", endDay: 7 }] } }),
  def({ key: "world-darts-championship", name: "World Darts Championship", family: "world-darts-championship", circuit: "WORLD_CHAMPIONSHIP", classification: "RANKING", rankingCategory: "PRO_WORLD_CHAMPIONSHIP",
    presentation: { tier: "WORLD", featured: true, calendarPriority: 100 }, format: setsKnockout501([3, 3, 5, 5, 7, 7, 13], 5, "major", 18), fieldSize: 128, minimumEntrants: 64, npcFill: [0, 0],
    npcTierWeights: tw(0, 0.2, 1, 1), geography: { kind: "INTERNATIONAL", hostBonus: 1 },
    eligibility: R.any(R.ranking("pro-world", 32), R.ranking("pro-circuit", 32), R.qualified("world-championship"), R.invitation()),
    entitlementIntake: ["world-championship"], invitationPolicy: { count: 96, tierWeights: tw(0, 0, 1, 1) }, seedingPolicy: { list: "pro-world", seeds: 32 },
    legacyConcept: "PDC Worlds", registrationLeadWeeks: 10,
    schedule: { kind: "FIXED", slots: [{ week: 50, day: 2, endWeek: 52, endDay: 5, venue: "the-palace-london" }] } }),
];

const NATIONAL_SPECIALS: [string, string, Exclude<EventFormat["gameType"], "X01">, number, string][] = [
  ["shanghai-showdown", "Shanghai Showdown", "SHANGHAI", 3, "Shanghai"], ["bobs-27-challenge", "Bob's 27 Challenge", "BOBS_27", 8, "Bob's 27"],
  ["scram-shootout", "Scram Shootout", "SCRAM", 11, "Scram"], ["baseball-darts-classic", "Baseball Darts Classic", "BASEBALL", 14, "Baseball"],
  ["fives-festival", "Fives Festival", "FIVES", 19, "Fives"], ["national-halve-it", "National Halve-It", "HALVE_IT", 22, "National Halve It"],
  ["national-cricket", "National Cricket", "CRICKET", 26, "National Cricket"], ["golf-18-open", "Golf 18 Open", "GOLF", 31, "Golf 18"],
  ["snooker-darts-cup", "Snooker Darts Cup", "SNOOKER", 35, "Snooker Darts"], ["noughts-and-crosses-trophy", "Noughts & Crosses Trophy", "NOUGHTS_AND_CROSSES", 38, "Noughts/Crosses"],
];
const specials: EventDefinition[] = NATIONAL_SPECIALS.map(([key, name, game, week, legacy]) => def({ key, name, family: "tkdl-specials", circuit: "SPECIAL", classification: "SPECIAL",
  presentation: { tier: "FEATURED", featured: false, calendarPriority: 6, brandingFamily: "tkdl-specials" }, format: specialGame(game, [3, 3, 5, 5, 7]), fieldSize: 32, npcFill: [0.5, 1],
  npcTierWeights: tw(0.6, 1, 0.3, 0.1), geography: { kind: "INTERNATIONAL", hostBonus: 1 }, eligibility: R.open(), legacyConcept: legacy,
  schedule: { kind: "FIXED", slots: [{ week, day: 3, venue: "vault-studio-leeds" }] } }));
specials.push(def({ key: "treble-out-trophy", name: "Treble Out Trophy", family: "tkdl-specials", circuit: "SPECIAL", classification: "SPECIAL",
  presentation: { tier: "FEATURED", featured: false, calendarPriority: 6, brandingFamily: "tkdl-specials" },
  format: { ...knockout501([3, 3, 5, 5, 7], "local"), outRule: "MASTER" }, fieldSize: 32, npcFill: [0.5, 1],
  npcTierWeights: tw(0.6, 1, 0.3, 0.1), geography: { kind: "INTERNATIONAL", hostBonus: 1 }, eligibility: R.open(), legacyConcept: "Treble Out",
  schedule: { kind: "FIXED", slots: [{ week: 41, day: 3, venue: "vault-studio-leeds" }] } }));

export const EVENT_CATALOGUE_V1: readonly EventDefinition[] = Object.freeze([
  ...grassroots, ...county, ...regional, ...nationalAmateur, ...qSchool, ...challenger, ...vault, ...pro, ...european, ...worldSeries, ...majors, ...worldChampionship, ...specials,
]);

// ---------------------------------------------------------------- EVENT DATABASE v2 (A6.5)
/**
 * v2 = every v1 definition (re-versioned, unchanged) plus the narrow A6.5 content:
 *  - Junior Development Circuit (fictional; under-18 on the event date, from AGE_POLICY).
 *    Juniors may still enter any open/amateur event they are otherwise eligible for.
 *  - The Double Crown: the Grand-Prix-style 501 double-in / double-out set-play major,
 *    replacing v1's "Double Start Grand Prix" slot (same week, venue and field rules).
 */
const JUNIOR_ONLY = R.all(AMATEUR_ONLY, R.age({ maxAgeExclusive: AGE_POLICY.juniorMaxAgeExclusive }));
const junior: Omit<EventDefinition, "eventDatabaseVersion">[] = [
  def({ key: "junior-development-night", name: "{city} Junior Development Night", family: "junior-development-circuit", circuit: "GRASSROOTS", classification: "RANKING", rankingCategory: "AMATEUR_LOCAL",
    presentation: { tier: "LOCAL", featured: false, calendarPriority: 11, brandingFamily: "junior-development-circuit" }, format: knockout501([3, 3, 5, 5], "local"), fieldSize: 16, npcFill: [0.6, 1],
    npcTierWeights: tw(1, 0.6, 0.05, 0), geography: { kind: "COUNTRY" }, eligibility: R.all(R.country("{country}"), JUNIOR_ONLY), registrationLeadWeeks: 3,
    profiles: { ...profiles("grassroots"), entryFee: "fee:junior" },
    legacyConcept: "Junior development (fictional circuit)", schedule: { kind: "LOCAL_ROTATION", venueKind: "CLUB", perWeight: 0.6, day: 6, weekRange: [2, 48], countries: ["GBR", "IRL", "NLD", "DEU", "BEL"] } }),
  def({ key: "junior-development-championship", name: "Junior Development Championship", family: "junior-development-circuit", circuit: "NATIONAL_AMATEUR", classification: "RANKING", rankingCategory: "AMATEUR_NATIONAL",
    presentation: { tier: "FEATURED", featured: true, calendarPriority: 40, brandingFamily: "junior-development-circuit" }, format: knockout501([5, 5, 5, 7, 7], "stage", 2), fieldSize: 32, minimumEntrants: 8, npcFill: [0.7, 1],
    npcTierWeights: tw(1, 1, 0.2, 0), geography: { kind: "INTERNATIONAL", hostBonus: 1 }, eligibility: JUNIOR_ONLY, registrationLeadWeeks: 6,
    profiles: { ...profiles("national_amateur"), entryFee: "fee:junior" },
    legacyConcept: "Junior development finals (fictional circuit)", schedule: { kind: "FIXED", slots: [{ week: 33, day: 6, endDay: 7, venue: "midlands-oche" }] } }),
];
const doubleCrown = (() => {
  const original = majors.find(d => d.key === "double-start-grand-prix")!;
  return { ...original, key: "double-crown", name: "The Double Crown", family: "double-crown",
    presentation: { ...original.presentation, brandingFamily: "double-crown", heroAssetKey: "hero:double-crown", badgeAssetKey: "badge:double-crown" },
    legacyConcept: "Grand-Prix-style double-in major (fictional)" };
})();
export const EVENT_CATALOGUE_V2: readonly EventDefinition[] = Object.freeze([
  ...EVENT_CATALOGUE_V1.filter(d => d.key !== "double-start-grand-prix"), doubleCrown, ...junior,
].map(d => ({ ...d, eventDatabaseVersion: 2 })));
export const EVENT_CATALOGUE_V3 = expandWorldCatalogue(EVENT_CATALOGUE_V2);
/** A8.2: never edit v3 definitions or convert an existing edition's locked draw. */
export const EVENT_CATALOGUE_V4: readonly EventDefinition[] = Object.freeze(EVENT_CATALOGUE_V3.map(d => ({
  ...d, eventDatabaseVersion: 4,
  ...(d.key === "vault-nights" ? {
    format: groupKnockout501(9, [11, 13, 15], 4, 2, "stage", 1),
    fieldSize: 16, minimumEntrants: 16, npcFill: [1, 1] as [number, number],
  } : {}),
})));

export function catalogueFor(version: number): readonly EventDefinition[] {
  if (version === EVENT_DATABASE_VERSION) return EVENT_CATALOGUE_V1;
  if (version === 2) return EVENT_CATALOGUE_V2;
  if (version === 3) return EVENT_CATALOGUE_V3;
  if (version === 4) return EVENT_CATALOGUE_V4;
  if (version === 5) return EVENT_CATALOGUE_V5;
  throw new Error(`Unsupported Career event database version ${version}; migration required`);
}
/** A9: same authored world; first Q-School policy is applied by season generation. */
export const EVENT_CATALOGUE_V5: readonly EventDefinition[] = Object.freeze(
  EVENT_CATALOGUE_V4.map(d=>({...d,eventDatabaseVersion:5})));
/** Referenced so a missing locality list fails at module load, not mid-season. */
export const CATALOGUE_LOCALITY_COUNT = LOCALITIES.length;
