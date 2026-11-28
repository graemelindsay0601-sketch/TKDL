// Shadow Ladder rules (pure): every night each shadow plays a few short matches against
// the shadows ranked either side of it, and an Elo-style rating moves them up or down.
// The database side is shadow-ladder-db.ts.

export const START_RATING = 1000;
export const LADDER_K = 24;
export const NIGHT_ROUNDS = 3;
export const LADDER_LEGS = 2; // first to 2 legs: quick, but not a coin flip

export function expected(a: number, b: number): number { return 1 / (1 + 10 ** ((b - a) / 400)); }

/** New ratings after a match; a 2-0 counts a bit more than a 2-1. */
export function eloUpdate(ra: number, rb: number, aWon: boolean, margin = 1, k = LADDER_K): [number, number] {
  const mult = margin >= 2 ? 1.25 : 1;
  const d = k * mult * ((aWon ? 1 : 0) - expected(ra, rb));
  return [Math.round((ra + d) * 10) / 10, Math.round((rb - d) * 10) / 10];
}

/** Neighbour pairings for one round: ids in rating order, paired 1v2, 3v4… on even rounds and 2v3, 4v5… on odd
 *  rounds so everyone meets both neighbours over a night. Anyone left over sits that round out. */
export function nightPairs<T>(ordered: T[], round: number): [T, T][] {
  const out: [T, T][] = [];
  for (let i = round % 2; i + 1 < ordered.length; i += 2) out.push([ordered[i], ordered[i + 1]]);
  return out;
}

/** 1-based ranks by rating (ties share the better rank). */
export function ranks(entries: { id: number; rating: number }[]): Map<number, number> {
  const sorted = [...entries].sort((a, b) => b.rating - a.rating);
  const out = new Map<number, number>();
  sorted.forEach((e, i) => out.set(e.id, i > 0 && sorted[i - 1].rating === e.rating ? out.get(sorted[i - 1].id)! : i + 1));
  return out;
}
