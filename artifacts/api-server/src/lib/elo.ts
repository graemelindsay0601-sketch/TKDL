const K = 32;

export function calcEloChange(winnerElo: number, loserElo: number): number {
  const expectedWin = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const change = Math.round(K * (1 - expectedWin));
  return Math.max(1, change);
}

export function calcTier(elo: number): string {
  if (elo >= 1400) return "Diamond";
  if (elo >= 1250) return "Platinum";
  if (elo >= 1100) return "Gold";
  if (elo >= 950)  return "Silver";
  return "Bronze";
}

export function calcPoints(winnerElo: number, loserElo: number): number {
  const diff = loserElo - winnerElo;
  if (diff >= 200) return 5;
  if (diff >= 100) return 4;
  if (diff >= 0)   return 3;
  if (diff >= -100) return 2;
  return 1;
}
