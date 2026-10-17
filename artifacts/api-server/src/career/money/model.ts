import { CAREER_SIMULATION_CONFIG as S } from "../world/config.ts";
import { pick, scopedRandom } from "../world/random.ts";

/**
 * Money matches: a one-off game at your club against another member, first to four legs of 501, for a stake each.
 * The winner takes the other's stake. Nothing is invented: the match is played by the same simulator as a quick-sim,
 * with your form, and the money goes through the ledger like any other.
 */
export const MONEY = Object.freeze({
  version: 1,
  /** First to four legs. */
  bestOf: 7,
  /** Stakes on offer (pence a side). */
  stakes: [500, 1000, 2000, 5000, 10000, 25000] as readonly number[],
  /** The most a club amateur will put up; professionals will play for more. */
  amateurMaxPence: 5000, professionalMaxPence: 25000,
  /** Money matches a week, and one against each member. */
  perWeek: 3,
  /** A member challenges you in about half of all weeks. */
  challengeChance: 0.5,
  /** A member's form: their average over this many recent matches. */
  formMatches: 10,
  /** Within this many points of three-dart average it is an even game. */
  evenWithin: 3,
});

export const maxStakeFor = (professional: boolean) => professional ? MONEY.professionalMaxPence : MONEY.amateurMaxPence;
/** Stakes you can offer this member with the money you have free. */
export const stakesFor = (professional: boolean, availablePence: number) => MONEY.stakes.filter(s => s <= maxStakeFor(professional) && s <= availablePence);

/** The simulator's own calibration: a player's typical three-dart average from their scoring and finishing. */
export const averageForLevel = (level: number) => Math.round((S.form.averageBaseline + (S.form.scoringWeight + S.form.finishingWeight) * level) * 10) / 10;

export type Odds = "FAVOURITE" | "EVEN" | "UNDERDOG" | "UNKNOWN";
/** UNKNOWN: they have no recorded matches yet, so nobody can say. */
export const oddsFor = (yourAverage: number, theirAverage: number | null): Odds => theirAverage === null ? "UNKNOWN" :
  yourAverage - theirAverage > MONEY.evenWithin ? "FAVOURITE" : theirAverage - yourAverage > MONEY.evenWithin ? "UNDERDOG" : "EVEN";

/**
 * This week's challenge from a member, if any: the same answer every time for a save, season and week. They pick a
 * stake they would play for, up to what you have free; nobody challenges you for money you have not got.
 */
export function weeklyChallenge(seed: string, season: number, week: number, members: readonly { key: string; professional: boolean }[], availablePence: number) {
  if (!members.length) return null;
  const rng = scopedRandom(seed, MONEY.version, "money-challenge", season, week);
  if (rng() >= MONEY.challengeChance) return null;
  const member = pick(rng, [...members].sort((a, b) => a.key.localeCompare(b.key)));
  const stakes = stakesFor(member.professional, availablePence);
  if (!stakes.length) return null;
  return { opponentKey: member.key, stakePence: pick(rng, stakes) };
}
