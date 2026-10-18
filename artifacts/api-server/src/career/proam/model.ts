import { scopedRandom } from "../world/random.ts";

/**
 * Pro-Am nights: a touring pro plays a night of exhibition legs against amateurs at a club. As an amateur you pay for a
 * slot and get one leg of 501 against the pro (you throw first): beat them and the organiser pays you a prize. Once you
 * hold a Tour Card the invitations turn round: you're the pro, paid an appearance fee to take on a dozen amateurs (anyone
 * who beats you collects from the organiser, not from you).
 */
export const PROAM = Object.freeze({
  version: 1,
  /** Pro-Am nights on offer in a week. */
  perWeek: 2,
  /** One leg, the amateur throws first. */
  bestOfLegs: 1,
  /** Your slot fee by how big the pro is, and the prize for beating them (a multiple of the fee). */
  fee: { top16: 2500, top64: 1500, other: 1000 }, prizeMultiple: 20,
  /** Amateurs who take on the pro on the night, and what you're paid to be the pro, by your world ranking. */
  amateurs: 12,
  appearance: { top16: 250000, top32: 150000, top64: 90000, other: 40000 },
});
export const feeFor = (rank: number | null) => rank !== null && rank <= 16 ? PROAM.fee.top16 : rank !== null && rank <= 64 ? PROAM.fee.top64 : PROAM.fee.other;
export const prizeFor = (rank: number | null) => feeFor(rank) * PROAM.prizeMultiple;
export const appearanceFor = (rank: number | null) => rank === null ? PROAM.appearance.other
  : rank <= 16 ? PROAM.appearance.top16 : rank <= 32 ? PROAM.appearance.top32 : rank <= 64 ? PROAM.appearance.top64 : PROAM.appearance.other;

/** This week's Pro-Am nights: which towns, which nights, which pros (the same every time for a save and week). */
export function weekNights<T extends { key: string }, P extends { key: string }>(seed: string, season: number, week: number, towns: readonly T[], pros: readonly P[]) {
  if (!towns.length) return [];
  const rng = scopedRandom(seed, PROAM.version, "proam-week", season, week);
  const pool = [...towns].sort((a, b) => a.key.localeCompare(b.key)), out: { town: T; pro: P | null; dayOfWeek: number }[] = [];
  for (let i = 0; i < Math.min(PROAM.perWeek, pool.length); i++) {
    const town = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const pro = pros.length ? pros[Math.floor(rng() * pros.length)] : null;
    out.push({ town, pro, dayOfWeek: 1 + Math.floor(rng() * 5) });
  }
  return out;
}
