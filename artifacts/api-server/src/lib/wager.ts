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
