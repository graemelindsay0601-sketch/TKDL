import { CAREER_SIMULATION_CONFIG as S } from "../world/config.ts";
import { pick, scopedRandom } from "../world/random.ts";

/**
 * Money matches: a one-off game at your club against another member, first to four legs of 501, for a stake each.
 * The winner takes the other's stake. The match is completed in the live scorer, and the money goes through the ledger like any other.
 */
export const MONEY = Object.freeze({
  version: 1,
  /** First to four legs. */
  bestOf: 7,
  /** The smallest stake anyone will play for, and stakes go in whole pounds. */
  minimumPence: 500, stepPence: 100,
  /** What a member will ever risk, by their average: club amateurs £100 (averaging 35) to £500 (65); professionals £500 (50) to £2,500 (80). */
  amateurAppetite: { fromAverage: 35, toAverage: 65, fromPence: 10000, toPence: 50000 },
  professionalAppetite: { fromAverage: 50, toAverage: 80, fromPence: 50000, toPence: 250000 },
  /** Some put more on than others: a personal streak, the same all season. */
  streak: [0.8, 1.25] as const,
  /** How much of that they will put up, by who they think wins (their view: a favourite risks it all). */
  share: { THEY_FANCY_IT: 1, EVEN: 0.6, THEY_ARE_UNDERDOG: 0.3, UNKNOWN: 0.5 },
  /** Offers you can make a member in a week before they lose patience. */
  asks: 3,
  /** Money matches a week, and one against each member. */
  perWeek: 3,
  /** A member challenges you in about half of all weeks. */
  challengeChance: 0.5,
  /** A member's form: their average over this many recent matches. */
  formMatches: 10,
  /** No one challenges a brand-new player before their first event or the end of these opening weeks. */
  settleInWeeks: 4,
  /** Within this many points of three-dart average it is an even game. */
  evenWithin: 3,
});

const pounds = (pence: number) => Math.max(MONEY.minimumPence, Math.floor(pence / 500) * 500);
const lerp = (x: number, a: { fromAverage: number; toAverage: number; fromPence: number; toPence: number }) =>
  a.fromPence + (a.toPence - a.fromPence) * Math.min(1, Math.max(0, (x - a.fromAverage) / (a.toAverage - a.fromAverage)));

/** The most this member would ever put on a game (their standard and their personal streak; the same all season). */
export function appetiteFor(seed: string, season: number, member: { key: string; professional: boolean; average: number | null }) {
  const a = member.professional ? MONEY.professionalAppetite : MONEY.amateurAppetite;
  const base = member.average === null ? (a.fromPence + a.toPence) / 3 : lerp(member.average, a);
  const rng = scopedRandom(seed, MONEY.version, "money-appetite", season, member.key);
  return pounds(base * (MONEY.streak[0] + rng() * (MONEY.streak[1] - MONEY.streak[0])));
}
/** What they will happily play for this week, given who they think wins (odds are yours: your underdog is their favourite). */
export function willingFor(appetite: number, yourOdds: Odds) {
  const share = yourOdds === "UNDERDOG" ? MONEY.share.THEY_FANCY_IT : yourOdds === "FAVOURITE" ? MONEY.share.THEY_ARE_UNDERDOG
    : yourOdds === "EVEN" ? MONEY.share.EVEN : MONEY.share.UNKNOWN;
  return pounds(appetite * share);
}

export type Reply = { kind: "ACCEPT" | "COUNTER" | "RAISE" | "WALK"; pence: number | null; line: string };
/**
 * Their answer to your offer: take it if it's within what they'll risk (a favourite insulted by peanuts asks for more on
 * your first offer), come back with their figure if it's too rich, and walk away once you've pushed them too often.
 */
export function replyTo(offer: number, willing: number, yourOdds: Odds, ask: number, line: (kind: Reply["kind"], pence: number | null) => string): Reply {
  const r = (kind: Reply["kind"], pence: number | null): Reply => ({ kind, pence, line: line(kind, pence) });
  if (offer <= willing) {
    if (yourOdds === "UNDERDOG" && ask === 1 && offer * 4 < willing) return r("RAISE", pounds(willing / 2));
    return r("ACCEPT", offer);
  }
  if (ask >= MONEY.asks) return r("WALK", null);
  return r("COUNTER", willing);
}
const LINES: Record<Reply["kind"], readonly string[]> = {
  ACCEPT: ["You're on. {stake} it is.", "Done. {stake}, first to four.", "Shake on it: {stake}."],
  COUNTER: ["Too rich for me. {stake} and you're on.", "I'll not go that high. {stake}?", "Steady on. Make it {stake}."],
  RAISE: ["{offer}? Don't waste my time. {stake} and I'll get my darts out.", "For {offer} I'd not take my coat off. Make it {stake}."],
  WALK: ["Forget it, I've a game to watch.", "We're not going to agree. Another week.", "You're having a laugh. I'm off to the bar."],
};
/** Their words for a reply (the same each time for a given offer). */
export function lineFor(seed: string, season: number, week: number, key: string, ask: number, kind: Reply["kind"], stake: number | null, offer: number) {
  const rng = scopedRandom(seed, MONEY.version, "money-line", season, week, key, ask);
  const fmt = (p: number | null) => p === null ? "" : `£${(p / 100).toLocaleString("en-GB")}`;
  return pick(rng, LINES[kind]).replace("{stake}", fmt(stake)).replace("{offer}", fmt(offer));
}

/** The simulator's own calibration: a player's typical three-dart average from their scoring and finishing. */
export const averageForLevel = (level: number) => Math.round((S.form.averageBaseline + (S.form.scoringWeight + S.form.finishingWeight) * level) * 10) / 10;

export type Odds = "FAVOURITE" | "EVEN" | "UNDERDOG" | "UNKNOWN";
/** UNKNOWN: they have no recorded matches yet, so nobody can say. */
export const oddsFor = (yourAverage: number, theirAverage: number | null): Odds => theirAverage === null ? "UNKNOWN" :
  yourAverage - theirAverage > MONEY.evenWithin ? "FAVOURITE" : theirAverage - yourAverage > MONEY.evenWithin ? "UNDERDOG" : "EVEN";

/**
 * This week's challenge from a member, if any: the same answer every time for a save, season and week. They name their price
 * (some of what they would happily risk), never more than you have free: nobody challenges you for money you have not got.
 */
export function weeklyChallenge(seed: string, season: number, week: number, members: readonly { key: string; professional: boolean; willing: number }[], availablePence: number) {
  if (!members.length) return null;
  const rng = scopedRandom(seed, MONEY.version, "money-challenge", season, week);
  if (rng() >= MONEY.challengeChance) return null;
  const member = pick(rng, [...members].sort((a, b) => a.key.localeCompare(b.key)));
  const stake = Math.min(pounds(member.willing * (0.5 + rng() * 0.5)), Math.floor(availablePence / 500) * 500);
  if (stake < MONEY.minimumPence) return null;
  return { opponentKey: member.key, stakePence: stake };
}
