import { pick, scopedRandom } from "../world/random.ts";
import { LOCALITIES, zoneOf } from "../calendar/geography.ts";
import { journey, tripCost } from "../finance/travel.ts";
import type { TravelBand } from "../finance/config.ts";

/**
 * Road trips: pack your darts, drive to another town and take on its locals for money (first to four, the same
 * simulator and haggling as a money match at your club). A town's champion only plays a stranger who has beaten one of
 * their locals that night, or one whose name already carries there. Beat the champion and the town is yours: your
 * reputation on the road grows, the stakes grow with it, and players from the towns you've conquered start turning up
 * at your club to have a go.
 */
export const ROAD = Object.freeze({
  version: 1,
  /** One trip a week; on a trip, this many money matches. */
  perWeek: 1, matchesPerTrip: 3,
  /** Locals who'll play a stranger, the town's best three below the champion. */
  locals: 3,
  /** Stakes grow with your name: so much more per town you've conquered (at most double). */
  appetitePerTown: 0.1, appetiteCap: 2,
  /** A week's chance that someone from a conquered town turns up at your club, and how much more they put up. */
  visitorChance: 0.35, visitorStake: 1.5,
});

export const REPUTATION = [
  { towns: 0, title: "Unknown on the road", note: "Nobody's heard of you. Locals will take your money happily." },
  { towns: 1, title: "Known on the circuit", note: "Word's getting round. Players from towns you've taken start coming to your club." },
  { towns: 3, title: "Feared hustler", note: "Champions expect you. Bigger stakes, harder games." },
  { towns: 6, title: "Legend of the road", note: "Every town wants a crack at you." },
] as const;
export const reputationFor = (towns: number) => [...REPUTATION].reverse().find(r => towns >= r.towns)!;
export const appetiteBoost = (towns: number) => Math.min(ROAD.appetiteCap, 1 + towns * ROAD.appetitePerTown);

/** Towns you can drive (or fly) to: the rest of your part of the world. */
export function destinationsFrom(homeKey: string) {
  const home = LOCALITIES.find(l => l.key === homeKey);
  if (!home) return [];
  const zone = zoneOf(home.country);
  return LOCALITIES.filter(l => l.key !== home.key && (zone === "REST_OF_WORLD" ? l.country === home.country : zoneOf(l.country) === zone));
}
/** What getting there and back costs (one night: you drive home, or stay over if it's far). */
export function tripCostTo(homeKey: string, town: { country: string; city: string }) {
  const home = LOCALITIES.find(l => l.key === homeKey)!;
  const band: TravelBand = town.country === home.country ? "DOMESTIC" : zoneOf(town.country) === "UK_IRELAND" && zoneOf(home.country) === "UK_IRELAND" ? "UK_IRELAND" : "EUROPE";
  const j = journey({ locality: home.key, country: home.country, zone: zoneOf(home.country), travelVersion: 3 }, town);
  const t = tripCost(band, 1, j.miles, j.sea);
  return { miles: "miles" in t ? (t as { miles: number }).miles : j.miles === null ? null : Math.round(j.miles * 1.25), pence: t.travelPence + t.accommodationPence, overnight: t.nights > 0 };
}

const GREETINGS = {
  LOCAL: ["Fancy a game, stranger?", "Not seen you in here before. Got money?", "You're the one from out of town? Go on then."],
  CHAMPION: ["So you're the one beating my regulars. My turn.", "Nobody comes in here and takes our money. First to four.", "Heard about you. Let's see it."],
  VISITOR: ["You took our champion's money. I've come for it back.", "Drove all this way to play you. Name your stake.", "Our lot are still talking about you. Let's settle it."],
} as const;
export const greetingFor = (seed: string, key: string, kind: keyof typeof GREETINGS) => pick(scopedRandom(seed, ROAD.version, "road-greeting", key), GREETINGS[kind]);

/** This week's visitor from a conquered town, if any (the same answer every time). */
export function weeklyVisitor<T extends { key: string }>(seed: string, season: number, week: number, candidates: readonly T[]) {
  if (!candidates.length) return null;
  const rng = scopedRandom(seed, ROAD.version, "road-visitor", season, week);
  if (rng() >= ROAD.visitorChance) return null;
  return pick(rng, [...candidates].sort((a, b) => a.key.localeCompare(b.key)));
}
