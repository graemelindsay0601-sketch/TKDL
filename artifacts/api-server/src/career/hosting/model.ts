/**
 * Run your own tournament: book your club's back room for a night, set the entry fee, add prize money of your own, and pick
 * the field size. It goes into the calendar as a real local event (a special, so no ranking points): players enter it like
 * any other, only those free that night can come, and it's played and paid like any other. You pay the room and your
 * prize top-up when you book; you keep the organiser's share of the entry fees once it's played; the rest of the fees and
 * your top-up make the prize pot (winner half, runner-up a quarter, semi-finalists an eighth each).
 */
export const HOSTING = Object.freeze({
  version: 1,
  definitionKey: "hosted-open",
  /** Booked at least this far ahead (so entries can open) and no later than this week. */
  leadWeeks: 2, lastWeek: 50,
  maxPerSeason: 4,
  fieldSizes: [16, 32] as readonly number[],
  roomHirePence: { 16: 4000, 32: 7500 } as Record<number, number>,
  maxFeePence: 5000, maxTopUpPence: 200000,
  /** The organiser keeps this share of the entry fees; the rest goes in the pot. */
  organiserShare: 0.2,
  minimumEntrants: 4,
  split: [[1, 0.5], [2, 0.25], [4, 0.125]] as const,
});

export type HostedTerms = { feePence: number; topUpPence: number; fieldSize: number; roomHirePence: number; organiserShare: number; name: string };

/** The prize table for a field of this many entrants. */
export function hostedPrize(t: Pick<HostedTerms, "feePence" | "topUpPence" | "organiserShare">, entrants: number) {
  const pot = Math.floor(entrants * t.feePence * (1 - t.organiserShare)) + t.topUpPence;
  return { key: "prize:hosted", bands: HOSTING.split.map(([upToPosition, share]) => ({ upToPosition, amountPence: Math.floor(pot * share / 10) * 10 })) };
}
/** What you keep from the entry fees once it's played. */
export const organiserTake = (t: Pick<HostedTerms, "feePence" | "organiserShare">, entrants: number) => Math.floor(entrants * t.feePence * t.organiserShare / 10) * 10;

/**
 * How full it gets: a share of the field size the calendar fills from free local players. Prize money draws them in, a steep
 * fee keeps them away, and a following brings them along. Between a quarter and all of it.
 */
export function expectedTurnout(t: Pick<HostedTerms, "feePence" | "topUpPence" | "fieldSize">, fans: number) {
  const potPull = Math.min(0.35, t.topUpPence / Math.max(1, t.fieldSize * 500) * 0.15);
  const feePush = (t.feePence / HOSTING.maxFeePence) * 0.25;
  const famePull = Math.min(0.2, Math.log10(1 + Math.max(0, fans)) / 25);
  return Math.round(Math.min(1, Math.max(0.25, 0.4 + potPull + famePull - feePush)) * 100) / 100;
}
