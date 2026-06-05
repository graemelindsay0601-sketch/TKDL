const K = 32;
const ELO_FLOOR = 800;

export function calcEloChange(winnerElo: number, loserElo: number): number {
  const expected = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  return Math.max(1, Math.round(K * (1 - expected)));
}

export function calcTier(elo: number): string {
  if (elo >= 1100) return "Gold";
  if (elo >= 980)  return "Silver";
  return "Bronze";
}

export function applyEloChange(winnerElo: number, loserElo: number): {
  newWinnerElo: number;
  newLoserElo: number;
  change: number;
} {
  const change = calcEloChange(winnerElo, loserElo);
  return {
    newWinnerElo: winnerElo + change,
    newLoserElo: Math.max(ELO_FLOOR, loserElo - change),
    change,
  };
}
