// Pure decision logic for who (if anyone) is crowned Singles champion at
// season close. Deliberately has zero further imports so it can be unit
// tested directly with Node's built-in test runner (see
// __tests__/singles-champion.test.ts) without dragging in the database,
// logger, or anything else performSeasonReset() depends on.
//
// `contenders` is every ACTIVE player in any order; ties are decided on
// points alone, never Elo — the previous behavior (sort by points then Elo,
// crown whoever's first) silently let Elo settle a tie the Rules page says
// should go to a one-off no-stake tiebreaker match instead.
export type SinglesChampionDecision<P> =
  | { kind: "champion"; player: P }
  | { kind: "tied"; tied: P[]; points: number }
  | { kind: "none" };

export function decideSinglesChampion<P extends { id: number; points: number }>(
  contenders: P[],
  recordedChampionId: number | null
): SinglesChampionDecision<P> {
  if (recordedChampionId) {
    const recorded = contenders.find(p => p.id === recordedChampionId);
    // Found among current contenders -> use it. Not found (e.g. they've
    // since gone inactive) -> "none" tells the caller to fall back to the
    // championId/Name already stored on the season row rather than losing it.
    return recorded ? { kind: "champion", player: recorded } : { kind: "none" };
  }
  if (contenders.length === 0) return { kind: "none" };
  const topPoints = Math.max(...contenders.map(p => p.points));
  const tied = contenders.filter(p => p.points === topPoints);
  return tied.length > 1
    ? { kind: "tied", tied, points: topPoints }
    : { kind: "champion", player: tied[0] };
}

/**
 * The final Singles table at season end: only players who played at least one
 * match that season (win or lose). Someone who never played isn't given a
 * league position, can't be champion and earns no finishing-position
 * achievements. Ordered by points, then Elo.
 */
export function finalStandingsOrder<P extends { id?: number; points: number; elo: number; seasonWins: number; seasonLosses: number; seasonGamesPlayed?: number | null }>(players: P[], playedInSeason?: Set<number>): P[] {
  // Played = the running counters say so, OR there is a match row for them
  // this season (so a counter that drifted can never cost someone their place).
  return players
    .filter(p => p.seasonWins + p.seasonLosses > 0 || (p.seasonGamesPlayed ?? 0) > 0 || (p.id !== undefined && !!playedInSeason?.has(p.id)))
    .sort((a, b) => b.points - a.points || b.elo - a.elo);
}
