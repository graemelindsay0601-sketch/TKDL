const K = 32;
// Exported so any code that needs to restore/undo an Elo change (e.g. match
// reversal) clamps against the exact same floor the forward path uses,
// instead of a separately hardcoded "800" that could drift out of sync.
export const ELO_FLOOR = 800;

export function calcEloChange(winnerElo: number, loserElo: number): number {
  const expected = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  return Math.max(1, Math.round(K * (1 - expected)));
}

// The full 5-tier ladder the app documents (see rules.tsx) and already
// styles everywhere (tier-badge.tsx, community.tsx, leaderboard.tsx,
// players.tsx's TIER_BAND, etc.) — this is the single source of truth
// every route derives a player's tier from.
export function calcTier(elo: number): string {
  if (elo >= 1400) return "Diamond";
  if (elo >= 1250) return "Platinum";
  if (elo >= 1100) return "Gold";
  if (elo >= 950)  return "Silver";
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
