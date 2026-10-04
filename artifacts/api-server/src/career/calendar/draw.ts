import type { Random } from "../world/random.ts";

/** Standard bracket order: seed numbers by draw position (1 and 2 meet only in the final). */
export function bracketOrder(size: number): number[] {
  if (size < 2 || (size & (size - 1)) !== 0) throw new Error("Bracket size must be a power of two");
  let order = [1, 2];
  while (order.length < size) {
    const next = order.length * 2;
    order = order.flatMap(seed => [seed, next + 1 - seed]);
  }
  return order;
}

export const bracketSize = (entrants: number) => {
  if (!Number.isSafeInteger(entrants) || entrants < 2) throw new Error("A knockout needs at least two entrants");
  let size = 2;
  while (size < entrants) size *= 2;
  return size;
};
export const roundCount = (size: number) => Math.log2(size);

export type DrawPosition = { position: number; participantKey: string | null; seed: number | null };
export type KnockoutDraw = { size: number; rounds: number; byes: number; positions: DrawPosition[]; seededKeys: string[] };

/**
 * Deterministic knockout draw.
 * - Seeds (from the A5 seeding boundary) take standard bracket seed numbers.
 * - Remaining entrants are shuffled with the event's scoped RNG and take the next numbers.
 * - Seed numbers beyond the entrant count are byes; because entrants > size/2,
 *   every bye faces a real player (the top seed numbers), never another bye.
 */
export function generateKnockoutDraw(entrants: readonly string[], seededOrder: readonly string[], maxSeeds: number, rng: Random): KnockoutDraw {
  if (new Set(entrants).size !== entrants.length) throw new Error("Duplicate entrant in draw");
  const size = bracketSize(entrants.length);
  const entrantSet = new Set(entrants);
  const seeds = seededOrder.filter(key => entrantSet.has(key)).slice(0, Math.min(maxSeeds, size / 2));
  const seededSet = new Set(seeds);
  const rest = [...entrants].filter(key => !seededSet.has(key)).sort();
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const bySeedNumber = [...seeds, ...rest];
  const order = bracketOrder(size);
  const positions = order.map((seedNumber, index) => ({
    position: index + 1,
    participantKey: bySeedNumber[seedNumber - 1] ?? null,
    seed: seedNumber <= seeds.length ? seedNumber : null,
  }));
  for (let i = 0; i < size; i += 2) if (!positions[i].participantKey && !positions[i + 1].participantKey) throw new Error("Invalid draw: bye versus bye");
  return { size, rounds: roundCount(size), byes: size - entrants.length, positions, seededKeys: seeds };
}

/** Finishing position for a loser in round r of R (champion 1, runner-up 2, semis 3, quarters 5...). */
export const finishingPosition = (round: number, rounds: number) => 2 ** (rounds - round) + 1;
export function stageName(round: number, rounds: number): string {
  const remaining = 2 ** (rounds - round + 1);
  return remaining === 2 ? "FINAL" : remaining === 4 ? "SEMI_FINAL" : remaining === 8 ? "QUARTER_FINAL" : `LAST_${remaining}`;
}
