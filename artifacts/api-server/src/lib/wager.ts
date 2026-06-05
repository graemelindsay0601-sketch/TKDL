import type { Player } from "@workspace/db";

export function getMaxStake(p1: Pick<Player, "points">, p2: Pick<Player, "points">): number {
  return Math.min(p1.points, p2.points);
}

export function validateStake(
  stake: number,
  winner: Pick<Player, "points" | "name">,
  loser: Pick<Player, "points" | "name">
): string | null {
  if (!Number.isInteger(stake) || stake < 0)
    return "Stake must be a non-negative integer";
  if (stake > winner.points)
    return `Stake (${stake}) exceeds ${winner.name}'s balance (${winner.points})`;
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
