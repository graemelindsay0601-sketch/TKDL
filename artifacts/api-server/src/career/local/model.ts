/**
 * Local nights: the ordinary darts week of a club player, so every night can hold something.
 * - Pub league (Tuesdays): seven-week local leagues against your club's members, first to 3, a small prize for the top three.
 * - Club knockout (Thursdays): an eight-player knockout on the night, first to 2 legs, £5 in, £30 to the winner and £10 to the runner-up.
 * - Practice night (any free night): a structured session (checkouts, Bob's 27 or scoring) logged against your personal bests.
 * - Friendly (pre-season weeks 1–3 and post-season weeks 47–52): one match, first to 3, against a club member, for the love of it.
 * - Exhibition (once you're known): three legs against local challengers for an appearance fee.
 * - Coaching night (once you're known a little): teach a session at a club for a fee. No darts thrown.
 * Every match is played on the live scorer; the money goes through the ledger. Nothing here changes your darts: only the
 * darts you throw count.
 */
export const LOCAL = Object.freeze({
  version: 1,
  pub: { day: 2, firstWeek: 2, lastWeek: 46, rounds: 7, size: 8, bestOf: 5, prizes: [6_000, 3_000, 1_500] as readonly number[] },
  knockout: { day: 4, firstWeek: 2, lastWeek: 50, size: 8, bestOf: 3, entryPence: 500, prizes: [3_000, 1_000] as readonly number[] },
  friendly: { weeks: [1, 2, 3, 47, 48, 49, 50, 51, 52] as readonly number[], bestOf: 5 },
  exhibition: { legs: 3, minFans: 5_000, maxRank: 128, basePence: 30_000, perFanPence: 2, capPence: 250_000, legWinPence: 5_000, challengerAvg: [38, 52] as const },
  coaching: { minFans: 1_000, maxRank: 256, basePence: 4_000, perFanDivisor: 50, capPence: 20_000 },
});
export const LOCAL_KINDS = {
  PUB_LEAGUE: { name: "Pub league", blurb: "Tuesday nights: a seven-week league against your club's members, first to 3. A prize for the top three." },
  KNOCKOUT: { name: "Club knockout", blurb: "Thursday nights: eight players, first to 2 legs, £5 in. £30 to the winner, £10 to the runner-up." },
  PRACTICE: { name: "Practice night", blurb: "Any free night: a structured session, logged against your personal bests." },
  FRIENDLY: { name: "Friendly", blurb: "Pre-season and after the season: one match, first to 3, against a club member." },
  EXHIBITION: { name: "Exhibition", blurb: "Three legs against local challengers for an appearance fee." },
  COACHING: { name: "Coaching night", blurb: "Teach a session at a club for a fee. No darts thrown." },
} as const;
export type LocalKind = keyof typeof LOCAL_KINDS;
export const PRACTICE_ROUTINES = { CHECKOUTS: "Checkout practice", BOBS_27: "Bob's 27", SCORING: "Scoring (33 visits)" } as const;
export type PracticeRoutine = keyof typeof PRACTICE_ROUTINES;

/** What an exhibition and a coaching night pay, by how big your name is (fans for your darts career). */
export const exhibitionFee = (fans: number) => Math.min(LOCAL.exhibition.capPence, Math.round((LOCAL.exhibition.basePence + Math.max(0, fans) * LOCAL.exhibition.perFanPence) / 1000) * 1000);
export const coachingFee = (fans: number) => Math.min(LOCAL.coaching.capPence, Math.round((LOCAL.coaching.basePence + Math.max(0, fans) / LOCAL.coaching.perFanDivisor * 100) / 500) * 500);
/** Known enough to be booked: by your following or your world ranking. */
export const canExhibit = (fans: number, rank: number | null) => fans >= LOCAL.exhibition.minFans || (rank !== null && rank <= LOCAL.exhibition.maxRank);
export const canCoach = (fans: number, rank: number | null) => fans >= LOCAL.coaching.minFans || (rank !== null && rank <= LOCAL.coaching.maxRank);
/** The knockout round names for an eight-player draw. */
export const KO_ROUNDS = ["Quarter-final", "Semi-final", "Final"] as const;
