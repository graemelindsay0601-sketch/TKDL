import { definitionSchema, type Definition, type Venue, type Format, type Rule, type EventSnapshot } from "./types.ts";
import { scopedRandom, stableUuid, pick } from "../world/random.ts";

export const EVENT_DATABASE_VERSION = 1;
export const VENUES: Venue[] = [
  ["clyde", "Clyde Hall", "Glasgow", "GBR", "Scotland", "UK_IRELAND"],
  ["caledonia", "Caledonia Arena", "Edinburgh", "GBR", "Scotland", "UK_IRELAND"],
  ["foundry", "The Foundry", "Manchester", "GBR", "North England", "UK_IRELAND"],
  ["dockyard", "Dockyard Arena", "Liverpool", "GBR", "North England", "UK_IRELAND"],
  ["midlands", "Midlands Hall", "Birmingham", "GBR", "Midlands", "UK_IRELAND"],
  ["palace", "The Palace", "London", "GBR", "London", "UK_IRELAND"],
  ["liffey", "Liffey Hall", "Dublin", "IRL", "Leinster", "UK_IRELAND"],
  ["canal", "Canal Hall", "Utrecht", "NLD", "Utrecht", "EUROPE"],
  ["forge", "River Forge", "Bremen", "DEU", "Bremen", "EUROPE"],
  ["lantern", "Lantern Arena", "Antwerp", "BEL", "Flanders", "EUROPE"],
  ["southern", "Southern Hall", "Melbourne", "AUS", "Victoria", "WORLD"],
  ["maple", "Maple Arena", "Toronto", "CAN", "Ontario", "WORLD"],
].map(([key, name, city, country, region, group]) => ({ key, name, city, country, region, group }));
export const SUPPORTED_FORMAT: Format = { structure: "KNOCKOUT", game: "X01", startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", bestOfLegs: 7, bestOfSets: null, legsPerSet: null, groupSize: null, stage: 1, firstThrowMethod: "DRAW_ORDER" };
const open: Rule = { op: "OPEN_ENTRY" };
const pro: Rule = { op: "STATUS", value: "PROFESSIONAL" };
const amateur: Rule = { op: "STATUS", value: "AMATEUR" };
const weeks = (start: number, end: number, step = 1) => Array.from({ length: Math.floor((end - start) / step) + 1 }, (_, i) => start + i * step);
export function catalogue(version: number): Definition[] {
  if (version !== EVENT_DATABASE_VERSION) throw new Error(`Unsupported Career event database version ${version}`);
  const all: Definition[] = [];
  const add = (key: string, name: string, circuit: Definition["circuit"], schedule: number[], options: Partial<Definition> = {}) => {
    all.push(definitionSchema.parse({ key, version: 1, name, shortName: name, family: key, circuit, classification: "RANKING", weeks: schedule,
      dayInWeek: 4, durationDays: 1, venuePool: VENUES.slice(0, 5), fieldSize: 16, format: SUPPORTED_FORMAT,
      eligibility: open, prestige: 20, priority: 20, presentationTier: "STANDARD", pathway: null, qualification: null,
      rankingCategory: circuit, prizeProfile: `${circuit.toLowerCase()}-prizes`, entryFeeProfile: "future-a4", travelProfile: "future-a4", accommodationProfile: "future-a4", ...options }));
  };
  for (const [area, venues] of [["scotland", VENUES.slice(0, 2)], ["england", VENUES.slice(2, 5)], ["europe", VENUES.slice(7, 10)], ["international", VENUES.slice(10)]] as const) {
    add(`local-${area}`, "Friday Night 501", "GRASSROOTS", weeks(1, 49), { fieldSize: 8, venuePool: [...venues], prestige: 5, priority: 5, presentationTier: "LOCAL" });
    add(`county-${area}`, "County 501 Open", "COUNTY", weeks(2, 46, 4), { venuePool: [...venues], dayInWeek: 6 });
  }
  add("regional-open", "Regional Open", "REGIONAL", weeks(3, 47, 4), { venuePool: VENUES, fieldSize: 24, dayInWeek: 5 });
  add("amateur-open", "National Amateur Open", "NATIONAL_AMATEUR", [10, 18, 24, 32, 40, 46], { eligibility: amateur, fieldSize: 32, venuePool: VENUES.slice(0, 10), prestige: 35 });
  add("challenger", "Challenger Circuit", "CHALLENGER", weeks(7, 45, 2), { eligibility: { op: "NON_TOUR_CARD" }, venuePool: VENUES.slice(0, 10), fieldSize: 32, dayInWeek: 2, prestige: 40 });
  add("vault-qualifier", "Vault Qualifier", "VAULT", [10, 16, 22, 28, 34], { classification: "QUALIFIER", rankingCategory: null, eligibility: amateur, qualification: { targetKey: "vault", targetKind: "FAMILY", top: 2 } });
  add("vault", "Vault Series", "VAULT", [13, 19, 25, 31, 37], { format: { ...SUPPORTED_FORMAT, structure: "GROUPS_KNOCKOUT", groupSize: 4 }, fieldSize: 24, eligibility: { op: "ANY_OF", rules: [{ op: "ENTITLEMENT" }, { op: "INVITATION" }] }, presentationTier: "TELEVISED", prestige: 55 });
  for (const pathway of ["UK_IRELAND", "EUROPE"] as const) for (let day = 1; day <= 4; day++) {
    add(`q-school-${pathway.toLowerCase()}-${day}`, `${pathway === "EUROPE" ? "Continental" : "Islands"} Q-School Day ${day}`, "Q_SCHOOL", [day <= 2 ? 5 : 6], {
      family: `q-school-${pathway.toLowerCase()}`, pathway, classification: "QUALIFIER", rankingCategory: null,
      dayInWeek: day % 2 ? 1 : 4, fieldSize: 48, venuePool: pathway === "EUROPE" ? VENUES.slice(7, 10) : [VENUES[2], VENUES[6]],
      format: { ...SUPPORTED_FORMAT, stage: day }, eligibility: { op: "ALL_OF", rules: [{ op: "NON_TOUR_CARD" }, { op: "COUNTRY", values: pathway === "EUROPE" ? ["NLD", "DEU", "BEL", "FRA", "ESP", "POL"] : ["GBR", "IRL"] }] }, prestige: 50,
    });
  }
  add("pro-circuit", "Pro Circuit Championship", "PRO_CIRCUIT", weeks(8, 43), { eligibility: { op: "TOUR_CARD" }, fieldSize: 64, venuePool: VENUES.slice(2, 10), dayInWeek: 0, prestige: 65, priority: 70, presentationTier: "FEATURED" });
  add("european-qualifier", "European Dart Series Qualifier", "EUROPEAN_SERIES", weeks(9, 42, 3), { classification: "QUALIFIER", rankingCategory: null, fieldSize: 32, venuePool: VENUES.slice(7, 10), qualification: { targetKey: "european", targetKind: "FAMILY", top: 2 }, dayInWeek: 1, prestige: 50 });
  add("european", "European Dart Series", "EUROPEAN_SERIES", weeks(10, 43, 3), { eligibility: { op: "ANY_OF", rules: [{ op: "ENTITLEMENT" }, { op: "INVITATION" }] }, fieldSize: 48, venuePool: VENUES.slice(7, 10), prestige: 75, priority: 75, presentationTier: "TELEVISED" });
  add("world-series", "World Dart Series", "WORLD_SERIES", [17, 23, 29, 35], { classification: "INVITATIONAL_EXHIBITION", rankingCategory: null, eligibility: { op: "INVITATION" }, venuePool: VENUES.slice(7), fieldSize: 16, prestige: 75, presentationTier: "TELEVISED" });
  add("thursday", "Thursday Night Darts", "INVITATIONAL", weeks(12, 36, 3), { classification: "INVITATIONAL_EXHIBITION", rankingCategory: null, eligibility: { op: "INVITATION" }, format: { ...SUPPORTED_FORMAT, structure: "ROUND_ROBIN" }, dayInWeek: 3, fieldSize: 8, prestige: 85, presentationTier: "TELEVISED" });
  for (const [key, name, week] of [["crown", "The Crown Open", 25], ["match-trophy", "The Match Trophy", 34], ["double-crown", "The Double Crown", 41], ["champions", "Champions Cup", 44]] as const) {
    add(key, name, "MAJOR", [week], { eligibility: { op: "ANY_OF", rules: [pro, { op: "ENTITLEMENT" }] }, venuePool: VENUES.slice(2, 10), fieldSize: 64, prestige: 90, priority: 90, presentationTier: "MAJOR", format: key === "double-crown" ? { ...SUPPORTED_FORMAT, inRule: "DOUBLE" } : { ...SUPPORTED_FORMAT, bestOfLegs: 19 } });
  }
  add("world-qualifier", "Palace Open Qualifier", "WORLD_CHAMPIONSHIP", [48, 49], { classification: "QUALIFIER", rankingCategory: null, fieldSize: 96, venuePool: VENUES.slice(2, 10), qualification: { targetKey: "worlds", targetKind: "EVENT", top: 4 }, prestige: 75 });
  add("worlds", "World Championship", "WORLD_CHAMPIONSHIP", [50], { eligibility: { op: "ANY_OF", rules: [{ op: "ENTITLEMENT" }, { op: "RANK", category: "PRO", maximum: 96 }] }, fieldSize: 128, durationDays: 17, venuePool: [VENUES[5]], prestige: 100, priority: 100, presentationTier: "WORLD", format: { ...SUPPORTED_FORMAT, bestOfSets: 5, legsPerSet: 5 } });
  add("special-cricket", "Community Cricket Night", "SPECIAL", [8, 20, 32, 44], { classification: "SPECIAL", rankingCategory: null, fieldSize: 8, format: { ...SUPPORTED_FORMAT, game: "CRICKET" }, prestige: 5, presentationTier: "LOCAL" });
  return all;
}

export function generateSeason(seed: string, version: number, season: number): EventSnapshot[] {
  if (!Number.isSafeInteger(season) || season < 1) throw new Error("Invalid Career season");
  return catalogue(version).flatMap(definition => definition.weeks.map((week, index) => {
    const key = `${definition.key}:${index + 1}`;
    const startDay = (week - 1) * 7 + definition.dayInWeek;
    const endDay = startDay + definition.durationDays - 1;
    if (endDay > 363) throw new Error(`Event outside season: ${key}`);
    return { id: stableUuid(seed, version, "career-event", season, key), key, season, definition: structuredClone(definition),
      venue: structuredClone(pick(scopedRandom(seed, version, "event-venue", season, key), definition.venuePool)),
      startDay, endDay, opensDay: Math.max(0, startDay - 21), closesDay: Math.max(0, startDay - 1) };
  })).sort((a, b) => a.startDay - b.startDay || b.definition.priority - a.definition.priority || a.key.localeCompare(b.key));
}
