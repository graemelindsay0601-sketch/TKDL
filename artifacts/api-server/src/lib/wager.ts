import type { Player } from "@workspace/db";

export function getMaxStake(p1: Pick<Player, "points">, p2: Pick<Player, "points">): number {
  return Math.min(p1.points, p2.points);
}

export function validateStake(
  stake: number,
  winner: Pick<Player, "points" | "name">,
  loser: Pick<Player, "points" | "name">
): string | null {
  // Rules page has always said the minimum stake is 1 — 0 used to slip
  // through here for every normal submission. The one legitimate 0-stake
  // case (a Singles championship tiebreak) never goes through this wager
  // path at all: it's recorded via the separate playoff_matches admin flow
  // (see /api/seasons/:id/playoff in routes/seasons.ts), which has no stake
  // field and never calls this function. So there's no carve-out to make
  // here — every caller of validateStake is a normal wager and should
  // require a real stake.
  if (!Number.isInteger(stake) || stake < 1)
    return "Stake must be a positive integer (minimum 1)";
  // Only the loser's balance is actually at risk — applyWager() below only
  // ever adds to the winner's points, never subtracts, so a winner sitting
  // on 0pts (a brand-new signup, or someone previously cleaned out) has
  // nothing to lose by winning and shouldn't block the match. This used to
  // check the winner's balance too, which meant a 0pt player couldn't even
  // WIN a wagered match, let alone lose one.
  if (stake > loser.points)
    return `Stake (${stake}) exceeds ${loser.name}'s balance (${loser.points})`;
  return null;
}

export function applyWager(
  stake: number,
  winner: Pick<Player, "points">,
  loser: Pick<Player, "points">
): { newWinnerPoints: number; newLoserPoints: number; loserEliminated: boolean } {
  const newWinnerPoints = winner.points + stake;
  const newLoserPoints = Math.max(0, loser.points - stake);
  return {
    newWinnerPoints,
    newLoserPoints,
    loserEliminated: newLoserPoints === 0,
  };
}

// ── Combined-side matches ────────────────────────────────────────────────────
//
// Doubles Event and Shift Wars both support a "combined side" match: one
// official team plays alone (the "solo" side) against a temporary grouping
// of two or more OTHER official teams (the "combined" side) — e.g. one
// doubles pairing taking on a made-up group pulled from two different other
// pairings, as a handicap, in one sitting. See db/migrations/
// add_combined_matches.ts for the tables this settles into.
//
// Splits a pot across N sides in proportion to a per-side weight (each
// combined-side team's own fielded headcount), using the largest-remainder
// method so the shares always sum to exactly `pot` even when it doesn't
// divide evenly — same integer-safety goal as team-matches.ts's splitEvenly,
// generalized to unequal weights: a team that fielded more of the combined
// group's players carries proportionally more of the win/loss, not an equal
// slice regardless of headcount. Equal weights reduce to an even split.
export function splitProportional(pot: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return weights.map(() => 0);
  const raw = weights.map(w => (pot * w) / totalWeight);
  const floors = raw.map(Math.floor);
  const remainder = pot - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (let k = 0; k < remainder && k < order.length; k++) result[order[k].i] += 1;
  return result;
}

export interface CombinedMember {
  points: number;
  name: string;
  fieldedCount: number;
}

// The pot is stake × whichever side fielded more players in total — same
// "bigger side risks/gains more" rule as every other Uneven Teams path this
// season (Team Match, Shift Wars, Doubles short-handed).
export function combinedPot(stake: number, soloFieldedCount: number, combinedMembers: Pick<CombinedMember, "fieldedCount">[]): number {
  const combinedTotal = combinedMembers.reduce((sum, m) => sum + m.fieldedCount, 0);
  return stake * Math.max(soloFieldedCount, combinedTotal);
}

// Only the side that's actually losing has anything at risk (same principle
// as validateStake above — a winner's own balance is never checked). When
// the combined side loses, each of its teams must individually be able to
// afford its OWN proportional share — no single combined-side team's points
// balance backs the whole pot the way a real doubles pairing/department pool
// would for a normal 1v1 match.
export function validateCombinedStake(
  pot: number,
  losingSide: "solo" | "combined",
  solo: Pick<CombinedMember, "points" | "name">,
  combinedMembers: CombinedMember[],
): string | null {
  if (!Number.isInteger(pot) || pot < 1) return "Stake must be a positive integer (minimum 1)";
  if (losingSide === "solo") {
    if (pot > solo.points) return `Stake (${pot}) exceeds ${solo.name}'s balance (${solo.points})`;
    return null;
  }
  const shares = splitProportional(pot, combinedMembers.map(m => m.fieldedCount));
  for (let i = 0; i < combinedMembers.length; i++) {
    if (shares[i] > combinedMembers[i].points) {
      return `Stake share (${shares[i]}) exceeds ${combinedMembers[i].name}'s balance (${combinedMembers[i].points})`;
    }
  }
  return null;
}

// Settles a combined-side match. The solo team experiences the FULL pot
// swing (it genuinely played one whole match), while each combined-side
// team's own points move by only its proportional SHARE of that same pot —
// so one physical result never reads as two separate full wins or losses
// for the two (or more) teams that combined into one side.
export function applyCombinedWager(
  pot: number,
  losingSide: "solo" | "combined",
  solo: Pick<CombinedMember, "points">,
  combinedMembers: Pick<CombinedMember, "points" | "fieldedCount">[],
): {
  newSoloPoints: number;
  soloPointsDelta: number;
  soloEliminated: boolean;
  combinedResults: { share: number; newPoints: number; pointsDelta: number; eliminated: boolean }[];
} {
  const shares = splitProportional(pot, combinedMembers.map(m => m.fieldedCount));
  if (losingSide === "solo") {
    const newSoloPoints = Math.max(0, solo.points - pot);
    return {
      newSoloPoints,
      soloPointsDelta: newSoloPoints - solo.points,
      soloEliminated: newSoloPoints === 0,
      combinedResults: combinedMembers.map((m, i) => ({
        share: shares[i],
        newPoints: m.points + shares[i],
        pointsDelta: shares[i],
        eliminated: false,
      })),
    };
  }
  const newSoloPoints = solo.points + pot;
  return {
    newSoloPoints,
    soloPointsDelta: pot,
    soloEliminated: false,
    combinedResults: combinedMembers.map((m, i) => {
      const newPoints = Math.max(0, m.points - shares[i]);
      return { share: shares[i], newPoints, pointsDelta: newPoints - m.points, eliminated: newPoints === 0 };
    }),
  };
}
